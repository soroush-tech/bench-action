// Refreshes vendor/ from the pinned @soroush.tech/bench devDependency — the
// npm package ships its sandbox Dockerfile and the self-contained harness
// bundle in `files`. Re-vendoring = bumping the devDependency version and
// re-running `npm install && npm run vendor`. The package root is addressed
// via node_modules directly: the published `exports` map does not expose
// ./package.json, so require.resolve cannot reach it.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bench = join(root, 'node_modules', '@soroush.tech', 'bench')

if (!existsSync(join(bench, 'Dockerfile'))) {
  console.error('vendor: @soroush.tech/bench is not installed — run `npm install` first.')
  process.exit(1)
}

mkdirSync(join(root, 'vendor', 'dist'), { recursive: true })
copyFileSync(join(bench, 'Dockerfile'), join(root, 'vendor', 'Dockerfile'))
copyFileSync(join(bench, 'dist', 'harness.mjs'), join(root, 'vendor', 'dist', 'harness.mjs'))
console.log('vendor/ refreshed from', bench)
