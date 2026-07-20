// Refreshes vendor/ from an installed @soroush.tech/bench release — the npm
// package ships its sandbox Dockerfile and the self-contained harness bundle
// in `files`. Run after `npm install --no-save '@soroush.tech/bench@latest'`
// (needs >= 2.1.0 for the --baseline-case/--min-ratio/--md-file harness flags),
// then re-run `npm run build` and commit vendor/ (dist/ is gitignored).
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const bench = dirname(require.resolve('@soroush.tech/bench/package.json'))

mkdirSync(join(root, 'vendor', 'dist'), { recursive: true })
copyFileSync(join(bench, 'Dockerfile'), join(root, 'vendor', 'Dockerfile'))
copyFileSync(join(bench, 'dist', 'harness.mjs'), join(root, 'vendor', 'dist', 'harness.mjs'))
console.log('vendor/ refreshed from', bench)
