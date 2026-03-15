import { describe, expect, it, vi } from 'vitest'
import { importExternalCookies } from '../../../features/gemini-web-session/sessionCookies'

function createMockSession() {
  return {
    cookies: {
      get: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined)
    },
    flushStorageData: vi.fn()
  }
}

describe('gemini web session cookie import', () => {
  it('preserves host-only cookies by omitting domain', async () => {
    const session = createMockSession()

    await importExternalCookies(session as never, [
      {
        name: 'SID',
        value: 'secret',
        domain: 'accounts.google.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        expires: 1_900_000_000
      }
    ])

    expect(session.cookies.set).toHaveBeenCalledTimes(1)
    expect(session.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://accounts.google.com/',
        name: 'SID',
        value: 'secret',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        expirationDate: 1_900_000_000
      })
    )
    expect(session.cookies.set.mock.calls[0]?.[0]).not.toHaveProperty('domain')
    expect(session.flushStorageData).toHaveBeenCalledTimes(1)
  })

  it('keeps broad domain cookies when source already uses dot-prefixed domain', async () => {
    const session = createMockSession()

    await importExternalCookies(session as never, [
      {
        name: 'SAPISID',
        value: 'secret',
        domain: '.google.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'None'
      }
    ])

    expect(session.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://google.com/',
        domain: '.google.com',
        sameSite: 'no_restriction'
      })
    )
  })

  it('uses unspecified sameSite when source does not provide one', async () => {
    const session = createMockSession()

    await importExternalCookies(session as never, [
      {
        name: 'HSID',
        value: 'secret',
        domain: 'accounts.google.com',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ])

    expect(session.cookies.set.mock.calls[0]?.[0]?.sameSite).toBe('unspecified')
  })
})
