import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  getSiteSessionConfig: () => ({
    read,
    recordResult
  })
}))

vi.mock('../../../features/web-session/siteSessionTargets.js', () => ({
  buildSiteSessionTargets: async () => [TARGET]
}))

vi.mock('../../../features/web-session/siteSessionPartitions.js', () => ({
  partitionExistsOnDisk
}))

import { APP_CONFIG } from '../../../app/constants.js'
import { Logger } from '../../../core/logger.js'
import {
  SITE_SESSION_PROTOCOL_VERSION,
  acceptSiteSessionPacket,
  hasLocalSessionForTarget,
  listEnabledSiteSessionTargets,
  openSiteSessionRound,
  parseSiteSessionPacket,
  recordOversizedSiteSessionPacket
} from '../../../features/web-session/siteSessionBridge.js'
import { setSiteSessionListReader } from '../../../features/web-session/siteSessionBroadcast.js'
import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'

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

  it('refuses a packet whose switch was turned off while it was on its way', async () => {
    // The routing reads the switch first, the import reads it once more: the
    // second read is what catches a packet that the user outran.
    read.mockResolvedValueOnce(stateWith(true)).mockResolvedValueOnce(stateWith(false))

    const outcome = await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })

    expect(outcome.accepted).toBe(false)
    expect(outcome.reason).toBe('target_disabled')
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
    read.mockResolvedValue(stateWith(true))
    await recordOversizedSiteSessionPacket('chatgpt')

    expect(recordResult).toHaveBeenCalledWith(
      'chatgpt',
      PRIMARY_ACCOUNT_ID,
      'failed',
      'packet_too_large'
    )
    expect(set).not.toHaveBeenCalled()
  })
})

describe('the renderer', () => {
  beforeEach(() => {
    send.mockClear()
    setSiteSessionListReader(async () => ({
      views: [],
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
    await recordOversizedSiteSessionPacket('chatgpt')

    expect(send).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED,
      expect.objectContaining({ extensionConnected: true })
    )
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
