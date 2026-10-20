import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeSession = {
  cookies: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  },
  clearStorageData: vi.fn(),
  clearAuthCache: vi.fn(),
  flushStorageData: vi.fn()
}

/** The protocol version the mocked extension reported. */
const extensionProtocolVersion = { value: 2 as number | null }

vi.mock('electron', () => ({
  session: { fromPartition: () => fakeSession },
  BrowserWindow: { getAllWindows: () => [] }
}))

vi.mock('../../../features/native-messaging/nativeMessagingManager.js', () => ({
  nativeMessagingManager: {
    getExtensionInfo: () => ({ status: 'connected', installed: true }),
    getExtensionProtocolVersion: () => extensionProtocolVersion.value
  }
}))

import {
  isExtensionVersionOk,
  SiteSessionService
} from '../../../features/web-session/siteSessionService.js'

const CHATGPT = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin' as const,
  memberAppIds: ['chatgpt']
}

const LOCAL_COOKIE = { name: 'session', domain: '.chatgpt.com', path: '/', secure: true }

function makeService(
  overrides: {
    enabled?: boolean
    localCookies?: unknown[]
    extensionConnected?: boolean
    extensionVersionOk?: boolean
  } = {}
) {
  const remove = vi.fn().mockResolvedValue({})
  const set = vi.fn().mockResolvedValue({})
  const get = vi.fn().mockResolvedValue(overrides.localCookies ?? [])
  const clearStorageData = vi.fn().mockResolvedValue(undefined)
  const clearAuthCache = vi.fn().mockResolvedValue(undefined)
  const session = {
    cookies: { get, set, remove },
    clearStorageData,
    clearAuthCache,
    flushStorageData: vi.fn()
  }
  const config = {
    read: vi.fn().mockResolvedValue({
      version: 1 as const,
      configVersion: 3,
      targets: {
        chatgpt: {
          enabled: overrides.enabled ?? false,
          importedAt: null,
          expiresAt: null,
          lastResult: null,
          lastError: null
        }
      }
    }),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    recordResult: vi.fn().mockResolvedValue(undefined)
  }
  const service = new SiteSessionService({
    config,
    loadTargets: async () => [CHATGPT],
    resolveSession: () => session as never,
    isExtensionConnected: () => overrides.extensionConnected ?? true,
    isExtensionVersionOk: () => overrides.extensionVersionOk ?? true
  })
  return { service, session, config, remove, set, get, clearStorageData, clearAuthCache }
}

