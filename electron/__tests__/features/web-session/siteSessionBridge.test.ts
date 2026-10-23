import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChromeExtensionCookie } from '@shared-core/types'

const TARGET = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  origins: ['https://chatgpt.com'],
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin' as const,
  memberAppIds: ['chatgpt']
}

const set = vi.fn().mockResolvedValue({})
const remove = vi.fn().mockResolvedValue({})
const get = vi.fn().mockResolvedValue([])
const clearStorageData = vi.fn().mockResolvedValue(undefined)
const send = vi.fn()

const fakeSession = {
  cookies: { get, set, remove },
  clearStorageData,
  flushStorageData: vi.fn()
}

const read = vi.fn()
const recordResult = vi.fn()

const { partitionExistsOnDisk } = vi.hoisted(() => ({
  partitionExistsOnDisk: vi.fn(async () => true)
}))

vi.mock('electron', () => ({
  session: {
    fromPartition: () => fakeSession
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send }
      }
    ]
  }
}))

vi.mock('../../../features/web-session/siteSessionConfig.js', () => ({
  createAccountState: (enabled: boolean) => ({
    name: null,
    enabled,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: []
  }),
  getSiteSessionConfig: () => ({
    read,
    recordResult,
    createAccount: vi.fn(),
    rememberFingerprint: vi.fn()
  })
}))

vi.mock('../../../features/web-session/siteSessionTargets.js', () => ({
  buildSiteSessionTargets: async () => [TARGET]
}))

vi.mock('../../../features/web-session/siteSessionPartitions.js', () => ({
  partitionExistsOnDisk
}))

import { getSiteSessionIdentityCookies } from '../../../../shared/constants/siteSessionIdentityCookies.js'
import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'
import { APP_CONFIG } from '../../../app/constants.js'
import { Logger } from '../../../core/logger.js'
import {
  SITE_SESSION_PROTOCOL_VERSION,
  type SiteSessionImportEnvironment,
  acceptSiteSessionPacket,
  hasLocalSessionForTarget,
  listEnabledSiteSessionTargets,
  openSiteSessionRound,
  parseSiteSessionPacket,
  recordOversizedSiteSessionPacket
} from '../../../features/web-session/siteSessionBridge.js'
import { setSiteSessionListReader } from '../../../features/web-session/siteSessionBroadcast.js'
import { computeSessionFingerprint } from '../../../features/web-session/siteSessionFingerprint.js'
import type {
  SiteSessionAccountState,
  SiteSessionConfigFile
} from '../../../features/web-session/siteSessionMigration.js'
import {
  clearPendingSiteSession,
  getPendingSiteSession,
  setPendingSiteSession
} from '../../../features/web-session/siteSessionPendingSessions.js'

function stateWith(enabled: boolean, configVersion = 3) {
  return {
    version: 2,
    configVersion,
    sites: {
      chatgpt: {
        accounts: {
          [PRIMARY_ACCOUNT_ID]: {
            name: null,
            enabled,
            importedAt: null,
            lastResult: null,
            lastError: null,
            fingerprints: []
          }
        },
        activeAccountId: PRIMARY_ACCOUNT_ID
      }
    }
  }
}

/** The ids the bridge generates for the accounts it opens in these tests. */
const NEW_ACCOUNT_ID = 'a1111111-1111-4111-8111-111111111111'
const RETURNING_ACCOUNT_ID = 'b2222222-2222-4222-8222-222222222222'

const GOOGLE = {
  siteId: 'google',
  hostname: 'google.com',
  origins: ['https://google.com'],
  partition: 'persist:ai_google',
  cookieDomains: ['.google.com'],
  labelKey: 'ws_target_google',
  kind: 'google' as const,
  memberAppIds: ['google']
}

/** One account state, with the fields a test does not care about filled in. */
function accountState(overrides: Partial<SiteSessionAccountState> = {}): SiteSessionAccountState {
  return {
    name: null,
    enabled: true,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: [],
    ...overrides
  }
}

