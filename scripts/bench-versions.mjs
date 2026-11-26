// Prints the E2E matrix as step outputs: the bench versions to run the built
// action against - the oldest supported, the pinned one (what the next release
// ships) and the latest on npm (what the next re-vendor would ship) - without
// duplicates. Usage: node scripts/bench-versions.mjs >> "$GITHUB_OUTPUT"
import { MIN_BENCH, PINNED_BENCH } from './versions.mjs'

const response = await fetch('https://registry.npmjs.org/@soroush.tech%2fbench/latest')
if (!response.ok) throw new Error(`bench-versions: the npm registry answered ${response.status}`)
const { version: latest } = await response.json()

console.log(`matrix=${JSON.stringify([...new Set([MIN_BENCH, PINNED_BENCH, latest])])}`)
console.log(`pinned=${PINNED_BENCH}`)
