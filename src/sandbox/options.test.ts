import { describe, expect, it } from 'vitest'
import { resolveSandboxOptions } from './options'

describe('resolveSandboxOptions', () => {
  const cli = {
    benchFile: 'bench/clone.bench.ts',
    cpus: 1,
    cpuset: '0',
    memory: '512m',
    imageTag: 'tag',
    mounts: ['/host:/mnt/host:ro'],
    md: true,
    mdFile: '/mnt/host/results.md',
    rounds: 3,
    gcInner: false,
    baselineCase: 'upstream',
    minRatio: 80,
  }

  it('mounts cwd as the repo and the package as the app, posix-ifying the path', () => {
    expect(resolveSandboxOptions(cli, '/work/repo', '/work/repo/vendor')).toEqual({
      imageTag: 'tag',
      contextDir: '/work/repo/vendor',
      repoDir: '/work/repo',
      appDir: '/work/repo/vendor',
      benchRelPath: 'bench/clone.bench.ts',
      cpuset: '0',
      cpus: 1,
      memory: '512m',
      extraMounts: ['/host:/mnt/host:ro'],
      md: true,
      mdFile: '/mnt/host/results.md',
      rounds: 3,
      gcInner: false,
      baselineCase: 'upstream',
      minRatio: 80,
    })
  })

  it('rejects a bench file outside the current directory', () => {
    expect(() =>
      resolveSandboxOptions({ ...cli, benchFile: '../outside.bench.ts' }, '/work/repo', '/v')
    ).toThrow(/must live inside the current directory/)
  })
})
