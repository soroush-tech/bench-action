// Creates the release commit server-side through the git data API: the
// freshly built dist/ is layered onto the checked-out commit's tree and
// committed with it as the parent. dist/ is gitignored on main — release
// tags are the only refs that carry it — and going through the API keeps
// push credentials out of the checkout (same reason release.yml moves the
// floating major tag with `gh api`). Prints the new commit SHA and nothing
// else: the workflow captures stdout into $RELEASE_SHA.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

// esbuild writes flat files into dist/ — no recursion needed.
const tree = []
for (const name of readdirSync('dist')) {
  const { sha } = await api('POST', 'git/blobs', {
    content: readFileSync(join('dist', name)).toString('base64'),
    encoding: 'base64',
  })
  tree.push({ path: `dist/${name}`, mode: '100644', type: 'blob', sha })
}

const parent = await api('GET', `git/commits/${GITHUB_SHA}`)
const { sha: treeSha } = await api('POST', 'git/trees', { base_tree: parent.tree.sha, tree })
const commit = await api('POST', 'git/commits', { message, tree: treeSha, parents: [GITHUB_SHA] })
console.log(commit.sha)