/** The state of the Google site with the accounts a test needs. */
function googleState(
  accounts: Record<string, SiteSessionAccountState>,
  activeAccountId: string | null = 'a1'
): SiteSessionConfigFile {
  return {
    version: 2,
    configVersion: 3,
    sites: { google: { accounts, activeAccountId } }
  }
}

/** The identity cookie of the Google site, one value per account. */
function identityCookie(value: string): ChromeExtensionCookie {
  return { name: '__Secure-1PSID', value, domain: '.google.com', secure: true }
}

/** The digest the bridge computes for the identity cookies of a packet. */
function fingerprintOf(cookies: ChromeExtensionCookie[]): string {
  const fingerprint = computeSessionFingerprint(
    cookies,
    getSiteSessionIdentityCookies(GOOGLE.siteId)
  )
  if (!fingerprint) throw new Error('the packet carries no identity cookie')
  return fingerprint
}

/**
 * The parts a packet is handled in, with the side effects it causes recorded.
 *
 * The state is mutable: an account the bridge opens is really added to it, so
 * the packet that comes after is routed against the accounts the site has by
 * then.
 */
function makeImportHarness(state: SiteSessionConfigFile) {
  const writes: { partition: string; names: string[] }[] = []
  const created: string[] = []
  const recorded: { accountId: string; result: SiteSessionAccountState['lastResult'] }[] = []
  const registered: { siteId: string; accountId: string }[] = []

  const config = {
    read: vi.fn(async () => state),
    createAccount: vi.fn(async (siteId: string, accountId: string, fingerprint: string | null) => {
      created.push(accountId)
      const site = state.sites[siteId] ?? { accounts: {}, activeAccountId: null }
      state.sites[siteId] = {
        ...site,
        accounts: {
          ...site.accounts,
          [accountId]: accountState({ fingerprints: fingerprint ? [fingerprint] : [] })
        }
      }
    }),
    rememberFingerprint: vi.fn(
      async (siteId: string, accountId: string, fingerprint: string | null) => {
        if (!fingerprint) return
        const account = state.sites[siteId]?.accounts[accountId]
        if (!account || account.fingerprints.includes(fingerprint)) return
        account.fingerprints.push(fingerprint)
      }
    ),
    recordResult: vi.fn(
      async (_siteId: string, accountId: string, result: SiteSessionAccountState['lastResult']) => {
        recorded.push({ accountId, result })
      }
    )
  }

  const resolveSession = (partition: string) => {
    const session = {
      cookies: {
        get: vi.fn(async () => []),
        set: vi.fn(async (details: { name: string }) => {
          writes.push({ partition, names: [details.name] })
        }),
        remove: vi.fn(async () => undefined)
      },
      clearStorageData: vi.fn(async () => undefined),
      flushStorageData: vi.fn()
    }
    return session as never
  }

  return { state, config, resolveSession, writes, created, recorded, registered }
}

function environmentFor(
  harness: ReturnType<typeof makeImportHarness>
): SiteSessionImportEnvironment {
  return {
    config: harness.config,
    loadTargets: async () => [GOOGLE],
    resolveSession: harness.resolveSession,
    registerAccount: (site, accountId) =>
      harness.registered.push({ siteId: site.siteId, accountId })
  }
}

describe('site session packet parsing', () => {
  it('reads a well formed packet', () => {
    const packet = parseSiteSessionPacket(
      JSON.stringify({
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
      })
    )
    expect(packet?.targetId).toBe('chatgpt')
    expect(packet?.status).toBe('ok')
    expect(packet?.cookies).toHaveLength(1)
  })

  it('refuses a body that is not json', () => {
    expect(parseSiteSessionPacket('not json')).toBeNull()
  })

  it('refuses a packet without a site', () => {
    expect(parseSiteSessionPacket(JSON.stringify({ status: 'ok', cookies: [] }))).toBeNull()
  })

  it('refuses a packet with an unknown status', () => {
    expect(
      parseSiteSessionPacket(JSON.stringify({ targetId: 'chatgpt', status: 'weird', cookies: [] }))
    ).toBeNull()
  })

  it('refuses a packet whose cookies are not cookies', () => {
    expect(
      parseSiteSessionPacket(
        JSON.stringify({ targetId: 'chatgpt', status: 'ok', cookies: [{ name: 'a' }] })
      )
    ).toBeNull()
  })

  it('refuses a packet whose cookie carries an unknown same site value', () => {
    expect(
      parseSiteSessionPacket(
        JSON.stringify({
          targetId: 'chatgpt',
          status: 'ok',
          cookies: [{ name: 'a', value: 'v', domain: '.chatgpt.com', sameSite: 'sometimes' }]
        })
      )
    ).toBeNull()
  })
})

