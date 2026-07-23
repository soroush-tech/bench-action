/** The hosted comment relay (workers/bench in soroush-tech/core) — see its worker.md. */
export const RELAY_URL = 'https://api.bench.soroush.tech/v1/report'
/** Fixed audience the OIDC token is requested with; the relay verifies it. */
export const OIDC_AUDIENCE = 'soroush-bench-action'
/** Deadline for the relay round-trip — a stalled relay must not hold up the fallback. */
export const RELAY_TIMEOUT_MS = 10_000

export interface RelayDeps {
  /** `core.getIDToken` — rejects when the job lacks `id-token: write`. */
  getIDToken: (audience: string) => Promise<string>
  fetch: typeof globalThis.fetch
}

/**
 * Posts the report to the comment relay, which verifies the workflow's OIDC token and
 * upserts the sticky PR comment as the bench bot (branded author). Throws with a readable
 * reason on any failure so the caller can fall back to direct token commenting.
 */
export async function postViaRelay(
  deps: RelayDeps,
  repository: string,
  prNumber: number,
  body: string
): Promise<void> {
  const token = await deps.getIDToken(OIDC_AUDIENCE)
  const res = await deps.fetch(RELAY_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ repository, prNumber, body }),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  })
  if (res.status === 404) {
    throw new Error(`the bench GitHub App is not installed on ${repository}`)
  }
  if (res.status === 401) {
    throw new Error('the relay rejected the OIDC token')
  }
  if (!res.ok) {
    throw new Error(`the relay responded ${res.status}`)
  }
}
