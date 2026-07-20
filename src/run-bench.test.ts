import { describe, expect, it, vi } from 'vitest'
import { OUT_MOUNT, resultFileName, runBenchFile, toCliOptions, type RunSpec } from './run-bench'

const spec: RunSpec = {
  benchFile: 'bench/color.bench.ts',
  workspace: '/work/repo',
  vendorDir: '/action/vendor',
  outDir: '/tmp/out',
  baselineCase: 'previous',
  minRatio: 80,
}

describe('resultFileName', () => {
  it('flattens path separators so nested files cannot collide', () => {
    expect(resultFileName('bench/color.bench.ts')).toBe('bench__color.bench.ts.md')
    expect(resultFileName('bench\\color.bench.ts')).toBe('bench__color.bench.ts.md')
  })
})

describe('toCliOptions', () => {
  it('mounts the out dir, targets the md file inside it, and applies bench defaults', () => {
    expect(toCliOptions(spec)).toEqual({
      benchFile: 'bench/color.bench.ts',
      cpus: 1,
      cpuset: '0',
      memory: '512m',
      imageTag: 'soroush-bench:latest',
      mounts: [`/tmp/out:${OUT_MOUNT}`],
      md: false,
      mdFile: `${OUT_MOUNT}/bench__color.bench.ts.md`,
      rounds: 1,
      gcInner: false,
      baselineCase: 'previous',
      minRatio: 80,
    })
  })

  it('passes explicit sandbox overrides through', () => {
    expect(
      toCliOptions({ ...spec, rounds: 5, cpus: 2, cpuset: '0,2', memory: '1g' })
    ).toMatchObject({ rounds: 5, cpus: 2, cpuset: '0,2', memory: '1g' })
  })
})

describe('runBenchFile', () => {
  it('builds then runs the sandbox and passes on a zero exit', async () => {
    const exec = vi.fn().mockResolvedValue(0)
    await expect(runBenchFile(spec, exec)).resolves.toEqual({ passed: true })
    expect(exec).toHaveBeenCalledTimes(2)
    const runArgs = exec.mock.calls[1][1] as string[]
    expect(runArgs).toEqual(
      expect.arrayContaining(['--baseline-case', 'previous', '--min-ratio', '80', '--md-file'])
    )
    expect(runArgs).toEqual(expect.arrayContaining(['-v', `/tmp/out:${OUT_MOUNT}`]))
  })

  it('reports a failed run (gate breach) instead of throwing', async () => {
    const exec = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    await expect(runBenchFile(spec, exec)).resolves.toEqual({ passed: false })
  })

  it('rethrows a docker build failure as an infra error', async () => {
    const exec = vi.fn().mockResolvedValue(2)
    await expect(runBenchFile(spec, exec)).rejects.toThrow(/docker build failed with exit code 2/)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('rethrows other errors (e.g. a missing docker binary) as infra errors', async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('spawn docker ENOENT'))
    await expect(runBenchFile(spec, exec)).rejects.toThrow(/spawn docker ENOENT/)
  })
})
