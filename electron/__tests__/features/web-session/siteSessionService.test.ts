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

vi.mock('../../../features/web-session/siteSessionPartitions.js', () => ({
  // Every partition of this test is one the app has used before.
  partitionExistsOnDisk: vi.fn(async () => true)
}))

import {
  isExtensionVersionOk,
  SiteSessionService
} from '../../../features/web-session/siteSessionService.js'
import { acceptSiteSessionPacket } from '../../../features/web-session/siteSessionBridge.js'
import { invalidateSiteSessionListCache } from '../../../features/web-session/siteSessionListCache.js'
import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'

const CHATGPT = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  origins: ['https://chatgpt.com'],
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
      version: 2 as const,
      configVersion: 3,
      sites: {
        chatgpt: {
          accounts: {
            [PRIMARY_ACCOUNT_ID]: {
              name: null,
              enabled: overrides.enabled ?? false,
              importedAt: null,
              lastResult: null,
              lastError: null,
              fingerprints: []
            }
          },
          activeAccountId: PRIMARY_ACCOUNT_ID
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
    // The list is kept for a couple of seconds: every test starts with an
    // empty cache, or it would read the list of the test before it.
    invalidateSiteSessionListCache()
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

  it('reports an outdated extension instead of a missing one', async () => {
    // The extension is connected but speaks an older protocol: the user has
    // to reload it. The connection is what tells the two apart, and the
    // connection is only known when the extension really talks to the app.
    const { service } = makeService({
      enabled: true,
      extensionConnected: true,
      extensionVersionOk: false
    })
    const result = await service.list()
    expect(result.views[0].status).toBe('extension_outdated')
  })

  it('reports a missing extension when it does not talk to the app', async () => {
    const { service } = makeService({
      enabled: true,
      extensionConnected: false,
      extensionVersionOk: false
    })
    const result = await service.list()
    expect(result.views[0].status).toBe('extension_missing')
  })

  it('writes the cookies of an enabled site into its own session', async () => {
    // The import itself is the bridge core's business; the bridge's own tests
    // cover the routing, the domain check and the empty packet.
    const { config, session, set } = makeService({ enabled: true })
    const outcome = await acceptSiteSessionPacket(
      {
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
      },
      {
        config: config as never,
        loadTargets: async () => [CHATGPT],
        resolveSession: () => session as never
      }
    )
    expect(outcome.accepted).toBe(true)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toMatchObject({
      name: 'session',
      url: 'https://chatgpt.com/'
    })
    expect(config.recordResult).toHaveBeenCalledWith(
      'chatgpt',
      PRIMARY_ACCOUNT_ID,
      'imported',
      undefined
    )
  })

  it('wipes the session only after the import that is running has written', async () => {
    // The import and the toggle of the same site may not overlap: a cookie
    // that is written after the wipe brings the session the user just
    // cancelled back, and nothing corrects it afterwards.
    const { service, config, session, set, remove } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })

    let releaseWrite: () => void = () => {}
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    let startedWrite: () => void = () => {}
    const writing = new Promise<void>((resolve) => {
      startedWrite = resolve
    })
    set.mockImplementation(async () => {
      startedWrite()
      await writeGate
      return {}
    })

    const importing = acceptSiteSessionPacket(
      {
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
      },
      {
        config: config as never,
        loadTargets: async () => [CHATGPT],
        resolveSession: () => session as never
      }
    )

    // The toggle arrives while the import is writing. A packet that has not
    // reached its write yet is refused by the second switch read instead of
    // being serialised, so the lock is what this test is about.
    await writing
    const toggling = service.setEnabled('chatgpt', false)

    // The toggle has to wait for the import: the wipe must be the last thing
    // that happens to the account.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(remove).not.toHaveBeenCalled()

    releaseWrite()
    await Promise.all([importing, toggling])

    expect(set.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0])
  })

  it('clears the session when the import is switched off', async () => {
    const { service, config, remove, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    const result = await service.setEnabled('chatgpt', false)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, false)
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
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, false)
  })

  it('writes only the switch when the import is switched on', async () => {
    const { service, config, set, remove, clearStorageData } = makeService({ enabled: false })
    const result = await service.setEnabled('chatgpt', true)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, true)
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

describe('the list of the sites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSiteSessionListCache()
  })

  it('serves the second reader the list it already built', async () => {
    // The button in the bottom bar and the settings behind it ask for the
    // list at the same time: the state of the sites is read once.
    const { service, config } = makeService()

    await service.list()
    await service.list()

    expect(config.read).toHaveBeenCalledTimes(1)
  })

  it('does not keep the list after a switch was turned', async () => {
    const { service, config } = makeService()

    await service.list()
    await service.setEnabled('chatgpt', true)
    await service.list()

    expect(config.read).toHaveBeenCalledTimes(2)
  })

  it('does not keep the list after a session was cleared', async () => {
    const { service, config } = makeService({ enabled: true, localCookies: [LOCAL_COOKIE] })

    await service.list()
    await service.clear('chatgpt')
    await service.list()

    expect(config.read).toHaveBeenCalledTimes(2)
  })

  it('does not keep the list after an import', async () => {
    // The import happens in the bridge: the row shows the outcome of the
    // last import, so the list that is kept may not survive it.
    const { service, config, session } = makeService({ enabled: true })

    await service.list()

    await acceptSiteSessionPacket(
      {
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
      },
      {
        config: {
          read: vi.fn().mockResolvedValue({
            version: 2,
            configVersion: 3,
            sites: {
              chatgpt: {
                accounts: {
                  [PRIMARY_ACCOUNT_ID]: {
                    name: null,
                    enabled: true,
                    importedAt: null,
                    lastResult: null,
                    lastError: null,
                    fingerprints: []
                  }
                },
                activeAccountId: PRIMARY_ACCOUNT_ID
              }
            }
          }),
          recordResult: vi.fn()
        } as never,
        loadTargets: async () => [CHATGPT],
        resolveSession: () => session as never
      }
    )

    await service.list()

    expect(config.read).toHaveBeenCalledTimes(2)
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
