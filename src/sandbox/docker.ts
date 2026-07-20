/** Resolved options for a single pinned benchmark run. */
export interface SandboxOptions {
  /** Tag of the sandbox image to build/run. */
  imageTag: string
  /** Host path to the Dockerfile's build context (the package root). */
  contextDir: string
  /** Host repo root, mounted read-only at `/repo`. */
  repoDir: string
  /** Host package root, mounted read-only at `/app` (provides the harness). */
  appDir: string
  /** Bench file path relative to `repoDir`, in POSIX form. */
  benchRelPath: string
  /** Physical core to pin to (`--cpuset-cpus`). */
  cpuset: string
  /** CPU quota (`--cpus`). */
  cpus: number
  /** Memory cap (`--memory`); swap is pinned to the same value. */
  memory: string
  /**
   * Extra `-v` volume specs (`host:container[:ro]`) appended verbatim. Needed
   * for pnpm workspaces, whose absolute symlinks only resolve when the repo is
   * also mounted at its host-visible path inside the container.
   */
  extraMounts: string[]
  /** Emit a markdown results table instead of mitata's default output. */
  md: boolean
  /**
   * Container path the markdown results table is also written to. Must point
   * inside a writable mount (see `extraMounts`) — `/repo` and `/app` are
   * read-only and `/bench` is a tmpfs that dies with the container.
   */
  mdFile?: string
  /** Repeat the whole suite this many times and report the median per case. */
  rounds: number
  /** Run GC before each iteration (mitata `gc('inner')`) for a per-iter GC row. */
  gcInner: boolean
  /** Case key the ratio gate compares every other case against. */
  baselineCase?: string
  /** Minimum speed vs the baseline, in percent; below it the run exits non-zero. */
  minRatio?: number
}

/** Argv for `docker build` of the sandbox image. */
export function buildImageArgs(opts: SandboxOptions): string[] {
  return ['build', '-t', opts.imageTag, opts.contextDir]
}

/**
 * Argv for the pinned `docker run`. The pinning flags — single-core
 * `--cpuset-cpus`, a hard `--cpus` quota, and `--memory` with `--memory-swap`
 * set equal (swap off) — are what make timings stable run-to-run regardless of
 * host load.
 */
export function buildRunArgs(opts: SandboxOptions): string[] {
  return [
    'run',
    '--rm',
    '--cpuset-cpus',
    opts.cpuset,
    '--cpus',
    String(opts.cpus),
    '--memory',
    opts.memory,
    '--memory-swap',
    opts.memory,
    '--tmpfs',
    '/bench',
    '-v',
    `${opts.repoDir}:/repo:ro`,
    '-v',
    `${opts.appDir}:/app:ro`,
    ...opts.extraMounts.flatMap((mount) => ['-v', mount]),
    '-w',
    '/repo',
    opts.imageTag,
    'tsx',
    '/app/dist/harness.mjs',
    `/repo/${opts.benchRelPath}`,
    ...(opts.md ? ['--md'] : []),
    ...(opts.mdFile !== undefined ? ['--md-file', opts.mdFile] : []),
    ...(opts.rounds > 1 ? ['--rounds', String(opts.rounds)] : []),
    ...(opts.gcInner ? ['--gc-inner'] : []),
    ...(opts.baselineCase !== undefined ? ['--baseline-case', opts.baselineCase] : []),
    ...(opts.minRatio !== undefined ? ['--min-ratio', String(opts.minRatio)] : []),
  ]
}

/** Injected process runner; resolves with the child's exit code. */
export type Exec = (command: string, args: string[]) => Promise<number>

/**
 * Interpret a child process's `close` event. A `null` exit code means the child
 * was killed by a signal (Ctrl-C, OOM-kill, docker itself terminated); surface
 * that as a failure instead of silently mapping it to success (exit 0).
 */
export function closeResult(command: string, code: number | null, signal: string | null): number {
  if (code === null) {
    throw new Error(`${command} was terminated by signal ${signal}`)
  }
  return code
}

/** Builds the image then runs the pinned benchmark; throws on a non-zero exit. */
export async function runSandbox(opts: SandboxOptions, exec: Exec): Promise<void> {
  const buildCode = await exec('docker', buildImageArgs(opts))
  if (buildCode !== 0) {
    throw new Error(`docker build failed with exit code ${buildCode}`)
  }

  const runCode = await exec('docker', buildRunArgs(opts))
  if (runCode !== 0) {
    throw new Error(`benchmark run failed with exit code ${runCode}`)
  }
}
