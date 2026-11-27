// Refreshes vendor/ from the pinned @soroush.tech/bench devDependency — the
// npm package ships its sandbox Dockerfile and the self-contained harness
// bundle in `files`. Re-vendoring = bumping the devDependency version and
// re-running `npm install && npm run vendor`. The package root is addressed
// via node_modules directly: the published `exports` map does not expose
// ./package.json, so require.resolve cannot reach it.
//
// `npm run vendor -- <dir>` vendors from an unpacked bench tarball instead,
// which the E2E workflow uses to run the action on other bench versions.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIN_BENCH, atLeast } from './versions.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bench = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, 'node_modules', '@soroush.tech', 'bench')

if (!existsSync(join(bench, 'Dockerfile'))) {
  console.error(`vendor: no bench package at ${bench} — run \`npm install\` first, or pass an unpacked bench tarball.`)
  process.exit(1)
}

// An older harness lacks what the action relies on: before 2.3.0 it ignores
// --json-file, so every file would report no results (as v1.2.0 shipped).
const { version } = JSON.parse(readFileSync(join(bench, 'package.json'), 'utf8'))
if (!atLeast(version, MIN_BENCH)) {
  console.error(
    `vendor: @soroush.tech/bench ${version} is older than ${MIN_BENCH}, the oldest the action supports (benchAction.minBench).`
  )
  process.exit(1)
}
const harness = join(bench, 'dist', 'harness.mjs')

mkdirSync(join(root, 'vendor', 'dist'), { recursive: true })
copyFileSync(join(bench, 'Dockerfile'), join(root, 'vendor', 'Dockerfile'))
copyFileSync(harness, join(root, 'vendor', 'dist', 'harness.mjs'))
console.log('vendor/ refreshed from', bench)