describe('site session bridge', () => {
  beforeEach(() => {
    set.mockClear()
    remove.mockClear()
    get.mockClear()
    clearStorageData.mockClear()
    read.mockReset()
    recordResult.mockReset()
    read.mockResolvedValue(stateWith(false))
  })

  it('lists only the sites whose switch is on', async () => {
    read.mockResolvedValue(stateWith(true))
    const list = await listEnabledSiteSessionTargets()
    expect(list.protocolVersion).toBe(SITE_SESSION_PROTOCOL_VERSION)
    expect(list.configVersion).toBe(3)
    expect(list.targets).toEqual([
      { siteId: 'chatgpt', cookieDomains: ['.chatgpt.com', '.openai.com'] }
    ])
  })

  it('lists no site while every switch is off', async () => {
    const list = await listEnabledSiteSessionTargets()
    expect(list.targets).toEqual([])
  })

  it('lists a site while one of its accounts is switched on', async () => {
    read.mockResolvedValue({
      version: 2,
      configVersion: 3,
      sites: {
        chatgpt: {
          accounts: {
            [PRIMARY_ACCOUNT_ID]: accountState({ enabled: false }),
            a1: accountState()
          },
          activeAccountId: 'a1'
        }
      }
    })

    const list = await listEnabledSiteSessionTargets()

    expect(list.targets).toEqual([
      { siteId: 'chatgpt', cookieDomains: ['.chatgpt.com', '.openai.com'] }
    ])
  })

  it('refuses a packet for a site whose switch is off', async () => {
    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com' }]
    })
    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('target_disabled')
    expect(set).not.toHaveBeenCalled()
  })

  it('refuses a packet that carries another site domain', async () => {
    read.mockResolvedValue(stateWith(true))
    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.claude.ai' }]
    })
    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('domain_mismatch')
    expect(set).not.toHaveBeenCalled()
  })

  it('refuses a packet that arrives after the account was switched off', async () => {
    // The routing reads the switch first, the import reads it once more: the
    // second read is what catches a packet that the user outran.
    read.mockResolvedValueOnce(stateWith(true)).mockResolvedValueOnce(stateWith(false))

    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })

    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('account_disabled')
    expect(set).not.toHaveBeenCalled()
    expect(recordResult).not.toHaveBeenCalled()
  })

  it('writes the cookies of an enabled site into its own session', async () => {
    read.mockResolvedValue(stateWith(true))
    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    expect(outcome.accepted).toBe(true)
    expect(outcome.imported).toBe(1)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toMatchObject({
      name: 'session',
      url: 'https://chatgpt.com/'
    })
    expect(recordResult).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, 'imported', undefined)
  })

  it('translates the same site attribute of the extension into the importer spelling', async () => {
    read.mockResolvedValue(stateWith(true))
    await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [
        {
          name: 'session',
          value: 'v',
          domain: '.chatgpt.com',
          secure: true,
          sameSite: 'no_restriction'
        }
      ]
    })
    expect(set.mock.calls[0][0]).toMatchObject({ sameSite: 'no_restriction' })
  })

  it('records a reason code when the import writes nothing', async () => {
    // The row renders `lastError` through the `ws_error_*` keys. Without a
    // reason code the outcome would be shown without saying what went wrong.
    read.mockResolvedValue(stateWith(true))
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => {})
    set.mockRejectedValueOnce(new Error('cookie rejected'))

    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    warn.mockRestore()

    expect(outcome.accepted).toBe(true)
    expect(outcome.imported).toBe(0)
    expect(recordResult).toHaveBeenCalledWith(
      'chatgpt',
      PRIMARY_ACCOUNT_ID,
      'failed',
      'import_failed'
    )
  })

  it('records no reason code when the import wrote a cookie', async () => {
    read.mockResolvedValue(stateWith(true))
    await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    expect(recordResult).toHaveBeenCalledWith('chatgpt', PRIMARY_ACCOUNT_ID, 'imported', undefined)
  })

  it('records an empty browser session without touching the session', async () => {
    read.mockResolvedValue(stateWith(true))
    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'no_cookies',
      cookies: []
    })
    expect(outcome.accepted).toBe(true)
    expect(set).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(recordResult).toHaveBeenCalledWith(
      'chatgpt',
      PRIMARY_ACCOUNT_ID,
      'no_cookies',
      undefined
    )
  })

  it('records a missing permission without touching the session', async () => {
    read.mockResolvedValue(stateWith(true))
    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'permission_missing',
      cookies: []
    })
    expect(outcome.accepted).toBe(true)
    expect(set).not.toHaveBeenCalled()
    expect(recordResult).toHaveBeenCalledWith(
      'chatgpt',
      PRIMARY_ACCOUNT_ID,
      'permission_missing',
      undefined
    )
  })

  it('records a packet that did not fit into the bridge as a failed import', async () => {
    // The packet was too large to be read, so nothing was imported: the row of
    // the site has to say so instead of showing the outcome of an earlier one.
    read.mockResolvedValue({
      version: 2,
      configVersion: 3,
      sites: {
        chatgpt: {
          accounts: {
            [PRIMARY_ACCOUNT_ID]: accountState({ enabled: false }),
            a1: accountState()
          },
          activeAccountId: 'a1'
        }
      }
    })
    await recordOversizedSiteSessionPacket('chatgpt')

    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'a1', 'failed', 'packet_too_large')
    expect(set).not.toHaveBeenCalled()
  })
})

