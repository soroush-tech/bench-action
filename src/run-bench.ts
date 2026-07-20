// The sandbox-driving modules are carried in src/sandbox (kept in sync with
// @soroush.tech/bench when re-vendoring) and bundled into dist/index.cjs — the
// action never resolves them (or anything else) at run time.
import { resolveSandboxOptions, type CliOptions } from './sandbox/options'
import { runSandbox, type Exec } from './sandbox/docker'

/** Container mount point of the writable results directory. */
export const OUT_MOUNT = '/out'

/** Everything one bench-file run needs, resolved by the entrypoint. */
export interface RunSpec {
  /** Bench file path relative to the workspace root, POSIX form. */
  benchFile: string
  /** Workspace root (the consumer repo's checkout). */
  workspace: string
  /** Directory holding the vendored Dockerfile + dist/harness.mjs. */
  vendorDir: string
  /** Writable host directory mounted at {@link OUT_MOUNT} for `--md-file`. */
  outDir: string
  baselineCase: string
  minRatio: number
  rounds?: number
  cpus?: number
  cpuset?: string
  memory?: string
}

/**
 * Flattens a bench file path into the name its results table is written
 * under, so files from nested directories cannot collide in the out dir.
 */
export function resultFileName(benchFile: string): string {
  return `${benchFile.replace(/[\\/]/g, '__')}.md`
}

/**
 * Maps a spec onto the bench CLI's options for one sandboxed run. Unset
 * sandbox fields mirror the bench CLI's own defaults.
 */
export function toCliOptions(spec: RunSpec): CliOptions {
  return {
    benchFile: spec.benchFile,
    cpus: spec.cpus ?? 1,
    cpuset: spec.cpuset ?? '0',
    memory: spec.memory ?? '512m',
    imageTag: 'soroush-bench:latest',
    mounts: [`${spec.outDir}:${OUT_MOUNT}`],
    md: false,
    mdFile: `${OUT_MOUNT}/${resultFileName(spec.benchFile)}`,
    rounds: spec.rounds ?? 1,
    gcInner: false,
    baselineCase: spec.baselineCase,
    minRatio: spec.minRatio,
  }
}

export interface RunOutcome {
  passed: boolean
}

/**
 * Runs one bench file in the pinned sandbox. A non-zero benchmark run means
 * the ratio gate (or the bench itself) failed → `passed: false`. Anything
 * else — Docker build failure, a missing docker binary, a signal kill — is an
 * infra error, not a gate verdict, and is rethrown.
 */
export async function runBenchFile(spec: RunSpec, exec: Exec): Promise<RunOutcome> {
  const opts = resolveSandboxOptions(toCliOptions(spec), spec.workspace, spec.vendorDir)
  try {
    await runSandbox(opts, exec)
    return { passed: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('benchmark run failed')) {
      return { passed: false }
    }
    throw error
  }
}
