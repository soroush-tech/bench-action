# Privacy

**The action** runs inside your workflow. In its default (non-branded) mode,
your code and benchmark results never leave your runner except as the PR
comment the action posts to your own repository through the GitHub API.

**The branded comment relay** is the one case where data is transmitted off
the runner: when the [bench GitHub App](https://github.com/apps/soroush-bench)
is installed and `id-token: write` is granted, the action sends per request to
`api.bench.soroush.tech` your repository name, the pull-request number, the
rendered results markdown, and your workflow's GitHub-issued OIDC token. The
token is verified against GitHub's public keys and used only to authorize the
request; the report is used only to post or update the PR comment via the
GitHub API. **The relay is stateless in the sense that it keeps no application
or database storage of your data** — nothing is written anywhere by the relay
itself. Operational request logs (request metadata, not stored copies of your
reports) are retained briefly by our hosting provider (Cloudflare Workers) for
debugging and abuse prevention.

We do not sell, share, or retain your data beyond the above. Uninstalling the
bench GitHub App or omitting `id-token: write` stops all relay traffic
immediately — the action then comments directly using your workflow's own
token, or not at all.

Questions: open an issue on this repository or email
**support@soroush.tech**.