describe('the account a session belongs to', () => {
  afterEach(() => {
    clearPendingSiteSession('google')
    vi.restoreAllMocks()
  })

  it('writes the session into the account whose fingerprint matches', async () => {
    const cookie = identityCookie('token-a1')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([cookie])] }) })
    )

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.writes).toEqual([
      { partition: 'persist:ai_google_a1', names: ['__Secure-1PSID'] }
    ])
  })

  it('opens a new account when no open account can take the session', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(NEW_ACCOUNT_ID)
    const other = identityCookie('token-other')
    const cookie = identityCookie('token-new')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([other])] }) })
    )

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.created).toEqual([NEW_ACCOUNT_ID])
    expect(harness.writes).toEqual([
      { partition: `persist:ai_google_${NEW_ACCOUNT_ID}`, names: ['__Secure-1PSID'] }
    ])
    expect(harness.recorded).toEqual([{ accountId: NEW_ACCOUNT_ID, result: 'imported' }])
  })

  it('holds the session and answers held instead of refusing it', async () => {
    // The extension treats a refusal as "push this again in 30 seconds". A
    // held packet is an answer: the question waits for the user in the
    // settings, and the extension stops re-pushing the same session.
    const cookie = { name: 'session', value: 'v', domain: '.google.com', secure: true }
    const harness = makeImportHarness(googleState({ a1: accountState(), a2: accountState() }, 'a1'))

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome).toEqual({ accepted: true, held: true })
    expect(harness.writes).toEqual([])
    expect(getPendingSiteSession('google')?.cookies).toEqual([cookie])
  })

  it('refuses a packet that arrives after the account was switched off', async () => {
    const cookie = identityCookie('token-a1')
    const fingerprint = fingerprintOf([cookie])
    const enabled = googleState({ a1: accountState({ fingerprints: [fingerprint] }) })
    const disabled = googleState({
      a1: accountState({ enabled: false, fingerprints: [fingerprint] })
    })
    const harness = makeImportHarness(enabled)
    harness.config.read.mockResolvedValueOnce(enabled).mockResolvedValueOnce(disabled)

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('account_disabled')
    expect(harness.writes).toEqual([])
    expect(harness.recorded).toEqual([])
  })

  it('records a packet without cookies on the active account and opens no account', async () => {
    const harness = makeImportHarness(googleState({ a1: accountState(), a2: accountState() }, 'a2'))

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'no_cookies', cookies: [] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.recorded).toEqual([{ accountId: 'a2', result: 'no_cookies' }])
    expect(harness.created).toEqual([])
    expect(harness.writes).toEqual([])
    expect(getPendingSiteSession('google')).toBeNull()
  })

  it('writes a returning session back into the account it came from', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(RETURNING_ACCOUNT_ID)
    const cookieA = identityCookie('token-a1')
    const cookieB = identityCookie('token-b1')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([cookieA])] }) })
    )
    const environment = environmentFor(harness)

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieA] },
      environment
    )
    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieB] },
      environment
    )
    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieA] },
      environment
    )

    expect(harness.writes.map((write) => write.partition)).toEqual([
      'persist:ai_google_a1',
      `persist:ai_google_${RETURNING_ACCOUNT_ID}`,
      'persist:ai_google_a1'
    ])
    expect(harness.created).toEqual([RETURNING_ACCOUNT_ID])
  })

  it('registers the partition of an account it opens', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(RETURNING_ACCOUNT_ID)
    const cookieA = identityCookie('token-a1')
    const cookieB = identityCookie('token-b1')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([cookieA])] }) })
    )

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieB] },
      environmentFor(harness)
    )

    expect(harness.registered).toEqual([{ siteId: 'google', accountId: RETURNING_ACCOUNT_ID }])
  })

  it('does not change the active account when a session arrives', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(RETURNING_ACCOUNT_ID)
    const cookieA = identityCookie('token-a1')
    const cookieB = identityCookie('token-b1')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([cookieA])] }) }, 'a1')
    )

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieB] },
      environmentFor(harness)
    )

    expect(harness.state.sites.google.activeAccountId).toBe('a1')
  })

  it('opens one account for two concurrent packets that carry the same new session', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(NEW_ACCOUNT_ID)
      .mockReturnValueOnce(RETURNING_ACCOUNT_ID)
    const other = identityCookie('token-other')
    const cookie = identityCookie('token-new')
    const fingerprint = fingerprintOf([cookie])
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([other])] }) })
    )

    // Both packets have to finish their first routing before either of them
    // takes the site lock, or the second packet would no longer plan a create.
    let planned = 0
    let releasePlans: () => void = () => {}
    const planGate = new Promise<void>((resolve) => {
      releasePlans = resolve
    })
    harness.config.read.mockImplementation(async () => {
      planned += 1
      if (planned <= 2) {
        if (planned === 2) releasePlans()
        await planGate
      }
      return harness.state
    })

    const environment = environmentFor(harness)
    const outcomes = await Promise.all([
      acceptSiteSessionPacket({ targetId: 'google', status: 'ok', cookies: [cookie] }, environment),
      acceptSiteSessionPacket({ targetId: 'google', status: 'ok', cookies: [cookie] }, environment)
    ])

    expect(outcomes.every((outcome) => outcome.accepted)).toBe(true)
    expect(harness.created).toHaveLength(1)
    const createdId = harness.created[0]
    expect(harness.writes).toEqual([
      { partition: `persist:ai_google_${createdId}`, names: ['__Secure-1PSID'] },
      { partition: `persist:ai_google_${createdId}`, names: ['__Secure-1PSID'] }
    ])
    expect(
      Object.values(harness.state.sites.google.accounts).filter((account) =>
        account.fingerprints.includes(fingerprint)
      )
    ).toHaveLength(1)
  })

  it('refuses a new account when the last account is switched off before the write', async () => {
    const other = identityCookie('token-other')
    const cookie = identityCookie('token-new')
    const enabled = googleState({ a1: accountState({ fingerprints: [fingerprintOf([other])] }) })
    const disabled = googleState({
      a1: accountState({ enabled: false, fingerprints: [fingerprintOf([other])] })
    })
    const harness = makeImportHarness(enabled)
    harness.config.read.mockResolvedValueOnce(enabled).mockResolvedValue(disabled)

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('target_disabled')
    expect(harness.created).toEqual([])
    expect(harness.writes).toEqual([])
  })

  it('remembers the fingerprint of a matched session before the next identity arrives', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(NEW_ACCOUNT_ID)
    const cookieA = identityCookie('token-a1')
    const cookieB = identityCookie('token-b1')
    const harness = makeImportHarness(
      googleState({ [PRIMARY_ACCOUNT_ID]: accountState() }, PRIMARY_ACCOUNT_ID)
    )
    const environment = environmentFor(harness)

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieA] },
      environment
    )

    expect(harness.state.sites.google.accounts[PRIMARY_ACCOUNT_ID].fingerprints).toEqual([
      fingerprintOf([cookieA])
    ])

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookieB] },
      environment
    )

    expect(harness.created).toEqual([NEW_ACCOUNT_ID])
    expect(harness.writes.map((write) => write.partition)).toEqual([
      'persist:ai_google',
      `persist:ai_google_${NEW_ACCOUNT_ID}`
    ])
  })

  it('refuses a session that belongs to a switched-off account', async () => {
    const cookie = identityCookie('token-disabled')
    const fingerprint = fingerprintOf([cookie])
    const other = identityCookie('token-other')
    const harness = makeImportHarness(
      googleState({
        a1: accountState({ fingerprints: [fingerprintOf([other])] }),
        a2: accountState({ enabled: false, fingerprints: [fingerprint] })
      })
    )

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('account_disabled')
    expect(harness.created).toEqual([])
    expect(harness.writes).toEqual([])
  })

  it('forgets a pending session when a packet for the site is imported', async () => {
    const cookie = identityCookie('token-a1')
    const harness = makeImportHarness(
      googleState({ a1: accountState({ fingerprints: [fingerprintOf([cookie])] }) })
    )
    setPendingSiteSession('google', [identityCookie('stale')])

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.writes).toHaveLength(1)
    expect(getPendingSiteSession('google')).toBeNull()
  })

  it('re-routes a pending packet after the lock instead of holding it stale', async () => {
    const cookie = { name: 'session', value: 'v', domain: '.google.com', secure: true }
    const ambiguous = googleState({ a1: accountState(), a2: accountState() }, 'a1')
    const resolved = googleState({ a1: accountState(), a2: accountState({ enabled: false }) }, 'a1')
    const harness = makeImportHarness(ambiguous)
    harness.config.read.mockResolvedValueOnce(ambiguous).mockResolvedValue(resolved)

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.writes).toEqual([{ partition: 'persist:ai_google_a1', names: ['session'] }])
    expect(getPendingSiteSession('google')).toBeNull()
  })

  it('records nothing for a status packet when the site has no active account', async () => {
    const harness = makeImportHarness(googleState({ a1: accountState() }, null))

    const outcome = await acceptSiteSessionPacket(
      { targetId: 'google', status: 'no_cookies', cookies: [] },
      environmentFor(harness)
    )

    expect(outcome.accepted).toBe(true)
    expect(harness.recorded).toEqual([])
    expect(harness.created).toEqual([])
  })
})

