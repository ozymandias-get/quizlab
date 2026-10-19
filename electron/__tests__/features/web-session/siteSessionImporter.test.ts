import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Logger } from '../../../core/logger.js'
import {
  type ExternalBrowserCookie,
  importExternalCookies
} from '../../../features/web-session/siteSessionImporter.js'

const set = vi.fn()
const remove = vi.fn()
const get = vi.fn()

function fakeSession() {
  return { cookies: { set, remove, get }, flushStorageData: vi.fn() } as never
}

const ALLOWED = ['.chatgpt.com']

describe('importExternalCookies', () => {
  beforeEach(() => {
    // Every test starts from a known state: `mockClear` would keep the
    // implementation the previous test left behind.
    set.mockReset().mockResolvedValue({})
    remove.mockReset().mockResolvedValue({})
    get.mockReset().mockResolvedValue([])
  })

  it('writes every allowed cookie into the target session', async () => {
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }],
      ALLOWED
    )
    expect(result.imported).toBe(1)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toMatchObject({
      name: 'session',
      value: 'v',
      url: 'https://chatgpt.com/'
    })
  })

  it('never writes a cookie whose domain is outside the target', async () => {
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'leak', value: 'v', domain: '.claude.ai' }],
      ALLOWED
    )
    expect(result.imported).toBe(0)
    expect(set).not.toHaveBeenCalled()
  })

  it('removes a stale cookie of the same target that is no longer sent', async () => {
    get.mockResolvedValue([{ name: 'old', domain: '.chatgpt.com', path: '/', secure: true }])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(remove).toHaveBeenCalled()
  })

  it('leaves the cookies of another site untouched', async () => {
    get.mockResolvedValue([{ name: 'other', domain: '.claude.ai', path: '/', secure: true }])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    // The stale cleanup may only touch the domains of the site being imported.
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the host-only cookie it just wrote', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: 'chatgpt.com', path: '/', secure: true, hostOnly: true }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: 'chatgpt.com' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the domain-wide cookie it just wrote when the packet carries no path', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: '.chatgpt.com', path: '/', secure: true, hostOnly: false }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
  })

  it('removes the domain-wide cookie the browser turned into a host-only one', async () => {
    // The session holds a domain-wide cookie, the browser now sends a
    // host-only cookie of the same name: two different cookies, and the
    // domain-wide one is stale.
    get.mockResolvedValue([
      { name: 'session', domain: '.chatgpt.com', path: '/', secure: true, hostOnly: false }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: 'chatgpt.com' }],
      ALLOWED
    )
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
  })

  it('removes the host-only cookie the browser turned into a domain-wide one', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: 'chatgpt.com', path: '/', secure: true, hostOnly: true }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
  })

  it('keeps a cookie whose scope the session does not report', async () => {
    // Without the flag the two scopes cannot be told apart: the cookie is
    // kept rather than deleting a session the user may still need.
    get.mockResolvedValue([{ name: 'session', domain: '.chatgpt.com', path: '/', secure: true }])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: 'chatgpt.com' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
  })

  it('never deletes anything when the packet carries no cookie of the site', async () => {
    get.mockResolvedValue([{ name: 'old', domain: '.chatgpt.com', path: '/', secure: true }])
    const result = await importExternalCookies(fakeSession(), [], ALLOWED)
    expect(result).toEqual({ imported: 0, failed: 0 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('never deletes anything when the packet carries only foreign domains', async () => {
    get.mockResolvedValue([{ name: 'old', domain: '.chatgpt.com', path: '/', secure: true }])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'leak', value: 'v', domain: '.claude.ai' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the session when every write was rejected', async () => {
    // The session holds a cookie the browser no longer sends, and the packet's
    // own cookie cannot be written. The stale cleanup must not run: the user
    // would end up signed out with nothing imported.
    get.mockResolvedValue([
      { name: 'old', domain: '.chatgpt.com', path: '/', secure: true, hostOnly: false }
    ])
    set.mockRejectedValue(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )

    expect(result).toEqual({ imported: 0, failed: 1 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the cookie whose write was rejected while the others are written', async () => {
    get.mockResolvedValue([
      { name: 'broken', domain: '.chatgpt.com', path: '/', secure: true, hostOnly: false }
    ])
    set.mockRejectedValueOnce(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [
        { name: 'broken', value: 'v', domain: '.chatgpt.com' },
        { name: 'good', value: 'v', domain: '.chatgpt.com' }
      ],
      ALLOWED
    )

    expect(result).toEqual({ imported: 1, failed: 1 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('counts a rejected cookie as failed and imports the rest', async () => {
    set.mockRejectedValueOnce(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [
        { name: 'first', value: 'v', domain: '.chatgpt.com' },
        { name: 'second', value: 'v', domain: '.chatgpt.com' }
      ],
      ALLOWED
    )

    expect(result).toEqual({ imported: 1, failed: 1 })
  })

  it('keeps a host-only cookie host-only and scopes a domain cookie', async () => {
    const cookies: ExternalBrowserCookie[] = [
      { name: 'host', value: 'v', domain: 'chatgpt.com' },
      { name: 'wide', value: 'v', domain: '.chatgpt.com' }
    ]

    await importExternalCookies(fakeSession(), cookies, ALLOWED)

    const payloads = set.mock.calls.map((call) => call[0] as Record<string, unknown>)
    expect(payloads[0].domain).toBeUndefined()
    expect(payloads[1].domain).toBe('.chatgpt.com')
  })

  it('derives the scheme of the cookie from its secure flag', async () => {
    await importExternalCookies(
      fakeSession(),
      [{ name: 'plain', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(set.mock.calls[0][0]).toMatchObject({ url: 'http://chatgpt.com/' })
  })

  it('normalises a millisecond expiry to seconds and keeps a second expiry', async () => {
    await importExternalCookies(
      fakeSession(),
      [
        { name: 'ms', value: 'v', domain: '.chatgpt.com', expires: 1800000000000 },
        { name: 's', value: 'v', domain: '.chatgpt.com', expires: 1800000000 }
      ],
      ALLOWED
    )

    const payloads = set.mock.calls.map((call) => call[0] as Record<string, unknown>)
    expect(payloads[0].expirationDate).toBe(1800000000)
    expect(payloads[1].expirationDate).toBe(1800000000)
  })

  it('writes a cookie of a subdomain of an allowed domain', async () => {
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: 'mail.chatgpt.com' }],
      ALLOWED
    )
    expect(result.imported).toBe(1)
  })

  it('never writes a cookie of a domain that only looks like an allowed one', async () => {
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'leak', value: 'v', domain: '.notchatgpt.com' }],
      ALLOWED
    )
    expect(result.imported).toBe(0)
    expect(set).not.toHaveBeenCalled()
  })

  it('logs the cookies it refuses to write', async () => {
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => {})

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: '', value: 'super-secret-value', domain: '.chatgpt.com' }],
      ALLOWED
    )

    // The refusal is not a rejected write, but it must not vanish either.
    expect(result).toEqual({ imported: 0, failed: 0 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('.chatgpt.com')
    expect(warn.mock.calls[0][0]).not.toContain('super-secret-value')
  })

  it('does not log the cookies of another site', async () => {
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => {})

    await importExternalCookies(
      fakeSession(),
      [{ name: '', value: 'super-secret-value', domain: '.claude.ai' }],
      ALLOWED
    )

    expect(warn).not.toHaveBeenCalled()
  })
})
