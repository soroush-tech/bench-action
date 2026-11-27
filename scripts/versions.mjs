// The bench versions the action supports, in one place: vendor.mjs refuses a
// pin older than MIN_BENCH, and the E2E workflow runs it as its oldest row.
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** The oldest bench whose harness the action works with (`benchAction.minBench`). */
export const MIN_BENCH = pkg.benchAction.minBench

/** The bench the next release vendors: the pinned devDependency. */
export const PINNED_BENCH = pkg.devDependencies['@soroush.tech/bench']

/** Whether `version` is `min` or newer; both are plain `x.y.z`. */
export function atLeast(version, min) {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return true
}
