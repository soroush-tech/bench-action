import { describe, it, expect, vi } from 'vitest'
import { OIDC_AUDIENCE, RELAY_URL, postViaRelay } from './relay'

const deps = (status = 200, getIDToken = vi.fn(async () => 'oidc-jwt')) => {
  const fetch = vi.fn(async () => new Response('{}', { status }))
  return { deps: { getIDToken, fetch: fetch as unknown as typeof globalThis.fetch }, fetch }
}

describe('postViaRelay', () => {
  it('posts the report with the OIDC token as bearer auth', async () => {
    const { deps: d, fetch } = deps()

    await postViaRelay(d, 'o/r', 5, 'the report')

    expect(d.getIDToken).toHaveBeenCalledWith(OIDC_AUDIENCE)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(RELAY_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer oidc-jwt')
    expect(JSON.parse(init.body as string)).toEqual({
      repository: 'o/r',
      prNumber: 5,
      body: 'the report',
    })
  })

  it('names the missing app installation on a 404', async () => {
    const { deps: d } = deps(404)
    await expect(postViaRelay(d, 'o/r', 5, 'x')).rejects.toThrow(
      'the bench GitHub App is not installed on o/r'
    )
  })

  it('reports a rejected OIDC token on a 401', async () => {
    const { deps: d } = deps(401)
    await expect(postViaRelay(d, 'o/r', 5, 'x')).rejects.toThrow(
      'the relay rejected the OIDC token'
    )
  })

  it('reports any other non-2xx status', async () => {
    const { deps: d } = deps(502)
    await expect(postViaRelay(d, 'o/r', 5, 'x')).rejects.toThrow('the relay responded 502')
  })

  it('propagates a getIDToken failure (missing id-token permission)', async () => {
    const { deps: d } = deps(200, vi.fn(async () => Promise.reject(new Error('no permission'))))
    await expect(postViaRelay(d, 'o/r', 5, 'x')).rejects.toThrow('no permission')
  })
})
