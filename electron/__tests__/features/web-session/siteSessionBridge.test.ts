import { beforeEach, describe, expect, it, vi } from 'vitest'

const TARGET = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
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

const fakeSession = {
  cookies: { get, set, remove },
  clearStorageData,
  flushStorageData: vi.fn()
}

const read = vi.fn()
const recordResult = vi.fn()

vi.mock('electron', () => ({
  session: {
    fromPartition: () => fakeSession
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

import { Logger } from '../../../core/logger.js'
import {
  SITE_SESSION_PROTOCOL_VERSION,
  acceptSiteSessionPacket,
  hasLocalSessionForTarget,
  listEnabledSiteSessionTargets,
  parseSiteSessionPacket
} from '../../../features/web-session/siteSessionBridge.js'

function stateWith(enabled: boolean, configVersion = 3) {
  return {
    version: 1,
    configVersion,
    targets: {
      chatgpt: {
        enabled,
        importedAt: null,
        expiresAt: null,
        lastResult: null,
        lastError: null
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
    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'imported', undefined, null)
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
    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'failed', 'import_failed', null)
  })

  it('records no reason code when the import wrote a cookie', async () => {
    read.mockResolvedValue(stateWith(true))
    await acceptSiteSessionPacket({
      targetId: 'chatgpt',
      status: 'ok',
      cookies: [{ name: 'session', value: 'v', domain: '.chatgpt.com', secure: true }]
    })
    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'imported', undefined, null)
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
    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'no_cookies', undefined, undefined)
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
    expect(recordResult).toHaveBeenCalledWith('chatgpt', 'permission_missing', undefined, undefined)
  })
})

describe('local session detection', () => {
  beforeEach(() => {
    get.mockReset()
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
})
