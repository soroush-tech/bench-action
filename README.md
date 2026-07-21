# bench-action

Compiled GitHub Action that runs a directory of
[`@soroush.tech/bench`](https://www.npmjs.com/package/@soroush.tech/bench)
`*.bench.ts` files inside the CPU/RAM-pinned Docker sandbox, **fails CI** when
any case drops below a minimum speed ratio vs a baseline case, and posts the
results as a single sticky **PR comment** (updated in place on every push).

Everything is baked in — every release tag carries the bundled runner
(`dist/index.cjs`, built and attached by the Release workflow) and the
vendored sandbox (`vendor/Dockerfile` + `vendor/dist/harness.mjs`), and
GitHub-hosted runners already ship Docker — so consuming it is one step, with
no install, build, or Docker setup (pin a release ref such as `@v1`; `@main`
has no bundle and will not run):

```yaml
jobs:
  bench:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # for the results comment
    steps:
      - uses: actions/checkout@v5
      - uses: soroush-tech/bench-action@v1
        with:
          bench-dir: bench
          baseline-case: previous
          min-ratio: '80'
          rounds: '5'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How the gate works

Each bench file compares named cases (see the bench package's `defineBench`);
one of them — `baseline-case` — is the reference. After a run, every other
case's mean time is compared against it: a case whose speed ratio
(`baseline.avg / case.avg`, as a percent) falls below `min-ratio` fails the
file, and any failed file fails the action. With `min-ratio: '80'`, anything
slower than 1.25× the baseline fails.

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
| `min-ratio`     | yes      | Minimum speed vs the baseline, in percent.                                                              |
| `rounds`        | no       | Median-of-N rounds per suite — recommended on shared runners to cancel noise.                           |
| `cpus`          | no       | Sandbox CPU quota (`docker --cpus`; bench default `1`).                                                 |
| `cpuset`        | no       | CPU pin (`docker --cpuset-cpus`; bench default `0`).                                                    |
| `memory`        | no       | Memory cap (`docker --memory`, swap pinned equal; bench default `512m`).                                |
| `github-token`  | no       | Token for the PR comment. Omit (or run off-PR) and the comment is skipped; the gate still applies.      |

## Outputs

| Output   | Meaning                                                  |
| -------- | -------------------------------------------------------- |
| `report` | The combined markdown report (also the PR comment body). |

## Development

The action runs straight from a release tag's checkout. Neither `dist/` nor
`vendor/` is committed — CI builds both as smoke tests, and the Release
workflow regenerates them (the bundle from the released source, the sandbox
from the pinned `@soroush.tech/bench` devDependency) and layers them onto the
tag's commit, so `main` stays TypeScript-only.

`vendor/` holds `@soroush.tech/bench`'s sandbox `Dockerfile` and its
self-contained harness bundle, copied from the pinned devDependency by
`npm run vendor`. To pick up a new bench release, bump the
`@soroush.tech/bench` version in `package.json` (needs >= 2.1.0), then:

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
