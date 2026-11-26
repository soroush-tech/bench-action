# bench-action

Compiled GitHub Action that runs a directory of
[`@soroush.tech/bench`](https://www.npmjs.com/package/@soroush.tech/bench)
`*.bench.ts` files inside the CPU/RAM-pinned Docker sandbox, **fails CI** when
any case drops below a minimum speed ratio vs a baseline case, and posts the
results as a single sticky **PR comment** (updated in place on every push)
and in the run's **job summary**.
Listed on the GitHub Marketplace as
**[soroush-bench](https://github.com/marketplace/actions/soroush-bench)** —
the same name as the [bench GitHub App](https://github.com/apps/soroush-bench)
that brands its PR comments.

Everything is baked in — every release tag carries the bundled runner
(`dist/index.cjs`, built and attached by the Release workflow) and the
vendored sandbox (`vendor/Dockerfile` + `vendor/dist/harness.mjs`), and
GitHub-hosted runners already ship Docker — so consuming it is one step, with
no install, build, or Docker setup (pin a release ref such as `@v1`; `@main`
has no bundle and will not run). The action declares the `node24` runtime:
any GitHub-hosted runner qualifies; self-hosted runners need a version recent
enough to ship node24.

```yaml
jobs:
  bench:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # for the results comment
      id-token: write # for the branded (bench bot) comment; optional
    steps:
      - uses: actions/checkout@v5
      - uses: soroush-tech/bench-action@v1
        with:
          bench-dir: bench
          baseline-case: previous
          min-ratio: '80'
          rounds: '5'
```

The results comment needs no token setup. With the [bench GitHub App](https://github.com/apps/soroush-bench)
installed on the repo and `id-token: write` granted (as above), the comment is
posted **as the bench bot** (branded author) through the hosted relay at
`api.bench.soroush.tech`. Without either, it falls back automatically to the
workflow's runtime token (author `github-actions[bot]`, needs
`pull-requests: write`). Pass `github-token` only to override the fallback: a
GitHub App token of your own, or `''` to skip commenting entirely; set
`branded: 'false'` to never use the relay. Fork PRs get no `id-token`
permission, so they always take the fallback path — and the gate verdict is
never affected by any comment failure.

## How the gate works

Each bench file compares named cases (see the bench package's `defineBench`);
one of them — `baseline-case` — is the reference. After a run, every other
case's mean time is compared against it: a case whose speed ratio
(`baseline.avg / case.avg`, as a percent) falls below `min-ratio` fails the
file, and any failed file fails the action. With `min-ratio: '80'`, anything
slower than 1.25× the baseline fails.

### Reporting without a gate

Leave `min-ratio` out and the action reports the ratios without failing on
them - for a release run, say, which compares versions but must never fail on
speed. Only a run that crashed, or one that left no results to compare (e.g. a
`baseline-case` that matches no case), still fails the job. With no pull
request there is no comment; the report goes to the job summary, which every
run writes, and to the `report` output:

```yaml
on:
  release:
    types: [published]

jobs:
  bench:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v5
      - uses: soroush-tech/bench-action@v1
        with:
          bench-dir: bench
          baseline-case: previous
          rounds: '5'
```

### What produced the numbers

Under its head line, the report names the bench version, Node version and
sandbox limits the numbers came from, for example
`soroush-bench 2.4.0 · node v24.22.3 · cpus 1 · cpuset 0 · memory 512m`. Two
reports are comparable when this line matches.

To gate against "the last published version of my package", declare the
baseline via npm's `latest` dist-tag inside the bench file — no version lookup
step needed:

```ts
import { color } from '@soroush.tech/styled-system/color' // local source
import defineBench from '@soroush.tech/bench'

export default defineBench({
  name: 'styled-system color()',
  packages: { previous: '@soroush.tech/styled-system@latest' },
  cases: {
    local: () => color(props),
    previous: ({ modules }) => (modules.previous as ColorModule).color(props),
  },
})
```

## Inputs

| Input           | Required | Meaning                                                                                                 |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `bench-dir`     | yes      | Directory of `*.bench.ts` files, relative to the workspace root.                                        |
| `files`         | no       | Newline- or comma-separated subset (names with or without `.bench.ts`) to run instead of the whole dir. |
| `baseline-case` | yes      | Case key every other case is compared against (matched like the bench CLI's `--baseline-case`).         |
| `min-ratio`     | no       | Minimum speed vs the baseline, in percent. Empty (the default) reports without a gate.                  |
| `rounds`        | no       | Median-of-N rounds per suite — recommended on shared runners to cancel noise.                           |
| `cpus`          | no       | Sandbox CPU quota (`docker --cpus`; bench default `1`).                                                 |
| `cpuset`        | no       | CPU pin (`docker --cpuset-cpus`; bench default `0`).                                                    |
| `memory`        | no       | Memory cap (`docker --memory`, swap pinned equal; bench default `512m`).                                |
| `comment-details` | no   | Default `collapsed`: each file's own table sits in a closed `<details>` under the summary. `open` shows them expanded, `none` leaves them out. |
| `comment-title` | no       | Default `Benchmark results`. Any other title gets its own marker, so two jobs on one PR (e.g. Node and browser benches) keep separate comments. |
| `branded`       | no       | Default `'true'`: comment as the bench bot via the relay when the app + `id-token: write` allow it; otherwise fall back. `'false'` disables the relay. |
| `github-token`  | no       | Fallback token for the PR comment; defaults to the runtime `github.token`. Pass `''` to skip commenting; off-PR runs skip it anyway. The gate always applies. |

## Outputs

| Output   | Meaning                                                  |
| -------- | -------------------------------------------------------- |
| `report` | The combined markdown report (also the PR comment body and the job summary). |

## Development

The action runs straight from a release tag's checkout. Neither `dist/` nor
`vendor/` is committed — CI builds both as smoke tests, and the Release
workflow regenerates them (the bundle from the released source, the sandbox
from the pinned `@soroush.tech/bench` devDependency) and layers them onto the
tag's commit, so `main` stays TypeScript-only.

`vendor/` holds `@soroush.tech/bench`'s sandbox `Dockerfile` and its
self-contained harness bundle, copied from the pinned devDependency by
`npm run vendor`. To pick up a new bench release, bump the
`@soroush.tech/bench` version in `package.json` (needs >= 2.3.0), then:

```sh
npm install
npm run vendor
```

The small sandbox-driving modules in `src/sandbox/` mirror bench's
`docker.ts`/`cli.ts` — diff them against the new release when re-vendoring.

Bench-file `options.sandbox` defaults are **not** read by the action (that is
a host-CLI convenience); sandbox settings come from the inputs above.

## Releasing

Releases are cut by the manual **Release** workflow (dispatch from `main`
only), mirroring the monorepo's package flow: bump `version` in
`package.json`, add the matching human-written `release-notes/<version>.md`,
merge to `main`, then dispatch. The workflow builds `dist/` from the released
source and `vendor/` from the pinned bench package, creates a release commit
carrying both on top of `main`'s head, tags `v<version>` on that commit +
GitHub Release with the notes file verbatim, and force-moves the floating
`v1` major tag consumers pin in `uses:` onto the same commit. Never hand-push
release tags.

The **first** GitHub Marketplace listing is a one-time manual step (edit the
release in the web UI, tick "Publish this Action to the GitHub Marketplace",
pick a category — requires 2FA); once listed, subsequent releases appear on
the listing automatically.

## Support & privacy

Bugs and questions → [GitHub Issues](https://github.com/soroush-tech/bench-action/issues)
or **support@soroush.tech**.

Privacy: see [PRIVACY.md](./PRIVACY.md) — in short, the action runs in your
workflow, and the optional branded-comment relay keeps no application or
database storage of your data (PRIVACY.md details what it receives and how
long operational logs are retained).
