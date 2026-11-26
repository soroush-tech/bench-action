// One matrix row of the E2E workflow: the reports of the built action, run on
// the fixture with one bench version as its sandbox. The workflow saves each
// run's `report` output to <E2E_OUT>/<BENCH_VERSION>/{report-only,gate}.md.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { atLeast } from '../scripts/versions.mjs'
import { envLine, summaryRows } from './report'

const { BENCH_VERSION, E2E_OUT = 'e2e-out', GATE_OUTCOME } = process.env
if (BENCH_VERSION === undefined) throw new Error('e2e: set BENCH_VERSION to the row the reports came from')

const read = (run: string): string =>
  readFileSync(join(E2E_OUT, BENCH_VERSION, `${run}.md`), 'utf8')
const reportOnly = read('report-only')
const gate = read('gate')

/** The first bench that records `env`, so the first whose report has an env line. */
const ENV_SINCE = '2.4.0'

describe(`the built action, with bench ${BENCH_VERSION} as its sandbox`, () => {
  it.each([
    ['report-only', reportOnly],
    ['gate', gate],
  ])('gives every case a ratio in the %s run', (_, report) => {
    const rows = summaryRows(report)
    expect(rows.map(({ label }) => label).sort()).toEqual(['fast', 'slow'])
    expect(rows.every(({ ratioPct }) => ratioPct !== undefined)).toBe(true)
  })

  it('reports without a gate when min-ratio is empty', () => {
    expect(reportOnly).toContain('· report only, no gate')
    expect(summaryRows(reportOnly).filter(({ failed }) => failed)).toEqual([])
  })

  it('fails the gate run on the slow case, and only on it', () => {
    expect(GATE_OUTCOME).toBe('failure')
    const failed = summaryRows(gate).filter((row) => row.failed)
    expect(failed.map(({ label }) => label)).toEqual(['slow'])
  })

  if (atLeast(BENCH_VERSION, ENV_SINCE)) {
    it('names this bench and the sandbox limits in the env line', () => {
      expect(envLine(reportOnly)).toMatch(
        new RegExp(`^soroush-bench ${BENCH_VERSION.replaceAll('.', '\\.')} · node v\\S+ · cpus 1 · cpuset 0 · memory 512m$`)
      )
    })
  } else {
    it('has no env line, as this bench records none', () => {
      expect(envLine(reportOnly)).toBeUndefined()
    })
  }
})
