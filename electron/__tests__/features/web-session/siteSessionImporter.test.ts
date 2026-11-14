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

  it('reports a failed stale-cookie cleanup as an incomplete import', async () => {
    get.mockResolvedValue([{ name: 'old', domain: '.chatgpt.com', path: '/', secure: true }])
    remove.mockRejectedValueOnce(new Error('unavailable'))
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(result).toEqual({ imported: 1, failed: 1 })
  })

  it('reports a failure when existing cookies cannot be inspected', async () => {
    get.mockRejectedValue(new Error('unavailable'))
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(result).toEqual({ imported: 1, failed: 1 })
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

  it('removes the stale namesake under a different domain', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: '.openai.com', path: '/', secure: true, hostOnly: false }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ['.chatgpt.com', '.openai.com']
    )
    expect(remove).toHaveBeenCalledWith('https://openai.com/', 'session')
  })

  it('removes the stale namesake under a non-overlapping path', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: '.chatgpt.com', path: '/a', secure: true, hostOnly: false }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com', path: '/b' }],
      ALLOWED
    )
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/a', 'session')
  })

  it('restores the previous cookies when a rollback-enabled import fails part-way', async () => {
    const previous = {
      name: 'old-session',
      value: 'old',
      domain: '.chatgpt.com',
      path: '/',
      secure: true,
      hostOnly: false
    }
    get.mockResolvedValue([previous])
    set.mockRejectedValueOnce(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [
        { name: 'broken', value: 'v', domain: '.chatgpt.com' },
        { name: 'good', value: 'v', domain: '.chatgpt.com' }
      ],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({ rolledBack: true, rollbackFailed: false })
    // The snapshot is written back after the failed import.
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: 'old-session', value: 'old' }))
  })

  it('fails closed when a rollback-enabled import cannot snapshot the target', async () => {
    get.mockRejectedValue(new Error('unavailable'))

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({ imported: 0, rolledBack: true, rollbackFailed: true })
    expect(set).not.toHaveBeenCalled()
  })

  it('restores the snapshot when stale-cookie cleanup fails', async () => {
    get.mockResolvedValue([
      {
        name: 'old-session',
        value: 'old',
        domain: '.chatgpt.com',
        path: '/',
        secure: true,
        hostOnly: false
      }
    ])
    remove.mockRejectedValue(new Error('remove failed'))

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({
      imported: 1,
      failed: 1,
      rolledBack: true,
      rollbackFailed: false
    })
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: 'old-session', value: 'old' }))
  })

  it('treats a failed final rollback flush as an unsuccessful rollback', async () => {
    const previous = {
      name: 'old-session',
      value: 'old',
      domain: '.chatgpt.com',
      path: '/',
      secure: true,
      hostOnly: false
    }
    get.mockResolvedValue([previous])
    set.mockRejectedValueOnce(new Error('rejected'))
    const session = {
      cookies: { set, remove, get },
      // The snapshot import flushes first; the final rollback flush fails.
      flushStorageData: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('disk full'))
    } as never

    const result = await importExternalCookies(
      session,
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({
      rolledBack: true,
      rollbackFailed: true,
      flushFailed: true
    })
  })

  it('separates a disk flush failure from a successful cookie write', async () => {
    const session = {
      cookies: { set, remove, get },
      flushStorageData: vi.fn().mockRejectedValue(new Error('disk full'))
    } as never

    const result = await importExternalCookies(
      session,
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )

    expect(result).toMatchObject({ imported: 1, failed: 0, flushFailed: true })
  })

  it('reports a rollback failure when the restored value does not match the snapshot', async () => {
    const previous = {
      name: 'old-session',
      value: 'old',
      domain: '.chatgpt.com',
      path: '/',
      secure: true,
      hostOnly: false
    }
    get
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([{ ...previous, value: 'tampered' }])
    set.mockRejectedValueOnce(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({ rolledBack: true, rollbackFailed: true })
  })

  it('reports a failed rollback when restoring the snapshot also fails', async () => {
    get.mockResolvedValue([
      {
        name: 'old-session',
        value: 'old',
        domain: '.chatgpt.com',
        path: '/',
        secure: true,
        hostOnly: false
      }
    ])
    set.mockRejectedValue(new Error('rejected'))

    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED,
      { rollbackOnPartialFailure: true }
    )

    expect(result).toMatchObject({ rolledBack: true, rollbackFailed: true })
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

  it('does not remove a newly imported host-only cookie while cleaning a namesake', async () => {
    // The session holds a domain-wide cookie, the browser now sends a
    // host-only cookie of the same name: two different cookies, and the
    // domain-wide one is stale.
    get.mockResolvedValue([
      { name: 'session', domain: '.chatgpt.com', path: '/', secure: true, hostOnly: false }
    ])
    const result = await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: 'chatgpt.com' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
    // The safety rule keeps the stale cookie, but the import says so instead
    // of pretending the session is an exact mirror of the browser.
    expect(result).toMatchObject({ imported: 1, failed: 0, staleCookiesKept: 1 })
  })

  it('does not remove a newly imported domain cookie while cleaning a namesake', async () => {
    get.mockResolvedValue([
      { name: 'session', domain: 'chatgpt.com', path: '/', secure: true, hostOnly: true }
    ])
    await importExternalCookies(
      fakeSession(),
      [{ name: 'session', value: 'v', domain: '.chatgpt.com' }],
      ALLOWED
    )
    expect(remove).not.toHaveBeenCalled()
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

  it('does not clean any stale cookies when an import is partial', async () => {
    get.mockResolvedValue([{ name: 'old', domain: '.chatgpt.com', path: '/', secure: true }])
    set.mockRejectedValueOnce(new Error('rejected'))
    await importExternalCookies(
      fakeSession(),
      [
        { name: 'broken', value: 'v', domain: '.chatgpt.com' },
        { name: 'good', value: 'v', domain: '.chatgpt.com' }
      ],
      ALLOWED
    )
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

    expect(result).toEqual({ imported: 0, failed: 1 })
    expect(warn).toHaveBeenCalledTimes(2)
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

  describe('cookies with the same identity', () => {
    it('writes one cookie when the packet carries the same identity twice', async () => {
      const result = await importExternalCookies(
        fakeSession(),
        [
          { name: 'session', value: 'first', domain: '.chatgpt.com' },
          { name: 'session', value: 'second', domain: '.chatgpt.com' }
        ],
        ALLOWED
      )

      // Two concurrent writes of one identity would race inside the cookie
      // store; the last value of the packet is the one a jar would keep.
      expect(set).toHaveBeenCalledTimes(1)
      expect(set.mock.calls[0][0]).toMatchObject({ name: 'session', value: 'second' })
      expect(result).toMatchObject({ imported: 1, failed: 0, duplicatesDropped: 1 })
    })

    it('treats the same name under a different path as a different cookie', async () => {
      const result = await importExternalCookies(
        fakeSession(),
        [
          { name: 'session', value: 'root', domain: '.chatgpt.com', path: '/' },
          { name: 'session', value: 'sub', domain: '.chatgpt.com', path: '/app' }
        ],
        ALLOWED
      )

      expect(set).toHaveBeenCalledTimes(2)
      expect(result).toMatchObject({ imported: 2, failed: 0 })
      expect(result.duplicatesDropped).toBeUndefined()
    })

    it('treats a host-only and a domain-wide cookie as two cookies', async () => {
      await importExternalCookies(
        fakeSession(),
        [
          { name: 'session', value: 'host', domain: 'chatgpt.com' },
          { name: 'session', value: 'wide', domain: '.chatgpt.com' }
        ],
        ALLOWED
      )

      expect(set).toHaveBeenCalledTimes(2)
      const payloads = set.mock.calls.map((call) => call[0] as Record<string, unknown>)
      expect(payloads[0].domain).toBeUndefined()
      expect(payloads[1].domain).toBe('.chatgpt.com')
    })

    it('treats the same name and path with another secure flag as one identity', async () => {
      // The secure flag is not part of a cookie's identity in the jar: the two
      // entries would target the same row, so only the last one may be written.
      const result = await importExternalCookies(
        fakeSession(),
        [
          { name: 'session', value: 'plain', domain: '.chatgpt.com', secure: false },
          { name: 'session', value: 'secure', domain: '.chatgpt.com', secure: true }
        ],
        ALLOWED
      )

      expect(set).toHaveBeenCalledTimes(1)
      expect(set.mock.calls[0][0]).toMatchObject({ value: 'secure', secure: true })
      expect(result).toMatchObject({ imported: 1, duplicatesDropped: 1 })
    })
  })

  describe('the persistence of an import', () => {
    /**
     * A session with a cookie jar a test can inspect.
     *
     * `failFlush` makes the first N flush calls fail, which is how a disk that
     * cannot accept the write is simulated.
     */
    function jarSession(options: { failFlush?: number } = {}) {
      const jar = new Map<
        string,
        {
          name: string
          value: string
          domain: string
          path: string
          secure: boolean
          hostOnly: boolean
          httpOnly: boolean
          sameSite: string
          expirationDate?: number
        }
      >()
      let flushCalls = 0
      const identity = (host: string, name: string, cookiePath: string, hostOnly: boolean) =>
        `${host}::${name}::${cookiePath}::${hostOnly ? 'host' : 'domain'}`
      const session = {
        cookies: {
          set: async (payload: {
            url: string
            name: string
            value: string
            domain?: string
            path?: string
            secure?: boolean
            httpOnly?: boolean
            sameSite?: string
            expirationDate?: number
          }) => {
            const host = (payload.domain ?? new URL(payload.url).hostname).replace(/^\.+/, '')
            const hostOnly = !payload.domain
            jar.set(identity(host, payload.name, payload.path || '/', hostOnly), {
              name: payload.name,
              value: payload.value,
              domain: payload.domain ?? host,
              path: payload.path || '/',
              secure: payload.secure === true,
              hostOnly,
              httpOnly: payload.httpOnly === true,
              sameSite: payload.sameSite ?? 'unspecified',
              expirationDate: payload.expirationDate
            })
            return {}
          },
          get: async () => [...jar.values()],
          remove: async (url: string, name: string) => {
            const parsed = new URL(url)
            const host = parsed.hostname
            for (const [key, cookie] of jar) {
              if (cookie.name !== name) continue
              if (cookie.domain.replace(/^\.+/, '') !== host) continue
              if (!parsed.pathname.startsWith(cookie.path)) continue
              jar.delete(key)
            }
            return {}
          }
        },
        flushStorageData: async () => {
          flushCalls += 1
          if (options.failFlush !== undefined && flushCalls <= options.failFlush) {
            throw new Error('disk full')
          }
        }
      }
      return { session: session as never, jar }
    }

    const PREVIOUS = {
      name: 'old-session',
      value: 'old',
      domain: '.chatgpt.com',
      path: '/',
      secure: true,
      hostOnly: false,
      httpOnly: true,
      sameSite: 'lax'
    }

    it('restores and flushes the previous jar when the import cannot be flushed', async () => {
      const { session, jar } = jarSession({ failFlush: 1 })
      jar.set('chatgpt.com::old-session::/::domain', { ...PREVIOUS })

      const result = await importExternalCookies(
        session,
        [{ name: 'session', value: 'new', domain: '.chatgpt.com', secure: true }],
        ALLOWED,
        { rollbackOnPartialFailure: true }
      )

      // The write reached the store but not the disk, so it was undone; the
      // restarted app has to load the state the user had before.
      expect(result).toMatchObject({
        rolledBack: true,
        rollbackFailed: false,
        flushFailed: true
      })
      expect([...jar.keys()]).toEqual(['chatgpt.com::old-session::/::domain'])
      expect(jar.get('chatgpt.com::old-session::/::domain')?.value).toBe('old')
    })

    it('reports a rollback that could not be flushed as unverified', async () => {
      const { session, jar } = jarSession({ failFlush: Number.MAX_SAFE_INTEGER })
      jar.set('chatgpt.com::old-session::/::domain', { ...PREVIOUS })

      const result = await importExternalCookies(
        session,
        [{ name: 'session', value: 'new', domain: '.chatgpt.com', secure: true }],
        ALLOWED,
        { rollbackOnPartialFailure: true }
      )

      // Neither the import nor the restore is on disk: the caller has to treat
      // the session as unverified (quarantine) instead of retrying blindly.
      expect(result).toMatchObject({
        rolledBack: true,
        rollbackFailed: true,
        flushFailed: true
      })
    })

    it('reports a durable import as a success', async () => {
      const { session, jar } = jarSession()
      jar.set('chatgpt.com::old-session::/::domain', { ...PREVIOUS })

      const result = await importExternalCookies(
        session,
        [{ name: 'session', value: 'new', domain: '.chatgpt.com', secure: true }],
        ALLOWED,
        { rollbackOnPartialFailure: true }
      )

      expect(result).toMatchObject({ imported: 1, failed: 0 })
      expect(result.flushFailed).toBeUndefined()
      expect([...jar.keys()]).toEqual(['chatgpt.com::session::/::domain'])
    })
  })
})
