// Carried over from @soroush.tech/bench's cli.ts (trimmed to what the action
// needs — no argv parsing here; inputs arrive via action.yml). Keep in sync
// when re-vendoring a new bench release.
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { SandboxOptions } from './docker'

export interface CliOptions {
  benchFile: string
  cpus: number
  cpuset: string
  memory: string
  imageTag: string
  mounts: string[]
  md: boolean
  /** Container path the markdown results table is also written to. */
  mdFile?: string
  /** Container path the JSON results are written to. */
  jsonFile?: string
  rounds: number
  gcInner: boolean
  /** Case key every other case is compared against; with `minRatio`, the ratio gate. */
  baselineCase?: string
  /** Minimum speed vs the baseline, in percent; below it the run fails. */
  minRatio?: number
}

/** Maps parsed options + host paths into the concrete sandbox run options. */
export function resolveSandboxOptions(
  cli: CliOptions,
  cwd: string,
  packageRoot: string
): SandboxOptions {
  const rel = relative(cwd, resolve(cwd, cli.benchFile))
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('bench: the bench file must live inside the current directory')
  }
  return {
    imageTag: cli.imageTag,
    contextDir: packageRoot,
    repoDir: cwd,
    appDir: packageRoot,
    benchRelPath: rel.split(sep).join('/'),
    cpuset: cli.cpuset,
    cpus: cli.cpus,
    memory: cli.memory,
    extraMounts: cli.mounts,
    md: cli.md,
    mdFile: cli.mdFile,
    jsonFile: cli.jsonFile,
    rounds: cli.rounds,
    gcInner: cli.gcInner,
    baselineCase: cli.baselineCase,
    minRatio: cli.minRatio,
  }
}