describe('the renderer', () => {
  beforeEach(() => {
    send.mockClear()
    setSiteSessionListReader(async () => ({
      accountViews: [],
      extensionConnected: true,
      extensionVersionOk: true
    }))
  })

  it('tells the renderer that an import happened', async () => {
    // Without the event the row keeps the state it had, and the feature looks
    // like it did nothing.
    read.mockResolvedValue(stateWith(true))

    await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })

    expect(send).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED,
      expect.objectContaining({ extensionConnected: true })
    )
  })

  it('does not tell the renderer about a refused packet', async () => {
    read.mockResolvedValue(stateWith(false))

    await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })

    expect(send).not.toHaveBeenCalled()
  })

  it('tells the renderer about a packet that did not fit into the bridge', async () => {
    // The row of the site changed, so the renderer has to hear about it.
    // The active account is read from the state, so this test sets its own:
    // it must not depend on the state another test left behind.
    read.mockResolvedValue(stateWith(true))

    await recordOversizedSiteSessionPacket('chatgpt')

    expect(send).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED,
      expect.objectContaining({ extensionConnected: true })
    )
  })

  it('tells the renderer that a session waits for the account it belongs to', async () => {
    // The settings page asks "which account is this session?". Without the
    // event the question only appears after the user left the page and came
    // back.
    const cookie = { name: 'session', value: 'v', domain: '.google.com', secure: true }
    const harness = makeImportHarness(googleState({ a1: accountState(), a2: accountState() }, 'a1'))

    await acceptSiteSessionPacket(
      { targetId: 'google', status: 'ok', cookies: [cookie] },
      environmentFor(harness)
    )

    expect(send).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED,
      expect.objectContaining({ extensionConnected: true })
    )

    clearPendingSiteSession('google')
  })
})

