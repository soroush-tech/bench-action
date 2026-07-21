import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { closeResult, type Exec } from './sandbox/docker'
import { buildReport, findReportComment, type FileResult } from './comment'
import { parseFilesInput, selectBenchFiles } from './discover'
import { postViaRelay } from './relay'
import { resultFileName, runBenchFile } from './run-bench'

/** Real process runner: inherits stdio so Docker/mitata output streams through. */
const exec: Exec = (command, args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      try {
        resolvePromise(closeResult(command, code, signal))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })

const numberInput = (name: string): number | undefined => {
  const value = core.getInput(name)
  return value === '' ? undefined : Number(value)
}

/**
 * Branded comment via the relay when possible (public app installed + `id-token: write`);
 * any relay failure logs the reason and falls back to the direct github-token comment.
 */
async function postReport(report: string): Promise<void> {
  const pr = github.context.payload.pull_request
  if (core.getInput('branded') !== 'false' && pr !== undefined) {
    try {
      const { owner, repo } = github.context.repo
      await postViaRelay(
        { getIDToken: (audience) => core.getIDToken(audience), fetch: globalThis.fetch },
        `${owner}/${repo}`,
        pr.number,
        report
      )
      core.info('Posted the branded PR comment via the relay.')
      return
    } catch (error) {
      core.info(
        `Branded comment unavailable (${error instanceof Error ? error.message : String(error)}) — falling back to github-token.`
      )
    }
  }
  await upsertComment(core.getInput('github-token'), report)
}

async function upsertComment(token: string, report: string): Promise<void> {
  const pr = github.context.payload.pull_request
  if (token === '' || pr === undefined) {
    core.info('No PR context or github-token — skipping the PR comment.')
    return
  }
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pr.number,
    per_page: 100,
  })
  const existing = findReportComment(comments.data)
  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: report })
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: pr.number, body: report })
  }
}

async function main(): Promise<void> {
  const benchDir = core.getInput('bench-dir', { required: true })
  const baselineCase = core.getInput('baseline-case', { required: true })
  const minRatio = Number(core.getInput('min-ratio', { required: true }))
  if (!Number.isFinite(minRatio) || minRatio <= 0) {
    throw new Error('bench-action: min-ratio must be a positive number (percent)')
  }

  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd()
  const selection = parseFilesInput(core.getInput('files'))
  const selected = selectBenchFiles(readdirSync(join(workspace, benchDir)), selection)
  if (selected.length === 0) {
    throw new Error(`bench-action: no *.bench.ts files found in ${benchDir}`)
  }

  // dist/index.cjs lives one level below the package root, which holds vendor/
  // (the sandbox Dockerfile + harness committed alongside the bundle).
  const vendorDir = join(__dirname, '..', 'vendor')
  // World-writable on purpose: the dir is bind-mounted at /out inside the
  // sandbox, whose unprivileged `node` user (uid 1000) does not match the
  // runner's uid — mkdtemp's default 0700 would make the --md-file write fail
  // with EACCES on native Linux Docker. Mirrors the sandbox's own 1777 tmpfs.
  const outDir = mkdtempSync(join(tmpdir(), 'bench-action-'))
  chmodSync(outDir, 0o777)

  // Sequential on purpose: parallel sandboxes would contend for the pinned CPU.
  const results: FileResult[] = []
  for (const file of selected) {
    const benchFile = `${benchDir}/${file}`.replaceAll('\\', '/')
    core.info(`Running ${benchFile}…`)
    const { passed } = await runBenchFile(
      {
        benchFile,
        workspace,
        vendorDir,
        outDir,
        baselineCase,
        minRatio,
        rounds: numberInput('rounds'),
        cpus: numberInput('cpus'),
        cpuset: core.getInput('cpuset') || undefined,
        memory: core.getInput('memory') || undefined,
      },
      exec
    )
    let table = ''
    try {
      table = readFileSync(join(outDir, resultFileName(benchFile)), 'utf8').trim()
    } catch {
      core.warning(`No results table was produced for ${benchFile}.`)
    }
    results.push({ file: benchFile, passed, table })
  }

  const report = buildReport(results, baselineCase, minRatio)
  core.setOutput('report', report)
  try {
    await postReport(report)
  } catch (error) {
    // A read-only token (e.g. a fork PR) must not decide the job — the gate does.
    core.warning(
      `Could not post the PR comment: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const failed = results.filter((result) => !result.passed)
  if (failed.length > 0) {
    throw new Error(
      `benchmark target (min ratio ${minRatio}%) failed: ${failed.map((r) => r.file).join(', ')}`
    )
  }
}

main().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error))
})
