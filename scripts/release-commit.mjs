// Creates the release commit server-side through the git data API: the
// freshly built dist/ and the regenerated vendor/ are layered onto the
// checked-out commit's tree and committed with it as the parent. Both dirs
// are gitignored on main — release tags are the only refs that carry them —
// and going through the API keeps push credentials out of the checkout
// (same reason release.yml moves the floating major tag with `gh api`).
// Prints the new commit SHA and nothing else: the workflow captures stdout
// into $RELEASE_SHA.
import { readFileSync, readdirSync } from 'node:fs'

const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA } = process.env
const message = process.argv[2]
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_SHA || !message) {
  console.error('usage: GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_SHA env vars + commit message argument')
  process.exit(1)
}

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`${method} ${path} failed with ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// Tree paths must stay POSIX (`dist/index.cjs`, `vendor/dist/harness.mjs`)
// even when this runs on Windows, so paths are joined with '/' explicitly.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const tree = []
for (const path of [...walk('dist'), ...walk('vendor')]) {
  const { sha } = await api('POST', 'git/blobs', {
    content: readFileSync(path).toString('base64'),
    encoding: 'base64',
  })
  tree.push({ path, mode: '100644', type: 'blob', sha })
}

const parent = await api('GET', `git/commits/${GITHUB_SHA}`)
const { sha: treeSha } = await api('POST', 'git/trees', { base_tree: parent.tree.sha, tree })
const commit = await api('POST', 'git/commits', { message, tree: treeSha, parents: [GITHUB_SHA] })
// Print only a validated SHA — stdout is captured into $RELEASE_SHA and
// becomes a tag target, so nothing unvalidated may reach it.
const sha = /^[0-9a-f]{40}$/.exec(String(commit.sha))?.[0]
if (sha === undefined) {
  throw new Error('git/commits returned an invalid sha')
}
console.log(sha)