describe('local session detection', () => {
  beforeEach(() => {
    get.mockReset()
    partitionExistsOnDisk.mockResolvedValue(true)
  })

  it('finds a session the app already holds for the site', async () => {
    get.mockResolvedValue([{ name: 'session', domain: '.chatgpt.com' }])
    await expect(hasLocalSessionForTarget(TARGET)).resolves.toBe(true)
  })

  it('does not mistake another site cookie for a session', async () => {
    get.mockResolvedValue([{ name: 'session', domain: '.claude.ai' }])
    await expect(hasLocalSessionForTarget(TARGET)).resolves.toBe(false)
  })

  it('does not mistake a lookalike domain for a session', async () => {
    get.mockResolvedValue([{ name: 'session', domain: '.notchatgpt.com' }])
    await expect(hasLocalSessionForTarget(TARGET)).resolves.toBe(false)
  })

  it('does not read the session of a site whose partition was never used', async () => {
    // Asking Electron for the session of a partition that is not there
    // creates it: a user who never opened a platform would get an empty
    // folder for it.
    partitionExistsOnDisk.mockResolvedValue(false)
    const resolveSession = vi.fn(() => fakeSession as never)

    await expect(hasLocalSessionForTarget(TARGET, resolveSession)).resolves.toBe(false)
    expect(resolveSession).not.toHaveBeenCalled()
  })
})