describe('SiteSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists every target with the import switched off by default', async () => {
    const { service } = makeService()
    const result = await service.list()
    expect(result.views).toHaveLength(1)
    expect(result.views.every((view) => view.enabled === false)).toBe(true)
  })

  it('never hands a partition to the renderer', async () => {
    const { service } = makeService()
    const result = await service.list()
    expect(result.views[0]).not.toHaveProperty('partition')
    expect(JSON.stringify(result)).not.toContain('persist:')
  })

  it('reports the state of the extension next to the sites', async () => {
    const { service } = makeService({ extensionConnected: false, extensionVersionOk: false })
    const result = await service.list()
    expect(result.extensionConnected).toBe(false)
    expect(result.extensionVersionOk).toBe(false)
  })

  it('reports a manual session when the app already holds one', async () => {
    const { service } = makeService({ localCookies: [LOCAL_COOKIE] })
    const result = await service.list()
    expect(result.views[0].status).toBe('manual_session')
  })

  it('reports a signed out site when the app holds no session for it', async () => {
    const { service } = makeService()
    const result = await service.list()
    expect(result.views[0].status).toBe('signed_out')
  })

  it('rejects a cookie packet for a disabled target', async () => {
    const { service, set, config } = makeService({ enabled: false })
    const result = await service.importPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 's', value: 'v', domain: '.chatgpt.com' }]
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('target_disabled')
    expect(set).not.toHaveBeenCalled()
    expect(config.recordResult).not.toHaveBeenCalled()
  })

  it('writes the cookies of an enabled site into its own session', async () => {
    const { service, set, config } = makeService({ enabled: true })
    const result = await service.importPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    expect(result.accepted).toBe(true)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toMatchObject({
      name: 'session',
      url: 'https://chatgpt.com/'
    })
    expect(config.recordResult).toHaveBeenCalledWith('chatgpt', 'imported', undefined, null)
  })

  it('keeps the local session when the browser has no cookies for the site', async () => {
    const { service, remove, clearStorageData, config } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    const result = await service.importPacket({
      targetId: 'chatgpt',
      status: 'no_cookies',
      cookies: []
    })
    expect(result.accepted).toBe(true)
    expect(remove).not.toHaveBeenCalled()
    expect(clearStorageData).not.toHaveBeenCalled()
    expect(config.recordResult).toHaveBeenCalledWith('chatgpt', 'no_cookies', undefined, undefined)
  })

  it('clears the session when the import is switched off', async () => {
    const { service, config, remove, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    const result = await service.setEnabled('chatgpt', false)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', false)
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(clearStorageData).toHaveBeenCalled()
  })

  it('writes the switch before it wipes the session', async () => {
    const { service, config, remove } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })

    await service.setEnabled('chatgpt', false)

    // The order is the invariant: a wipe that ran first would be undone by a
    // packet that arrives while the switch is still on.
    expect(config.setEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0]
    )
  })

  it('does not wipe the session when the switch could not be written', async () => {
    const { service, config, remove, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    config.setEnabled.mockRejectedValue(new Error('the disk is full'))

    const result = await service.setEnabled('chatgpt', false)

    expect(result.success).toBe(false)
    expect(result.error).toBe('write_failed')
    expect(remove).not.toHaveBeenCalled()
    expect(clearStorageData).not.toHaveBeenCalled()
  })

  it('tells the user that the switch was written but the session stayed', async () => {
    const { service, config, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    clearStorageData.mockRejectedValue(new Error('the session is locked'))

    const result = await service.setEnabled('chatgpt', false)

    // The switch was written, so the action did not fail as a whole — the
    // user has to know that the session is still there.
    expect(result.success).toBe(false)
    expect(result.error).toBe('switch_off_wipe_failed')
    expect(result.detail).toBeTruthy()
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', false)
  })

  it('writes only the switch when the import is switched on', async () => {
    const { service, config, set, remove, clearStorageData } = makeService({ enabled: false })
    const result = await service.setEnabled('chatgpt', true)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', true)
    expect(set).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clearStorageData).not.toHaveBeenCalled()
  })

  it('tells the user when the switch could not be written', async () => {
    const { service, config, remove } = makeService({ enabled: false })
    config.setEnabled.mockRejectedValue(new Error('the disk is full'))
    const result = await service.setEnabled('chatgpt', true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('write_failed')
    expect(remove).not.toHaveBeenCalled()
  })

  it('refuses a site the app does not know', async () => {
    const { service, config } = makeService()
    const result = await service.setEnabled('nope', true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
    expect(config.setEnabled).not.toHaveBeenCalled()
  })

  it('clears the session of a site without changing its switch', async () => {
    const { service, config, remove, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    const result = await service.clear('chatgpt')
    expect(result.success).toBe(true)
    expect(config.setEnabled).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(clearStorageData).toHaveBeenCalled()
  })

  it('refuses to clear a site the app does not know', async () => {
    const { service } = makeService()
    const result = await service.clear('nope')
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
  })
})

describe('the extension version', () => {
  beforeEach(() => {
    extensionProtocolVersion.value = 2
  })

  it('accepts an extension that speaks the protocol of this build', () => {
    expect(isExtensionVersionOk()).toBe(true)
  })

  it('refuses an extension that is older than this build', () => {
    extensionProtocolVersion.value = 1
    expect(isExtensionVersionOk()).toBe(false)
  })

  it('refuses an extension that never named its version', () => {
    // An extension that reports no version is an extension the user has to
    // reload — it may be an old copy that predates the handshake.
    extensionProtocolVersion.value = null
    expect(isExtensionVersionOk()).toBe(false)
  })
})
