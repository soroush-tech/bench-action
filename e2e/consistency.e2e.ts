// After every matrix row passed: the fixture must give the same answer on
// every bench version. Timings differ between runners, so the check is on
// what a gate decides from them - the verdict at the gate's minimum, the
// order of the cases - plus a loose band around the pinned version's ratios.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { summaryRows } from './report'

const { E2E_OUT = 'e2e-out', PINNED } = process.env
if (PINNED === undefined) throw new Error('e2e: set PINNED to the bench version the others are compared with')

/** The minimum speed ratio the gate run used, in percent. */
const MIN_RATIO = 80
/** How far a ratio may be from the pinned version's, as a fraction of it. */
const BAND = 0.25

const rowsOf = (version: string) =>
  summaryRows(readFileSync(join(E2E_OUT, version, 'report-only.md'), 'utf8'))

const versions = readdirSync(E2E_OUT).filter((version) => version !== PINNED)
const pinned = rowsOf(PINNED)

describe.each(versions)(`bench %s, against the pinned ${PINNED}`, (version) => {
  const rows = rowsOf(version)

  it('puts the cases in the same order', () => {
    expect(rows.map(({ label }) => label)).toEqual(pinned.map(({ label }) => label))
  })

  it(`gives every case the same verdict at ${MIN_RATIO}%`, () => {
    const verdicts = (list: typeof rows) =>
      list.map(({ label, ratioPct }) => [label, (ratioPct as number) < MIN_RATIO])
    expect(verdicts(rows)).toEqual(verdicts(pinned))
  })

  it.each(pinned.map(({ label, ratioPct }) => [label, ratioPct as number] as const))(
    `keeps %s within ±${BAND * 100}% of its pinned ratio (%s%)`,
    (label, expected) => {
      const actual = rows.find((row) => row.label === label)?.ratioPct as number
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(expected * BAND)
    }
  )
})