describe('a round of packets', () => {
  beforeEach(() => {
    read.mockReset()
    recordResult.mockReset()
    get.mockReset()
    get.mockResolvedValue([])
    read.mockResolvedValue(stateWith(true))
  })

  it('builds the target list once for the packets of the round', async () => {
    // The extension pushes one packet per site: the sites of the round do
    // not change while it pushes them, so the list is read once.
    const loadTargets = vi.fn(async () => [TARGET])
    const round = await openSiteSessionRound({
      config: { read, recordResult } as never,
      loadTargets,
      resolveSession: () => fakeSession as never
    })

    await round.accept({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    await round.accept({
      targetId: 'chatgpt',
      status: 'no_cookies',
      cookies: []
    })

    expect(loadTargets).toHaveBeenCalledTimes(1)
  })

  it('reads the target list again for every packet when there is no round', async () => {
    // The stdio path handles one packet at a time: there is nothing to share
    // between them.
    const loadTargets = vi.fn(async () => [TARGET])
    const environment = {
      config: { read, recordResult } as never,
      loadTargets,
      resolveSession: () => fakeSession as never
    }

    await acceptSiteSessionPacket(
      {
        targetId: 'chatgpt',
        status: 'ok',
        cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
      },
      environment
    )
    await acceptSiteSessionPacket(
      { targetId: 'chatgpt', status: 'no_cookies', cookies: [] },
      environment
    )

    expect(loadTargets).toHaveBeenCalledTimes(2)
  })
})
