import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieMocks = vi.hoisted(() => ({
  getAllWebContents: vi.fn(() => []),
  mkdir: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:/tmp')
  },
  webContents: {
    getAllWebContents: cookieMocks.getAllWebContents
  }
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: cookieMocks.mkdir
    }
  },
  promises: {
    mkdir: cookieMocks.mkdir
  }
}))

describe('sessionCookies', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    cookieMocks.getAllWebContents.mockReset().mockReturnValue([])
    cookieMocks.mkdir.mockReset().mockResolvedValue(undefined)
  })

  it('clears stale Google cookies, preserves host-only cookies, and flushes storage', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn().mockResolvedValue(undefined)
    const session = {
      cookies: {
        get: vi.fn().mockResolvedValue([
          { name: 'SID', domain: '.google.com', path: '/', secure: true },
          { name: 'OTHER', domain: 'example.com', path: '/', secure: true }
        ]),
        remove,
        set
      },
      flushStorageData: vi.fn()
    }
    const { importExternalCookies } =
      await import('../../../features/gemini-web-session/sessionCookies.js')

    await importExternalCookies(session as never, [
      {
        name: 'SID',
        value: 'value-1',
        domain: 'accounts.google.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax'
      }
    ])

    expect(remove).toHaveBeenCalledWith('https://google.com/', 'SID')
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://accounts.google.com/',
        name: 'SID',
        sameSite: 'lax'
      })
    )
    expect(set.mock.calls[0][0].domain).toBeUndefined()
    expect(session.flushStorageData).toHaveBeenCalledTimes(1)
  })

  it('preserves dotted domains and converts sameSite and expiration values', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const session = {
      cookies: {
        get: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
        set
      },
      flushStorageData: vi.fn()
    }
    const { importExternalCookies } =
      await import('../../../features/gemini-web-session/sessionCookies.js')

    await importExternalCookies(session as never, [
      {
        name: 'SAPISID',
        value: 'value-2',
        domain: '.google.com',
        path: '/foo',
        secure: true,
        httpOnly: false,
        sameSite: 'None',
        expires: 1234
      }
    ])

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://google.com/foo',
        domain: '.google.com',
        sameSite: 'no_restriction',
        expirationDate: 1234
      })
    )
  })

  it('ignores invalid or non-Google cookies during import', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    const session = {
      cookies: {
        get: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
        set
      },
      flushStorageData: vi.fn()
    }
    const { importExternalCookies } =
      await import('../../../features/gemini-web-session/sessionCookies.js')

    await importExternalCookies(session as never, [
      {
        name: 'INVALID',
        value: 'x',
        domain: '',
        path: '/',
        secure: true,
        httpOnly: true
      },
      {
        name: 'NON_GOOGLE',
        value: 'y',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ])

    expect(set).not.toHaveBeenCalled()
    expect(session.flushStorageData).toHaveBeenCalledTimes(1)
  })
})
