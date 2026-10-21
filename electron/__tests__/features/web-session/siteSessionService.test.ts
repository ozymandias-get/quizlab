import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeCookie {
  name: string
  domain: string
  path?: string
  secure?: boolean
}

const { fakeSession, removedPartitions } = vi.hoisted(() => {
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
  return { fakeSession, removedPartitions: [] as string[] }
})

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
  partitionExistsOnDisk: vi.fn(async () => true),
  removePartitionDirectory: vi.fn(async (partition: string) => {
    removedPartitions.push(partition)
  })
}))

import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'
import { accountPartitionFor } from '../../../features/web-session/siteSessionAccounts.js'
import { acceptSiteSessionPacket } from '../../../features/web-session/siteSessionBridge.js'
import { invalidateSiteSessionListCache } from '../../../features/web-session/siteSessionListCache.js'
import type {
  SiteSessionAccountState,
  SiteSessionConfigFile
} from '../../../features/web-session/siteSessionMigration.js'
import {
  clearPendingSiteSession,
  getPendingSiteSession,
  listPendingSiteSessionIds,
  setPendingSiteSession
} from '../../../features/web-session/siteSessionPendingSessions.js'
import {
  isExtensionVersionOk,
  SiteSessionService
} from '../../../features/web-session/siteSessionService.js'
import type { SiteSessionTargetRow } from '../../../features/web-session/siteSessionTargets.js'

const CHATGPT: SiteSessionTargetRow = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  origins: ['https://chatgpt.com'],
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin',
  memberAppIds: ['chatgpt']
}

const GOOGLE: SiteSessionTargetRow = {
  siteId: 'google',
  hostname: 'gemini.google.com, aistudio.google.com, www.youtube.com, drive.google.com',
  origins: [
    'https://gemini.google.com',
    'https://aistudio.google.com',
    'https://www.youtube.com',
    'https://drive.google.com'
  ],
  partition: 'persist:ai_google',
  cookieDomains: ['.google.com'],
  labelKey: 'ws_target_google',
  kind: 'google',
  memberAppIds: ['gemini', 'aistudio', 'youtube', 'drive']
}

const LOCAL_COOKIE: FakeCookie = {
  name: 'session',
  domain: '.chatgpt.com',
  path: '/',
  secure: true
}

const GOOGLE_COOKIE: FakeCookie = { name: 'SID', domain: '.google.com', path: '/', secure: true }

/** An account that was never touched: unnamed, off, no history. */
function account(overrides: Partial<SiteSessionAccountState> = {}): SiteSessionAccountState {
  return {
    name: null,
    enabled: false,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: [],
    ...overrides
  }
}

/** A state file that holds one site. */
function stateWith(
  siteId: string,
  accounts: Record<string, SiteSessionAccountState>,
  activeAccountId: string | null
): SiteSessionConfigFile {
  return {
    version: 2,
    configVersion: 1,
    sites: { [siteId]: { accounts, activeAccountId } }
  }
}

/** The state of a brand new chatgpt site. */
function chatgptState(enabled: boolean): SiteSessionConfigFile {
  return stateWith('chatgpt', { [PRIMARY_ACCOUNT_ID]: account({ enabled }) }, PRIMARY_ACCOUNT_ID)
}

/** The state of a Google site with a primary and one extra account. */
function googleState(
  overrides: {
    primary?: Partial<SiteSessionAccountState>
    a1?: Partial<SiteSessionAccountState>
    activeAccountId?: string | null
  } = {}
): SiteSessionConfigFile {
  return stateWith(
    'google',
    {
      [PRIMARY_ACCOUNT_ID]: account({ name: 'Kişisel', enabled: true, ...overrides.primary }),
      a1: account({ name: 'İş', enabled: true, ...overrides.a1 })
    },
    overrides.activeAccountId ?? PRIMARY_ACCOUNT_ID
  )
}

