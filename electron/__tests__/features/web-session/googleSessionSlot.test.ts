import type { SiteSessionConfigFile } from '../../../features/web-session/siteSessionConfig.js'
import type { Session } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))
vi.mock('../../../features/web-session/siteSessionBroadcast.js', () => ({
  broadcastSiteSessionsChanged: vi.fn(async () => {})
}))

import {
  googleSessionUrl,
  googleSlotForPartition
} from '../../../../shared/lib/googleSessionUrl.js'
import { ensureGoogleSessionSlot } from '../../../features/web-session/googleSessionSlot.js'

describe('Google account URLs', () => {
  it.each([
    ['https://gemini.google.com/app', 'https://gemini.google.com/u/1/app?authuser=1'],
    [
      'https://gemini.google.com/u/0/app/chat-123?authuser=0',
      'https://gemini.google.com/u/1/app/chat-123?authuser=1'
    ],
    ['https://aistudio.google.com/welcome', 'https://aistudio.google.com/u/1/welcome?authuser=1'],
    [
      'https://drive.google.com/drive/u/0/my-drive',
      'https://drive.google.com/drive/u/1/my-drive?authuser=1'
    ],
    [
      'https://drive.google.com/file/d/abc/view?usp=sharing',
      'https://drive.google.com/file/d/abc/view?usp=sharing&authuser=1'
    ],
    [
      'https://www.youtube.com/watch?v=abc&authuser=0',
      'https://www.youtube.com/watch?v=abc&authuser=1'
    ]
  ])('selects account 2 and preserves content paths: %s', (input, expected) => {
    expect(googleSessionUrl(input, 2)).toBe(expected)
    expect(googleSessionUrl(expected, 2)).toBe(expected)
  })

  it('selects account 1 explicitly and ignores foreign origins', () => {
    expect(googleSessionUrl('https://gemini.google.com/u/1/app?authuser=1', 1)).toBe(
      'https://gemini.google.com/u/0/app?authuser=0'
    )
    expect(googleSessionUrl('https://chatgpt.com/', 2)).toBe('https://chatgpt.com/')
    expect(googleSessionUrl('https://gemini.google.com.attacker.test/app', 2)).toBe(
      'https://gemini.google.com.attacker.test/app'
    )
    expect(googleSlotForPartition('persist:gemini_web_profile_slot_2')).toBe(2)
    expect(googleSlotForPartition('persist:ai_chatgpt_slot_2')).toBeNull()
  })
})

describe('Google session initialization', () => {
  beforeEach(() => vi.clearAllMocks())

  function setup(
    options: {
      enabled?: boolean
      existingAuth?: boolean
      sourceAuth?: boolean
      newerSource?: boolean
    } = {}
  ) {
    const authCookie = {
      name: 'SID',
      value: 'test-session',
      domain: '.google.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax'
    }
    const sourceCookies = [
      ...(options.sourceAuth === false ? [] : [authCookie]),
      { ...authCookie, name: 'browser-data', domain: '.unrelated.test' }
    ]
    const destination = {
      cookies: {
        get: vi.fn(async () => (options.existingAuth ? [authCookie] : [])),
        set: vi.fn(async () => {}),
        remove: vi.fn(async () => {})
      },
      flushStorageData: vi.fn()
    }
    const resolveSession = vi.fn((partition: string) =>
      partition.includes('_slot_')
        ? (destination as unknown as Session)
        : ({ cookies: { get: vi.fn(async () => sourceCookies) } } as unknown as Session)
    )
    const config = {
      isEnabled: vi.fn(async () => options.enabled !== false),
      read: vi.fn(async (): Promise<SiteSessionConfigFile> => ({
        version: 1,
        configVersion: 1,
        targets: {
          google: {
            enabled: true,
            importedAt: null,
            lastResult: null,
            lastError: null,
            slots: options.newerSource
              ? {
                  1: { importedAt: '2026-10-25T12:00:00Z', lastResult: null, lastError: null },
                  3: { importedAt: '2026-10-25T11:00:00Z', lastResult: null, lastError: null }
                }
              : {}
          }
        }
      })),
      recordResult: vi.fn(async () => {})
    }
    return { destination, resolveSession, config }
  }

  it('makes both Google accounts available in a previously unsigned secondary partition after one import', async () => {
    const env = setup()
    await ensureGoogleSessionSlot(2, env)
    expect(env.resolveSession.mock.calls.map(([partition]) => partition)).toEqual([
      'persist:gemini_web_profile_slot_2',
      'persist:gemini_web_profile'
    ])
    expect(env.destination.cookies.set).toHaveBeenCalledTimes(1)
    expect(env.destination.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SID', domain: '.google.com', httpOnly: true })
    )
    expect(env.config.recordResult).toHaveBeenCalledWith('google', 'imported', undefined, 2)
  })

  it('initializes the third Google session from the same browser account bundle', async () => {
    const env = setup()
    await ensureGoogleSessionSlot(3, env)
    expect(env.resolveSession.mock.calls[0][0]).toBe('persist:gemini_web_profile_slot_3')
    expect(env.destination.cookies.set).toHaveBeenCalledTimes(1)
    expect(env.config.recordResult).toHaveBeenCalledWith('google', 'imported', undefined, 3)
    expect(googleSessionUrl('https://gemini.google.com/app', 3)).toBe(
      'https://gemini.google.com/u/2/app?authuser=2'
    )
  })

  it('refreshes a previously initialized third session after the Chrome Google bundle is reimported', async () => {
    const env = setup({ existingAuth: true, newerSource: true })
    await ensureGoogleSessionSlot(3, env)
    expect(env.destination.cookies.set).toHaveBeenCalledTimes(1)
  })

  it('preserves an already authenticated secondary session', async () => {
    const env = setup({ existingAuth: true })
    await ensureGoogleSessionSlot(2, env)
    expect(env.destination.cookies.set).not.toHaveBeenCalled()
    expect(env.resolveSession).toHaveBeenCalledTimes(1)
  })

  it.each([{ enabled: false }, { sourceAuth: false }])(
    'does not initialize an unavailable Google login: %j',
    async (options) => {
      const env = setup(options)
      await ensureGoogleSessionSlot(2, env)
      expect(env.destination.cookies.set).not.toHaveBeenCalled()
      expect(env.config.recordResult).not.toHaveBeenCalled()
    }
  )

  it('does not initialize after the user switches the import off while waiting for the lock', async () => {
    const env = setup()
    env.config.isEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await ensureGoogleSessionSlot(2, env)
    expect(env.resolveSession).not.toHaveBeenCalled()
  })
})
