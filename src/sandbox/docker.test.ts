import { describe, expect, it, vi } from 'vitest'
import {
  buildImageArgs,
  buildRunArgs,
  closeResult,
  runSandbox,
  type SandboxOptions,
} from './docker'

const opts: SandboxOptions = {
  imageTag: 'soroush-bench:latest',
  contextDir: '/pkg',
  repoDir: '/repo-host',
  appDir: '/pkg',
  benchRelPath: 'bench/clone.bench.ts',
  cpuset: '0',
  cpus: 1,
  memory: '512m',
  extraMounts: [],
  md: false,
  rounds: 1,
  gcInner: false,
}

describe('buildImageArgs', () => {
  it('builds the image from the context dir under the tag', () => {
    expect(buildImageArgs(opts)).toEqual(['build', '-t', 'soroush-bench:latest', '/pkg'])
  })
})

describe('buildRunArgs', () => {
  it('pins cpu, memory and swap and mounts both volumes read-only', () => {
    expect(buildRunArgs(opts)).toEqual([
      'run',
      '--rm',
      '--cpuset-cpus',
      '0',
      '--cpus',
      '1',
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--tmpfs',
      '/bench',
      '-v',
      '/repo-host:/repo:ro',
      '-v',
      '/pkg:/app:ro',
      '-w',
      '/repo',
      'soroush-bench:latest',
      'tsx',
      '/app/dist/harness.mjs',
      '/repo/bench/clone.bench.ts',
    ])
  })

  it('appends --md after the bench file when md is set', () => {
    const args = buildRunArgs({ ...opts, md: true })
    expect(args[args.length - 1]).toBe('--md')
    expect(args[args.length - 2]).toBe('/repo/bench/clone.bench.ts')
  })

  it('omits --md when md is unset', () => {
    expect(buildRunArgs(opts)).not.toContain('--md')
  })

  it('appends --rounds N when rounds > 1, and omits it at 1', () => {
    const args = buildRunArgs({ ...opts, rounds: 5 })
    expect(args.slice(-2)).toEqual(['--rounds', '5'])
    expect(buildRunArgs(opts)).not.toContain('--rounds')
  })

  it('appends --gc-inner when set, and omits it otherwise', () => {
    expect(buildRunArgs({ ...opts, gcInner: true })).toContain('--gc-inner')
    expect(buildRunArgs(opts)).not.toContain('--gc-inner')
  })

  it('appends --md-file with its path when set, and omits it otherwise', () => {
    const args = buildRunArgs({ ...opts, mdFile: '/mnt/out/results.md' })
    expect(args.slice(-2)).toEqual(['--md-file', '/mnt/out/results.md'])
    expect(buildRunArgs(opts)).not.toContain('--md-file')
  })

  it('appends the ratio-gate flags when set, and omits them otherwise', () => {
    const args = buildRunArgs({ ...opts, baselineCase: 'upstream', minRatio: 80 })
    expect(args.slice(-4)).toEqual(['--baseline-case', 'upstream', '--min-ratio', '80'])
    expect(buildRunArgs(opts)).not.toContain('--baseline-case')
    expect(buildRunArgs(opts)).not.toContain('--min-ratio')
  })

  it('appends each extra mount as its own -v before the workdir', () => {
    const args = buildRunArgs({
      ...opts,
      extraMounts: ['/host/a:/mnt/a:ro', '/host/b:/mnt/b:ro'],
    })
    const appIndex = args.indexOf('/pkg:/app:ro')
    expect(args.slice(appIndex + 1, appIndex + 5)).toEqual([
      '-v',
      '/host/a:/mnt/a:ro',
      '-v',
      '/host/b:/mnt/b:ro',
    ])
    expect(args[appIndex + 5]).toBe('-w')
  })
})

describe('runSandbox', () => {
  it('builds then runs when both succeed', async () => {
    const exec = vi.fn().mockResolvedValue(0)
    await runSandbox(opts, exec)
    expect(exec).toHaveBeenNthCalledWith(1, 'docker', buildImageArgs(opts))
    expect(exec).toHaveBeenNthCalledWith(2, 'docker', buildRunArgs(opts))
  })

  it('throws and skips the run when the build fails', async () => {
    const exec = vi.fn().mockResolvedValue(2)
    await expect(runSandbox(opts, exec)).rejects.toThrow(/docker build failed with exit code 2/)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('throws when the run fails', async () => {
    const exec = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(137)
    await expect(runSandbox(opts, exec)).rejects.toThrow(/benchmark run failed with exit code 137/)
    expect(exec).toHaveBeenCalledTimes(2)
  })
})

describe('closeResult', () => {
  it('returns the exit code when the process exited normally', () => {
    expect(closeResult('docker', 0, null)).toBe(0)
    expect(closeResult('docker', 137, null)).toBe(137)
  })

  it('throws when the process was killed by a signal (null exit code)', () => {
    expect(() => closeResult('docker', null, 'SIGKILL')).toThrow(
      /docker was terminated by signal SIGKILL/
    )
  })
})