interface FakeSession {
  cookies: {
    get: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
  clearStorageData: ReturnType<typeof vi.fn>
  clearAuthCache: ReturnType<typeof vi.fn>
  flushStorageData: ReturnType<typeof vi.fn>
}

/**
 * A session whose cookies are real enough to be wiped: `get` returns what is
 * left after the removals, so a clear changes the status the next list reads.
 */
function createSession(initialCookies: FakeCookie[]): FakeSession {
  const cookies = [...initialCookies]
  return {
    cookies: {
      get: vi.fn(async () => cookies),
      set: vi.fn(async () => ({})),
      remove: vi.fn(async (_url: string, name: string) => {
        const index = cookies.findIndex((cookie) => cookie.name === name)
        if (index >= 0) cookies.splice(index, 1)
        return {}
      })
    },
    clearStorageData: vi.fn().mockResolvedValue(undefined),
    clearAuthCache: vi.fn().mockResolvedValue(undefined),
    flushStorageData: vi.fn()
  }
}

function makeService(
  overrides: {
    state?: SiteSessionConfigFile
    targets?: SiteSessionTargetRow[]
    enabled?: boolean
    localCookies?: FakeCookie[]
    extensionConnected?: boolean
    extensionVersionOk?: boolean
  } = {}
) {
  const state = overrides.state ?? chatgptState(overrides.enabled ?? false)
  const targets = overrides.targets ?? [CHATGPT]
  const sessions = new Map<string, FakeSession>()

  const sessionFor = (partition: string): FakeSession => {
    let session = sessions.get(partition)
    if (!session) {
      session = createSession(overrides.localCookies ?? [])
      sessions.set(partition, session)
    }
    return session
  }

  // The session of the first target: the account-level tests reach the other
  // partitions through the map.
  const session = sessionFor(targets[0].partition)

  const config = {
    read: vi.fn(async () => state),
    setEnabled: vi.fn(async (siteId: string, accountId: string, enabled: boolean) => {
      const site = state.sites[siteId]
      if (site) site.accounts[accountId] = { ...(site.accounts[accountId] ?? account()), enabled }
      return state
    }),
    setActiveAccount: vi.fn(async (siteId: string, accountId: string) => {
      const site = state.sites[siteId]
      if (site) site.activeAccountId = accountId
    }),
    renameAccount: vi.fn(async (siteId: string, accountId: string, name: string) => {
      const existing = state.sites[siteId]?.accounts[accountId]
      if (existing) existing.name = name === '' ? null : name
    }),
    deleteAccount: vi.fn(async (siteId: string, accountId: string) => {
      const site = state.sites[siteId]
      if (site) delete site.accounts[accountId]
    }),
    createAccount: vi.fn(async (siteId: string, accountId: string) => {
      const site = (state.sites[siteId] ??= { accounts: {}, activeAccountId: null })
      site.accounts[accountId] = account({ enabled: true })
    }),
    // The bridge records its imports into the same state.
    recordResult: vi.fn(
      async (
        siteId: string,
        accountId: string,
        result: SiteSessionAccountState['lastResult'],
        error?: string
      ) => {
        const existing = state.sites[siteId]?.accounts[accountId]
        if (!existing) return
        existing.lastResult = result
        existing.lastError = error ?? null
      }
    ),
    rememberFingerprint: vi.fn(async () => undefined)
  }

  const service = new SiteSessionService({
    config,
    loadTargets: async () => targets,
    resolveSession: (partition) => sessionFor(partition) as never,
    isExtensionConnected: () => overrides.extensionConnected ?? true,
    isExtensionVersionOk: () => overrides.extensionVersionOk ?? true
  })

  return {
    service,
    session,
    sessions,
    sessionFor,
    config,
    state,
    set: session.cookies.set,
    remove: session.cookies.remove,
    get: session.cookies.get,
    clearStorageData: session.clearStorageData,
    clearAuthCache: session.clearAuthCache
  }
}

function googleService(
  overrides: {
    state?: SiteSessionConfigFile
    localCookies?: FakeCookie[]
  } = {}
) {
  return makeService({
    targets: [GOOGLE],
    state: overrides.state ?? googleState(),
    localCookies: overrides.localCookies
  })
}

describe('SiteSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    removedPartitions.length = 0
    // The list is kept for a couple of seconds: every test starts with an
    // empty cache, or it would read the list of the test before it.
    invalidateSiteSessionListCache()
  })

  afterEach(() => {
    for (const siteId of listPendingSiteSessionIds()) clearPendingSiteSession(siteId)
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
    expect(result.accountViews[0].accounts[0]).not.toHaveProperty('partition')
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
    const toggling = service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

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
    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, false)
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(clearStorageData).toHaveBeenCalled()
  })

  it('forgets a pending session when the last account is switched off', async () => {
    const { service } = makeService({ enabled: true })
    setPendingSiteSession('chatgpt', [{ name: 'session', value: 'v', domain: '.chatgpt.com' }])

    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

    expect(result.success).toBe(true)
    expect(getPendingSiteSession('chatgpt')).toBeNull()
  })

  it('keeps a pending session while another account is still switched on', async () => {
    const state = chatgptState(true)
    state.sites.chatgpt.accounts.a1 = account({ enabled: true })
    const { service } = makeService({ state })
    setPendingSiteSession('chatgpt', [{ name: 'session', value: 'v', domain: '.chatgpt.com' }])

    await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

    expect(getPendingSiteSession('chatgpt')).not.toBeNull()
  })

  it('writes the switch before it wipes the session', async () => {
    const { service, config, remove } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })

    await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

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

    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

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

    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, false)

    // The switch was written, so the action did not fail as a whole — the
    // user has to know that the session is still there.
    expect(result.success).toBe(false)
    expect(result.error).toBe('switch_off_wipe_failed')
    expect(result.detail).toBeTruthy()
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, false)
  })

  it('writes only the switch when the import is switched on', async () => {
    const { service, config, set, remove, clearStorageData } = makeService({ enabled: false })
    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(set).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clearStorageData).not.toHaveBeenCalled()
  })

  it('tells the user when the switch could not be written', async () => {
    const { service, config, remove } = makeService({ enabled: false })
    config.setEnabled.mockRejectedValue(new Error('the disk is full'))
    const result = await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('write_failed')
    expect(remove).not.toHaveBeenCalled()
  })

  it('refuses a site the app does not know', async () => {
    const { service, config } = makeService()
    const result = await service.setEnabled('nope', PRIMARY_ACCOUNT_ID, true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
    expect(config.setEnabled).not.toHaveBeenCalled()
  })

  it('clears the session of a site without changing its switch', async () => {
    const { service, config, remove, clearStorageData } = makeService({
      enabled: true,
      localCookies: [LOCAL_COOKIE]
    })
    const result = await service.clear('chatgpt', PRIMARY_ACCOUNT_ID)
    expect(result.success).toBe(true)
    expect(config.setEnabled).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(clearStorageData).toHaveBeenCalled()
  })

  it('refuses to clear a site the app does not know', async () => {
    const { service } = makeService()
    const result = await service.clear('nope', PRIMARY_ACCOUNT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
  })

  it('clears only the session of the account it was asked about', async () => {
    const { service, sessions } = makeService({
      targets: [GOOGLE],
      state: googleState(),
      localCookies: [GOOGLE_COOKIE]
    })

    const result = await service.clear('google', 'a1')

    expect(result.success).toBe(true)
    expect(sessions.get('persist:ai_google_a1')?.clearStorageData).toHaveBeenCalled()
    expect(sessions.get('persist:ai_google')?.clearStorageData).not.toHaveBeenCalled()
  })

  it('refuses an account the site does not have', async () => {
    const { service, config } = googleService()
    const result = await service.setEnabled('google', 'a2', true)
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
    expect(config.setEnabled).not.toHaveBeenCalled()
  })

  it('lists a site with its accounts and marks the active one', async () => {
    const { service } = googleService()
    const views = (await service.list()).accountViews

    expect(views[0].accounts.map((entry) => entry.isActive)).toEqual([true, false])
    expect(views[0].accounts.map((entry) => entry.index)).toEqual([1, 2])
    expect(views[0].accounts.map((entry) => entry.isPrimary)).toEqual([true, false])
    expect(views[0].activeAccountId).toBe(PRIMARY_ACCOUNT_ID)
  })

  it('gives every account its own status', async () => {
    const { service } = googleService({
      state: googleState({
        primary: { enabled: false },
        a1: { enabled: true, lastResult: 'imported', importedAt: '2026-10-22T10:00:00.000Z' },
        activeAccountId: 'a1'
      })
    })
    const views = (await service.list()).accountViews

    expect(views[0].accounts.map((entry) => entry.status)).toEqual(['signed_out', 'imported'])
    expect(views[0].accounts[1].importedAt).toBe('2026-10-22T10:00:00.000Z')
  })

  it('fills the old site row from the primary account', async () => {
    // The old settings card still reads `views`: its switch has to keep
    // meaning the primary account while the active account is another one.
    const { service } = googleService({
      state: googleState({
        primary: { enabled: false },
        a1: { enabled: true, lastResult: 'imported' },
        activeAccountId: 'a1'
      })
    })
    const result = await service.list()

    expect(result.views[0].enabled).toBe(false)
    expect(result.views[0].status).toBe('signed_out')
    expect(result.views[0].importedAt).toBeNull()
  })

  it('refuses to delete the primary account', async () => {
    const { service, config } = googleService()
    const result = await service.deleteAccount('google', PRIMARY_ACCOUNT_ID)

    expect(result.success).toBe(false)
    expect(result.error).toBe('primary_account')
    expect(config.deleteAccount).not.toHaveBeenCalled()
    expect(removedPartitions).toEqual([])
  })

  it('deletes an extra account and its partition', async () => {
    const { service, config } = googleService({ localCookies: [GOOGLE_COOKIE] })
    const result = await service.deleteAccount('google', 'a1')

    expect(result.success).toBe(true)
    expect(config.deleteAccount).toHaveBeenCalledWith('google', 'a1')
    expect(removedPartitions).toEqual(['persist:ai_google_a1'])
  })

  it('does not delete the account when its session could not be wiped', async () => {
    const { service, config, sessionFor } = googleService({ localCookies: [GOOGLE_COOKIE] })
    sessionFor('persist:ai_google_a1').clearStorageData.mockRejectedValue(new Error('locked'))

    const result = await service.deleteAccount('google', 'a1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('wipe_failed')
    expect(config.deleteAccount).not.toHaveBeenCalled()
    expect(removedPartitions).toEqual([])
  })

  it('writes the pending session into the account the user picked', async () => {
    const { service, sessions, config } = googleService()
    setPendingSiteSession('google', [
      { name: 'SID', value: 'v', domain: '.google.com', secure: true }
    ])

    const result = await service.resolvePendingSession('google', 'a1')

    expect(result.success).toBe(true)
    expect(sessions.get('persist:ai_google_a1')?.cookies.set).toHaveBeenCalledTimes(1)
    expect(getPendingSiteSession('google')).toBeNull()
    expect(config.setEnabled).not.toHaveBeenCalled()
  })

  it('creates a new account for a pending session the user gave no account', async () => {
    const { service, sessions, config } = googleService()
    setPendingSiteSession('google', [
      { name: 'SID', value: 'v', domain: '.google.com', secure: true }
    ])

    const result = await service.resolvePendingSession('google', null)

    expect(result.success).toBe(true)
    const created = config.createAccount.mock.calls[0]
    const partition = accountPartitionFor('google', created[1])
    expect(sessions.get(partition)?.cookies.set).toHaveBeenCalledTimes(1)
    expect(getPendingSiteSession('google')).toBeNull()
  })

  it('opens the account before writing a pending session into it', async () => {
    const { service, sessions, config } = googleService({
      state: googleState({ a1: { enabled: false } })
    })
    setPendingSiteSession('google', [
      { name: 'SID', value: 'v', domain: '.google.com', secure: true }
    ])

    const result = await service.resolvePendingSession('google', 'a1')

    expect(result.success).toBe(true)
    expect(config.setEnabled).toHaveBeenCalledWith('google', 'a1', true)
    const set = sessions.get('persist:ai_google_a1')?.cookies.set
    expect(config.setEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      set?.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('refuses a pending session the site does not hold', async () => {
    const { service } = googleService()
    const result = await service.resolvePendingSession('google', 'a1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
  })

  it('switches the active account without changing any switch', async () => {
    const { service, state, config, sessions } = googleService()

    const result = await service.setActiveAccount('google', 'a1')

    expect(result.success).toBe(true)
    expect(state.sites.google.activeAccountId).toBe('a1')
    expect(config.setEnabled).not.toHaveBeenCalled()
    expect([...sessions.values()].flatMap((entry) => entry.cookies.set.mock.calls)).toEqual([])
    expect([...sessions.values()].flatMap((entry) => entry.clearStorageData.mock.calls)).toEqual([])
  })

  it('refuses an active account the site does not have', async () => {
    const { service, config } = googleService()
    const result = await service.setActiveAccount('google', 'a2')
    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown_target')
    expect(config.setActiveAccount).not.toHaveBeenCalled()
  })

  it('renames an account', async () => {
    const { service, state, config } = googleService()

    const result = await service.renameAccount('google', 'a1', 'Başka')

    expect(result.success).toBe(true)
    expect(config.renameAccount).toHaveBeenCalledWith('google', 'a1', 'Başka')
    expect(state.sites.google.accounts.a1.name).toBe('Başka')
  })

  it('refuses a name that another account of the same site already has', async () => {
    const { service, config, state } = googleService()

    const result = await service.renameAccount('google', 'a1', 'Kişisel')

    expect(result.success).toBe(false)
    expect(result.error).toBe('duplicate_name')
    expect(config.renameAccount).not.toHaveBeenCalled()
    expect(state.sites.google.accounts.a1.name).toBe('İş')
  })

  it('lets an account keep the name it already has', async () => {
    const { service, config } = googleService()

    const result = await service.renameAccount('google', 'a1', 'İş')

    expect(result.success).toBe(true)
    expect(config.renameAccount).toHaveBeenCalledWith('google', 'a1', 'İş')
  })

  it('turns an empty name into no name', async () => {
    const { service, state } = googleService()

    const result = await service.renameAccount('google', 'a1', '')

    expect(result.success).toBe(true)
    expect(state.sites.google.accounts.a1.name).toBeNull()
  })

  it('renames the primary account a fresh site only shows synthetically', async () => {
    // `buildAccountRows` always shows a primary, but the file need not hold one
    // yet. Renaming it must write the account instead of silently dropping the
    // name on the next read.
    const { service, state } = googleService({
      state: stateWith('google', { a1: account({ name: 'İş', enabled: true }) }, 'a1')
    })

    const result = await service.renameAccount('google', PRIMARY_ACCOUNT_ID, 'Kişisel')

    expect(result.success).toBe(true)
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID]?.name).toBe('Kişisel')
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID]?.enabled).toBe(false)
  })

  it('marks the synthetic primary account as active', async () => {
    const { service, state } = googleService({
      state: stateWith('google', { a1: account({ name: 'İş', enabled: true }) }, 'a1')
    })

    const result = await service.setActiveAccount('google', PRIMARY_ACCOUNT_ID)

    expect(result.success).toBe(true)
    expect(state.sites.google.accounts[PRIMARY_ACCOUNT_ID]?.enabled).toBe(false)
    expect(state.sites.google.activeAccountId).toBe(PRIMARY_ACCOUNT_ID)
  })
})

describe('the list of the sites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    removedPartitions.length = 0
    invalidateSiteSessionListCache()
  })

  afterEach(() => {
    for (const siteId of listPendingSiteSessionIds()) clearPendingSiteSession(siteId)
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
    const { service } = makeService()

    await service.list()
    await service.setEnabled('chatgpt', PRIMARY_ACCOUNT_ID, true)
    const result = await service.list()

    expect(result.views[0].enabled).toBe(true)
  })

  it('does not keep the list after a session was cleared', async () => {
    const { service } = makeService({ localCookies: [LOCAL_COOKIE] })

    const before = await service.list()
    expect(before.views[0].status).toBe('manual_session')

    await service.clear('chatgpt', PRIMARY_ACCOUNT_ID)
    const after = await service.list()

    expect(after.views[0].status).toBe('signed_out')
  })

  it('does not keep the list after the active account changed', async () => {
    const { service } = googleService()
    const before = await service.list()
    expect(before.accountViews[0].activeAccountId).toBe(PRIMARY_ACCOUNT_ID)

    await service.setActiveAccount('google', 'a1')
    const after = await service.list()

    expect(after.accountViews[0].activeAccountId).toBe('a1')
  })

  it('does not keep the list after a pending session was resolved', async () => {
    const { service } = googleService()
    setPendingSiteSession('google', [
      { name: 'SID', value: 'v', domain: '.google.com', secure: true }
    ])
    const before = await service.list()
    expect(before.accountViews[0].hasPendingSession).toBe(true)

    await service.resolvePendingSession('google', 'a1')
    const after = await service.list()

    expect(after.accountViews[0].hasPendingSession).toBe(false)
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
