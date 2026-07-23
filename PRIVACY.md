# Privacy

**The action** runs entirely inside your workflow. Your code and benchmark
results never leave your runner except as the PR comment posted to your own
repository.

**The branded comment relay** (`api.bench.soroush.tech`, used only when the
[bench GitHub App](https://github.com/apps/soroush-bench) is installed and
`id-token: write` is granted) receives per request: your repository name, the
pull-request number, the rendered results markdown, and your workflow's
GitHub-issued OIDC token. The token is verified against GitHub's public keys
and used only to authorize the request; the report is used only to post or
update the PR comment via the GitHub API. **The relay is stateless — nothing
is stored in any database.** Operational request logs are retained briefly by
our hosting provider (Cloudflare Workers) for debugging and abuse prevention.

We do not sell, share, or retain your data beyond the above. Uninstalling the
bench GitHub App or omitting `id-token: write` stops all relay traffic
immediately — the action then comments directly using your workflow's own
token, or not at all.

Questions: open an issue on this repository or email
**support@soroush.tech**.
