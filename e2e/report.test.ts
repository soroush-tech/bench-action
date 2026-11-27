import { describe, expect, it } from 'vitest'
import { envLine, summaryRows } from './report'

const report = [
  '<!-- soroush-bench-action -->',
  '',
  '## Benchmark results',
  '',
  'Baseline case: `baseline` · minimum speed ratio: **80%** · **1 of 2** failed',
  '',
  'soroush-bench 2.4.0 · node v24.22.3 · cpus 1 · cpuset 0 · memory 512m',
  '',
  '|  | Case | File | vs baseline | avg |',
  '| --- | --- | --- | ---: | ---: |',
  '| ❌ | `slow` | `e2e/fixture/bench/ratio.bench.ts` | 5.1% | 41.20 µs |',
  '| ✅ | `fast` | `e2e/fixture/bench/ratio.bench.ts` | 198.7% | 1.05 µs |',
  '',
  '<details><summary><code>e2e/fixture/bench/ratio.bench.ts</code> — ❌ failed</summary>',
].join('\n')

/** What v1.2.0 posted: the harness wrote no JSON, so no row has a ratio. */
const noResults = [
  'Baseline case: `previous` · minimum speed ratio: **80%** · **0 of 1** failed',
  '',
  '|  | Case | File | vs baseline | avg |',
  '| --- | --- | --- | ---: | ---: |',
  '| ✅ | _no results_ | `bench/gate/class-hit.bench.ts` | - | - |',
].join('\n')

describe('summaryRows', () => {
  it('reads each row: status, case and ratio, in order', () => {
    expect(summaryRows(report)).toEqual([
      { failed: true, label: 'slow', ratioPct: 5.1 },
      { failed: false, label: 'fast', ratioPct: 198.7 },
    ])
  })

  it('reads a file-level row with no ratio, as the checks must see a 1.2.0 report', () => {
    expect(summaryRows(noResults)).toEqual([
      { failed: false, label: '_no results_', ratioPct: undefined },
    ])
  })
})

describe('envLine', () => {
  it('finds the line naming what produced the run', () => {
    expect(envLine(report)).toBe(
      'soroush-bench 2.4.0 · node v24.22.3 · cpus 1 · cpuset 0 · memory 512m'
    )
  })

  it('is undefined for a report without one', () => {
    expect(envLine(noResults)).toBeUndefined()
  })
})
