/**
 * The MV3 service worker of the site session extension.
 *
 * The worker is plain JavaScript without a build step, so it cannot be
 * imported: it is run in a `vm` sandbox against a fake Chrome, a fake bridge
 * and a fake clock. The tests pin the behaviour the app depends on — the
 * reconnect loop, the pairing verdict, the packet classification and the state
 * that has to survive a worker restart.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SOURCE = readFileSync('extensions/quizlab-session-extension/background.js', 'utf8')

const SECRET = 'a'.repeat(64)
const OTHER_SECRET = 'b'.repeat(64)
const PROFILE_ID = 'profile-worker-test'
const PROFILE_NAME = 'Old Chrome'
const PORT = 51999
const HEALTH_PATH = '/api/health'
const SITES_PATH = '/api/sites'
const COOKIES_PATH = '/api/cookies'
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'

/** The real timers, so a test can yield to the event loop with fake timers on. */
const realSetImmediate = globalThis.setImmediate
const realSetTimeout = globalThis.setTimeout

async function flush(turns = 6): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise<void>((resolve) => realSetImmediate(resolve))
    await new Promise<void>((resolve) => realSetTimeout(resolve, 0))
  }
}

interface StorageState {
  local: Record<string, unknown>
  session: Record<string, unknown>
}

interface FakeCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: string
  expirationDate?: number
}

interface Packet {
  targetId: string
  status: string
  cookies: number
}

interface BridgeState {
  active: boolean
  secret: string
  instanceId: string
  selectedProfileId: string | null
  selectionVersion: number
  configVersion: number
  targets: Array<{ siteId: string; label?: string; cookieDomains: string[] }>
  packets: Packet[]
  healthCalls: number
  siteListCalls: number
  lastSitesHeaders: Record<string, string>
  /** The signature of every site-list request, in order. */
  siteListSignatures: string[]
  /** Holds a site-list request so a test can overlap another worker flow. */
  beforeSiteList?: (headers: Record<string, string>) => Promise<void> | void
  /** The answer of the app to one packet. */
  answerPacket: (packet: Packet) => { status: number; body: Record<string, unknown> }
  /** The status the signed site list answers with. */
  siteListStatus: number
  /** The status the cookie endpoint answers with before the body is read. */
  cookieStatus: number | null
  cookieStatusBody: Record<string, unknown>
}

interface HarnessOptions {
  storage?: StorageState
  bridge?: Partial<BridgeState>
  cookies?: FakeCookie[]
  /** Whether the extension holds the host permission of the target. */
  permissionDenied?: boolean
  /** Returns true for a local-storage write that has to fail. */
  failLocalSet?: (values: Record<string, unknown>) => boolean
}

/** The signature the app expects for the site list, signed with a given code. */
function siteListSignature(secret: string): string {
  return createHmac('sha256', secret).update(`${PROFILE_ID}\n${SITES_PATH}`).digest('hex')
}

function createStorage(): StorageState {
  return {
    local: {
      profileId: PROFILE_ID,
      profileName: PROFILE_NAME,
      bridgeSecret: SECRET
    },
    session: {}
  }
}

function createCookie(overrides: Partial<FakeCookie> = {}): FakeCookie {
  return {
    name: 'session',
    value: 'v1',
    domain: '.chatgpt.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    ...overrides
  }
}

function createHarness(options: HarnessOptions = {}) {
  const storage = options.storage ?? createStorage()
  const alarms = new Map<
    string,
    { name: string; delayInMinutes?: number; periodInMinutes?: number }
  >()
  const listeners = {
    alarm: [] as Array<(alarm: { name: string }) => void>,
    cookie: [] as Array<(change: { cookie: Partial<FakeCookie> }) => void>,
    navigation: [] as Array<() => void>,
    message: [] as Array<
      (
        message: Record<string, unknown>,
        sender: unknown,
        sendResponse: (value: Record<string, unknown>) => void
      ) => boolean | void
    >
  }
  const cookies: FakeCookie[] = options.cookies ?? [createCookie()]
  const warnings: string[] = []
  let failLocalSet = options.failLocalSet ?? null

  const bridge: BridgeState = {
    active: true,
    secret: SECRET,
    instanceId: 'instance-1',
    selectedProfileId: PROFILE_ID,
    selectionVersion: 1,
    configVersion: 1,
    targets: [{ siteId: 'chatgpt', label: 'ChatGPT', cookieDomains: ['.chatgpt.com'] }],
    packets: [],
    healthCalls: 0,
    siteListCalls: 0,
    lastSitesHeaders: {},
    siteListSignatures: [],
    siteListStatus: 200,
    cookieStatus: null,
    cookieStatusBody: {},
    answerPacket: (packet) =>
      packet.status === 'ok'
        ? {
            status: 200,
            body: {
              success: true,
              accepted: true,
              importSucceeded: true,
              imported: packet.cookies,
              failed: 0,
              retryable: false
            }
          }
        : {
            status: 200,
            body: {
              success: false,
              accepted: true,
              importSucceeded: false,
              imported: 0,
              failed: 0,
              retryable: false
            }
          },
    ...options.bridge
  }

  const permissionDenied = options.permissionDenied === true

  function makeArea(values: Record<string, unknown>, local: boolean) {
    return {
      get: async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, unknown> = {}
        for (const key of list) {
          if (Object.hasOwn(values, key)) result[key] = values[key]
        }
        return result
      },
      set: async (next: Record<string, unknown>) => {
        if (local && failLocalSet?.(next)) throw new Error('the storage is read-only')
        Object.assign(values, next)
      }
    }
  }

  const chrome = {
    runtime: {
      id: 'quizlab-test-extension',
      onMessage: {
        addListener: (fn: (typeof listeners.message)[number]) => listeners.message.push(fn)
      },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} }
    },
    alarms: {
      create: (name: string, info: Record<string, unknown>) => {
        alarms.set(name, { name, ...info })
      },
      clear: async (name: string) => alarms.delete(name),
      getAll: async () => [...alarms.values()],
      onAlarm: { addListener: (fn: (typeof listeners.alarm)[number]) => listeners.alarm.push(fn) }
    },
    storage: {
      local: makeArea(storage.local, true),
      session: makeArea(storage.session, false)
    },
    cookies: {
      getAll: async ({ domain }: { domain: string }) =>
        cookies.filter((cookie) => cookie.domain.toLowerCase() === domain.toLowerCase()),
      onChanged: {
        addListener: (fn: (typeof listeners.cookie)[number]) => listeners.cookie.push(fn)
      }
    },
    permissions: {
      contains: async () => !permissionDenied
    },
    action: {
      setTitle: async () => {},
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {}
    },
    webNavigation: {
      onCompleted: {
        addListener: (fn: () => void) => listeners.navigation.push(fn),
        removeListener: (fn: () => void) => {
          const index = listeners.navigation.indexOf(fn)
          if (index >= 0) listeners.navigation.splice(index, 1)
        }
      }
    }
  }

  function respond(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }

  /** The HMAC the app expects, or null when the request is not signed. */
  function signatureOf(headers: Record<string, string>, payload: string): string {
    const profileId = headers['x-quizlab-profile-id'] ?? ''
    return createHmac('sha256', bridge.secret).update(`${profileId}\n${payload}`).digest('hex')
  }

  const fetch = async (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) => {
    const url = new URL(input)
    if (!bridge.active || Number(url.port) !== PORT) throw new TypeError('Failed to fetch')
    const headers = (init?.headers ?? {}) as Record<string, string>

    if (url.pathname === HEALTH_PATH) {
      bridge.healthCalls += 1
      return respond(200, {
        status: 'ok',
        timestamp: 'now',
        instanceId: bridge.instanceId,
        protocolVersion: 3
      })
    }

    if (url.pathname === SITES_PATH) {
      bridge.siteListCalls += 1
      bridge.lastSitesHeaders = { ...headers }
      bridge.siteListSignatures.push(headers['x-hmac-signature'] ?? '')
      if (bridge.beforeSiteList) await bridge.beforeSiteList(headers)
      if (bridge.siteListStatus !== 200) return respond(bridge.siteListStatus, { error: 'nope' })
      if (headers['x-hmac-signature'] !== signatureOf(headers, SITES_PATH)) {
        return respond(401, { error: 'Invalid signature' })
      }
      return respond(200, {
        protocolVersion: 3,
        configVersion: bridge.configVersion,
        targets: bridge.targets,
        selectedProfileId: bridge.selectedProfileId,
        selectionVersion: bridge.selectionVersion
      })
    }

    if (url.pathname === COOKIES_PATH) {
      if (bridge.cookieStatus !== null) {
        return respond(bridge.cookieStatus, bridge.cookieStatusBody)
      }
      if (headers['x-hmac-signature'] !== signatureOf(headers, init?.body ?? '')) {
        return respond(401, { error: 'Invalid signature' })
      }
      const packet = JSON.parse(init?.body ?? '{}') as {
        targetId: string
        status: string
        cookies: unknown[]
      }
      bridge.packets.push({
        targetId: packet.targetId,
        status: packet.status,
        cookies: packet.cookies.length
      })
      const answer = bridge.answerPacket({
        targetId: packet.targetId,
        status: packet.status,
        cookies: packet.cookies.length
      })
      return respond(answer.status, answer.body)
    }

    return respond(404, { error: 'Not found' })
  }

  const context = vm.createContext({
    chrome,
    fetch,
    console: {
      log: () => {},
      warn: (...args: unknown[]) => warnings.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => warnings.push(args.map(String).join(' '))
    },
    crypto: globalThis.crypto,
    TextEncoder,
    AbortSignal,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  })

  vm.runInContext(SOURCE, context, { filename: 'background.js' })

  const worker = {
    storage,
    bridge,
    alarms,
    cookies,
    warnings,
    context,
    read<T>(expression: string): T {
      return vm.runInContext(expression, context) as T
    },
    async settle(turns = 4): Promise<void> {
      // The worker talks to the bridge in a chain of async steps. A fixed
      // number of event-loop turns would race the chain, so the harness waits
      // until the bridge has seen no new request for two rounds.
      let previous = Number.NaN
      for (let round = 0; round < 20; round += 1) {
        await flush(turns)
        const signature = bridge.healthCalls + bridge.siteListCalls * 7 + bridge.packets.length * 13
        if (signature === previous) return
        previous = signature
      }
    },
    fireAlarm(name: string): void {
      for (const listener of listeners.alarm) listener({ name })
    },
    fireCookieChange(cookie: Partial<FakeCookie>): void {
      for (const listener of listeners.cookie) listener({ cookie })
    },
    fireNavigation(): void {
      for (const listener of listeners.navigation) listener()
    },
    send(message: Record<string, unknown>): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        let answered = false
        const sendResponse = (value: Record<string, unknown>) => {
          if (answered) return
          answered = true
          resolve(value)
        }
        for (const listener of listeners.message) {
          const keepsOpen = listener(message, {}, sendResponse)
          if (!keepsOpen) break
        }
      })
    },
    setFailLocalSet(next: ((values: Record<string, unknown>) => boolean) | null): void {
      failLocalSet = next
    }
  }

  return worker
}

describe('the extension worker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('enters scan mode after a failed scan even while it believes it is connected', async () => {
    const worker = createHarness()
    await worker.settle()

    // The top-level scan connected and installed the heartbeat.
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.read<boolean>('connected')).toBe(true)

    // The app is gone, and the heartbeat alarm is missing as well (a killed
    // worker, a browser that dropped it). A scan that fails must not leave the
    // worker believing it is connected with no alarm to wake it again.
    worker.bridge.active = false
    worker.alarms.delete(HEARTBEAT_ALARM)
    await worker.read<Promise<string>>('scanForBridge()').catch(() => 'failed')
    await worker.settle()

    expect(worker.read<boolean>('connected')).toBe(false)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(false)
  })

  it('keeps a scan alarm armed across repeated failed scans and reconnects when the app returns', async () => {
    const worker = createHarness()
    await worker.settle()

    worker.bridge.active = false
    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    expect(worker.alarms.has(SCAN_ALARM)).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(false)

    // A second failed scan re-arms the one-shot alarm instead of losing it.
    worker.fireAlarm(SCAN_ALARM)
    await worker.settle()
    expect(worker.alarms.has(SCAN_ALARM)).toBe(true)

    worker.bridge.active = true
    worker.fireAlarm(SCAN_ALARM)
    await worker.settle()
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
    expect(worker.read<boolean>('connected')).toBe(true)
  })

  it('runs one scan when two callers ask for a scan at the same time', async () => {
    const worker = createHarness()
    await worker.settle()
    const before = worker.bridge.healthCalls

    await worker.read<Promise<unknown>>('Promise.allSettled([scanForBridge(), scanForBridge()])')
    await worker.settle()

    // A single flight: the two callers share one connection attempt and one
    // connection state, so the last one to finish cannot overwrite the other.
    expect(worker.bridge.healthCalls - before).toBe(1)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
  })

  it('reports a correct pairing without requiring a single cookie', async () => {
    const worker = createHarness({ cookies: [] })
    await worker.settle()
    worker.bridge.packets.length = 0

    const response = await worker.send({ type: 'pair', secret: SECRET })

    expect(response).toMatchObject({ success: true })
    // The app was told that the browser holds no session; only `ok` packets
    // carry cookies, and pairing is not a cookie transfer.
    expect(worker.bridge.packets.map((packet) => packet.status)).toEqual(['no_cookies'])
    expect(worker.storage.local.bridgeSecret).toBe(SECRET)
  })

  it('reports a wrong pairing code as a rejected code, not as an unreachable app', async () => {
    const worker = createHarness({ bridge: { secret: OTHER_SECRET } })
    await worker.settle()

    const response = await worker.send({ type: 'pair', secret: SECRET })

    expect(response).toMatchObject({ success: false, error: 'invalid_code' })
    // The working (or in this case wrong) code is not persisted.
    expect(worker.storage.local.bridgeSecret).toBe(SECRET)
  })

  it('reports an unreachable app when no port answers', async () => {
    const worker = createHarness({ bridge: { active: false } })
    await worker.settle()

    const response = await worker.send({ type: 'pair', secret: SECRET })

    expect(response).toMatchObject({ success: false, error: 'bridge_unreachable' })
  })

  it('marks a stored pairing code the app no longer accepts as rejected', async () => {
    // The app regenerated its secret: the extension still holds the old one.
    // That is not "the app is not running", and the popup has to say so.
    const worker = createHarness({
      storage: {
        local: {
          profileId: PROFILE_ID,
          profileName: PROFILE_NAME,
          bridgeSecret: OTHER_SECRET
        },
        session: {}
      }
    })
    await worker.settle()

    expect(worker.read<boolean>('pairingInvalid')).toBe(true)
    expect(worker.storage.session.pairingInvalid).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(false)

    const response = await worker.send({ type: 'pair', secret: SECRET })
    expect(response).toMatchObject({ success: true })
    expect(worker.storage.session.pairingInvalid).toBe(false)
  })

  it('keeps the pairing success when the following import is refused', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.bridge.answerPacket = () => ({
      status: 403,
      body: { error: 'session_unverified', retryable: false }
    })

    const response = await worker.send({ type: 'pair', secret: SECRET })

    // Pairing and transfer are two different results: the code was accepted,
    // so the pairing succeeded even though nothing was imported.
    expect(response).toMatchObject({ success: true, result: 'refused' })
  })

  it('reports a profile that paired but is not the source the app selected', async () => {
    const worker = createHarness({ bridge: { selectedProfileId: 'another-profile' } })
    await worker.settle()

    const response = await worker.send({ type: 'pair', secret: SECRET })

    expect(response).toMatchObject({ success: true, notSelected: true })
  })

  it('pairs again with the same code of an already paired profile', async () => {
    const worker = createHarness()
    await worker.settle()

    await expect(worker.send({ type: 'pair', secret: SECRET })).resolves.toMatchObject({
      success: true
    })
  })

  it('records an empty browser session once instead of retrying it every poll', async () => {
    const worker = createHarness({ cookies: [] })
    await worker.settle()

    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.bridge.packets[0].status).toBe('no_cookies')

    for (let tick = 0; tick < 3; tick += 1) {
      worker.fireAlarm(HEARTBEAT_ALARM)
      await worker.settle()
    }

    // A normal state is not a failed transfer: the site is not queued again.
    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('reports a missing host permission once instead of retrying it every poll', async () => {
    const worker = createHarness({ permissionDenied: true })
    await worker.settle()

    expect(worker.bridge.packets.map((packet) => packet.status)).toEqual(['permission_missing'])

    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()

    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('pushes a site again when its cookies appear after an empty report', async () => {
    const worker = createHarness({ cookies: [] })
    await worker.settle()

    worker.cookies.push(createCookie())
    worker.fireCookieChange({ domain: '.chatgpt.com', name: 'session', value: 'v1' })
    await vi.advanceTimersByTimeAsync(2100)
    await worker.settle()

    expect(worker.bridge.packets.map((packet) => packet.status)).toEqual(['no_cookies', 'ok'])
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('retries a stale round with a fresh site list instead of waiting for the next poll', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.bridge.packets.length = 0

    let calls = 0
    worker.bridge.answerPacket = (packet) => {
      calls += 1
      if (calls === 1) return { status: 409, body: { error: 'stale_round', retryable: true } }
      return {
        status: 200,
        body: {
          success: true,
          accepted: true,
          importSucceeded: true,
          imported: packet.cookies,
          failed: 0,
          retryable: false
        }
      }
    }
    worker.bridge.configVersion = 2

    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    await vi.advanceTimersByTimeAsync(1500)
    await worker.settle()

    // The retry asked for the current site list (a new round) before it sent
    // the packet again, and the packet landed.
    expect(worker.bridge.packets).toHaveLength(2)
    expect(worker.bridge.siteListCalls).toBeGreaterThanOrEqual(3)
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('does not retry a refusal that can never succeed', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.bridge.packets.length = 0
    worker.bridge.answerPacket = () => ({
      status: 403,
      body: { error: 'session_unverified', retryable: false }
    })

    worker.bridge.configVersion = 2
    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    await vi.advanceTimersByTimeAsync(2000)
    await worker.settle()

    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('delivers a cookie change that was pending when the worker was terminated', async () => {
    const worker = createHarness()
    await worker.settle()
    expect(worker.bridge.packets).toHaveLength(1)

    worker.cookies[0].value = 'v2'
    worker.fireCookieChange({ domain: '.chatgpt.com', name: 'session', value: 'v2' })
    await worker.settle()
    // The debounce has not fired: the worker dies here.
    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.storage.session.pendingChangedDomains).toEqual(['.chatgpt.com'])
    vi.clearAllTimers()

    const restarted = createHarness({ storage: worker.storage, cookies: worker.cookies })
    await restarted.settle()
    await vi.advanceTimersByTimeAsync(2100)
    await restarted.settle()

    expect(restarted.bridge.packets).toHaveLength(1)
    expect(restarted.read<string[]>('[...changedDomains]')).toEqual([])
  })

  it('keeps the persisted name when a rename cannot be written', async () => {
    const worker = createHarness({
      failLocalSet: (values) => Object.hasOwn(values, 'profileName')
    })
    await worker.settle()

    const response = await worker.send({ type: 'set_profile_name', name: 'New Chrome' })

    expect(response).toMatchObject({ success: false })
    expect(worker.storage.local.profileName).toBe(PROFILE_NAME)
    // The name the app is told must stay the one that is on disk.
    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    expect(worker.bridge.lastSitesHeaders['x-quizlab-profile-name']).toBe(
      encodeURIComponent(PROFILE_NAME)
    )
  })

  it('does not change the automatic preference when its write fails', async () => {
    const worker = createHarness({
      failLocalSet: (values) => Object.hasOwn(values, 'autoSync')
    })
    await worker.settle()

    const response = await worker.send({ type: 'set_auto_sync', enabled: false })

    expect(response).toMatchObject({ success: false, settingsSaved: false })
    expect(worker.read<boolean>('autoSync')).toBe(true)
    expect(worker.storage.local.autoSync).toBeUndefined()
  })

  it('never changes the automatic sync preference on a manual transfer', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.storage.local.autoSync = true

    const delivered = await worker.send({ type: 'sync_now' })

    // "Sync now" is a one-off transfer; it is not a setting.
    expect(delivered).toMatchObject({ success: true, autoSync: true })
    expect(worker.read<boolean>('autoSync')).toBe(true)
    expect(worker.storage.local.autoSync).toBe(true)
  })

  it('keeps automatic syncing off after a manual transfer', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.storage.local.autoSync = false
    const restarted = createHarness({ storage: worker.storage })
    await restarted.settle()

    const response = await restarted.send({ type: 'sync_now' })

    expect(response).toMatchObject({ success: true, autoSync: false })
    expect(restarted.read<boolean>('autoSync')).toBe(false)
    expect(restarted.storage.local.autoSync).toBe(false)
  })

  it('keeps the automatic preference after a partial transfer', async () => {
    const worker = createHarness({
      cookies: [createCookie()],
      bridge: {
        targets: [
          { siteId: 'chatgpt', label: 'ChatGPT', cookieDomains: ['.chatgpt.com'] },
          { siteId: 'claude', label: 'Claude', cookieDomains: ['.claude.ai'] }
        ]
      }
    })
    await worker.settle()
    worker.storage.local.autoSync = true

    const response = await worker.send({ type: 'sync_now' })

    expect(response).toMatchObject({ success: false, result: 'partial', autoSync: true })
    expect(worker.storage.local.autoSync).toBe(true)
  })

  it('keeps automatic syncing on when a manual transfer fails', async () => {
    const worker = createHarness()
    await worker.settle()
    worker.storage.local.autoSync = true
    worker.bridge.answerPacket = () => ({
      status: 403,
      body: { error: 'session_unverified', retryable: false }
    })

    const failed = await worker.send({ type: 'sync_now' })

    expect(failed).toMatchObject({ success: false, autoSync: true })
    expect(worker.storage.local.autoSync).toBe(true)
  })

  it('reports a manual transfer that found no browser session as such', async () => {
    const worker = createHarness({ cookies: [] })
    await worker.settle()

    const response = await worker.send({ type: 'sync_now' })

    expect(response).toMatchObject({ success: false, result: 'no_cookies' })
  })

  it('keeps the committed pairing while a wrong code is being probed', async () => {
    // The pairing probe runs with a candidate code that the worker does not
    // own yet. A heartbeat that overlaps it must keep signing with the code the
    // worker really holds: a wrong candidate may not disconnect a working
    // extension or mark its stored code as rejected.
    let releaseProbe!: () => void
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    let gateArmed = false
    let gated = false
    const worker = createHarness({
      bridge: {
        beforeSiteList: async () => {
          if (!gateArmed || gated) return
          gated = true
          await probeGate
        }
      }
    })
    await worker.settle()
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)

    // From here on the next site-list request (the pairing probe) is held.
    gateArmed = true
    const pairing = worker.send({ type: 'pair', secret: OTHER_SECRET })
    // Let the pair handler reach the gated probe request, then queue the
    // heartbeat behind it.
    await worker.settle()
    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    releaseProbe()

    await expect(pairing).resolves.toMatchObject({ success: false, error: 'invalid_code' })
    await worker.settle()

    expect(worker.read<boolean>('pairingInvalid')).toBe(false)
    expect(worker.read<boolean>('connected')).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
    // The probe used the candidate; the heartbeat used the stored code.
    expect(worker.bridge.siteListSignatures).toContain(siteListSignature(OTHER_SECRET))
    expect(worker.bridge.siteListSignatures.at(-1)).toBe(siteListSignature(SECRET))
  })

  it('keeps the connection when a re-pairing overlaps a heartbeat', async () => {
    // The stored code is the one the app no longer accepts; the user pastes
    // the new one. A heartbeat that runs during the probe still holds the old
    // code and is answered with 401 — that result must not undo the pairing.
    let releaseProbe!: () => void
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    let gateArmed = false
    let gated = false
    const worker = createHarness({
      storage: {
        local: {
          profileId: PROFILE_ID,
          profileName: PROFILE_NAME,
          bridgeSecret: OTHER_SECRET
        },
        session: {}
      },
      bridge: {
        beforeSiteList: async () => {
          if (!gateArmed || gated) return
          gated = true
          await probeGate
        }
      }
    })
    await worker.settle()
    expect(worker.read<boolean>('pairingInvalid')).toBe(true)

    gateArmed = true
    const pairing = worker.send({ type: 'pair', secret: SECRET })
    await worker.settle()
    worker.fireAlarm(HEARTBEAT_ALARM)
    await worker.settle()
    releaseProbe()

    await expect(pairing).resolves.toMatchObject({ success: true })
    await worker.settle()

    expect(worker.read<boolean>('pairingInvalid')).toBe(false)
    expect(worker.read<boolean>('connected')).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
  })

  it('does not adopt a probe’s app instance before the code is verified', async () => {
    let releaseProbe!: () => void
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    let gateArmed = false
    let gated = false
    const worker = createHarness({
      bridge: {
        beforeSiteList: async () => {
          if (!gateArmed || gated) return
          gated = true
          await probeGate
        }
      }
    })
    await worker.settle()
    expect(worker.read<string>('bridgeInstanceId')).toBe('instance-1')

    // The app restarted between the last poll and this pairing attempt.
    worker.bridge.instanceId = 'instance-2'
    gateArmed = true
    const pairing = worker.send({ type: 'pair', secret: OTHER_SECRET })
    await worker.settle()

    // The candidate instance is not the active connection until the app
    // proved that it holds the candidate code.
    expect(worker.read<string>('bridgeInstanceId')).toBe('instance-1')
    expect(worker.read<number>('bridgePort')).toBe(PORT)

    // A navigation wake-up joins the probe instead of opening a second
    // connection attempt with the unverified candidate.
    const healthCalls = worker.bridge.healthCalls
    worker.fireNavigation()
    await worker.settle()
    expect(worker.bridge.healthCalls).toBe(healthCalls)

    releaseProbe()
    await expect(pairing).resolves.toMatchObject({ success: false, error: 'invalid_code' })
    await worker.settle()

    expect(worker.read<string>('bridgeInstanceId')).toBe('instance-1')
    expect(worker.read<number>('bridgePort')).toBe(PORT)
    expect(worker.read<boolean>('connected')).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
  })

  it('keeps the committed instance when a manual sync overlaps a pairing probe', async () => {
    let releaseProbe!: () => void
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    let gateArmed = false
    let gated = false
    const worker = createHarness({
      bridge: {
        beforeSiteList: async () => {
          if (!gateArmed || gated) return
          gated = true
          await probeGate
        }
      }
    })
    await worker.settle()
    worker.bridge.instanceId = 'instance-2'
    gateArmed = true

    const pairing = worker.send({ type: 'pair', secret: OTHER_SECRET })
    await worker.settle()
    const manual = worker.send({ type: 'sync_now' })
    releaseProbe()

    const [pairingResponse, manualResponse] = await Promise.all([pairing, manual])
    await worker.settle()

    expect(pairingResponse).toMatchObject({ success: false, error: 'invalid_code' })
    expect(manualResponse).toMatchObject({ success: true })
    expect(worker.read<{ instanceId: string }>('lastPush').instanceId).toBe('instance-1')
    expect(worker.read<string>('bridgeInstanceId')).toBe('instance-1')
  })

  it('keeps a successful pairing when a wrong request overlaps it', async () => {
    let releaseProbe!: () => void
    const probeGate = new Promise<void>((resolve) => {
      releaseProbe = resolve
    })
    const worker = createHarness({
      bridge: {
        beforeSiteList: async () => {
          // The initial scan and the correct request are calls 1 and 2; hold
          // the wrong request that follows the successful pairing.
          if (worker.bridge.siteListCalls !== 3) return
          await probeGate
        }
      }
    })
    await worker.settle()
    worker.bridge.instanceId = 'instance-2'

    const correct = worker.send({ type: 'pair', secret: SECRET })
    const wrong = worker.send({ type: 'pair', secret: OTHER_SECRET })
    await worker.settle()

    // The first request is done; the second is the only pairing in flight.
    expect(worker.read<boolean>('pairingInFlight')).toBe(true)

    releaseProbe()
    await expect(correct).resolves.toMatchObject({ success: true })
    await expect(wrong).resolves.toMatchObject({ success: false, error: 'invalid_code' })
    await worker.settle()

    // The wrong request may not undo the successful one.
    expect(worker.storage.local.bridgeSecret).toBe(SECRET)
    expect(worker.read<string>('bridgeInstanceId')).toBe('instance-2')
    expect(worker.read<boolean>('pairingInvalid')).toBe(false)
    expect(worker.read<boolean>('connected')).toBe(true)
    expect(worker.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(worker.alarms.has(SCAN_ALARM)).toBe(false)
  })

  it('keeps a verified pairing across a worker restart when the local store kept the old code', async () => {
    const worker = createHarness({
      storage: {
        local: {
          profileId: PROFILE_ID,
          profileName: PROFILE_NAME,
          bridgeSecret: OTHER_SECRET
        },
        session: {}
      },
      failLocalSet: (values) => Object.hasOwn(values, 'bridgeSecret')
    })
    await worker.settle()

    const response = await worker.send({ type: 'pair', secret: SECRET })

    expect(response).toMatchObject({ success: true, settingsSaved: false })
    expect(worker.storage.session.bridgeSecret).toBe(SECRET)
    expect(worker.storage.local.bridgeSecret).toBe(OTHER_SECRET)

    // The session store survives a service-worker restart and holds the code
    // the app just verified; the local store only survived a browser restart
    // and holds the old one. The verified code must win.
    const restarted = createHarness({ storage: worker.storage })
    await restarted.settle()

    expect(restarted.read<boolean>('pairingInvalid')).toBe(false)
    expect(restarted.read<boolean>('connected')).toBe(true)
    expect(restarted.alarms.has(HEARTBEAT_ALARM)).toBe(true)
    expect(restarted.bridge.siteListSignatures.at(-1)).toBe(siteListSignature(SECRET))
  })

  it('retries a pending packet after a worker restart instead of losing it', async () => {
    let calls = 0
    const worker = createHarness()
    worker.bridge.answerPacket = (packet) => {
      calls += 1
      if (calls === 1) return { status: 409, body: { error: 'stale_round', retryable: true } }
      return {
        status: 200,
        body: {
          success: true,
          accepted: true,
          importSucceeded: true,
          imported: packet.cookies,
          failed: 0,
          retryable: false
        }
      }
    }
    await worker.settle()

    expect(worker.bridge.packets).toHaveLength(1)
    expect(worker.read<string[]>('[...pendingSiteIds]')).toEqual(['chatgpt'])
    expect(worker.storage.session.pendingSiteIds).toEqual(['chatgpt'])

    // The 1 s retry timer has not fired: the service worker is terminated now.
    vi.clearAllTimers()

    const restarted = createHarness({ storage: worker.storage, cookies: worker.cookies })
    await restarted.settle()

    // The pending site was persisted before the retry outcome, so the new
    // worker pushes it without waiting for a manual action.
    expect(restarted.bridge.packets.map((packet) => packet.status)).toEqual(['ok'])
    expect(restarted.read<string[]>('[...pendingSiteIds]')).toEqual([])
  })

  it('reports a mixed manual transfer as a failure, not as a success', async () => {
    const worker = createHarness({
      cookies: [createCookie(), createCookie({ name: 'sessionKey', domain: '.claude.ai' })],
      bridge: {
        targets: [
          { siteId: 'chatgpt', label: 'ChatGPT', cookieDomains: ['.chatgpt.com'] },
          { siteId: 'claude', label: 'Claude', cookieDomains: ['.claude.ai'] }
        ],
        answerPacket: (packet) =>
          packet.targetId === 'chatgpt'
            ? {
                status: 200,
                body: {
                  success: true,
                  accepted: true,
                  importSucceeded: true,
                  imported: packet.cookies,
                  failed: 0,
                  retryable: false
                }
              }
            : { status: 403, body: { error: 'session_unverified', retryable: false } }
      }
    })
    await worker.settle()
    const before = worker.bridge.packets.length

    const response = await worker.send({ type: 'sync_now' })

    // One site was imported, one was refused: the transfer as a whole did not
    // succeed, and the popup may not say that both sessions arrived.
    expect(response).toMatchObject({ success: false, result: 'refused' })
    expect(worker.bridge.packets.slice(before).map((packet) => packet.targetId)).toEqual([
      'chatgpt',
      'claude'
    ])
  })

  it('reports a transfer where one site had no browser session as partial', async () => {
    const worker = createHarness({
      cookies: [createCookie()],
      bridge: {
        targets: [
          { siteId: 'chatgpt', label: 'ChatGPT', cookieDomains: ['.chatgpt.com'] },
          { siteId: 'claude', label: 'Claude', cookieDomains: ['.claude.ai'] }
        ]
      }
    })
    await worker.settle()

    const response = await worker.send({ type: 'sync_now' })

    // One session was imported and one site had nothing to import. A plain
    // "ok" would let the popup claim that the whole transfer succeeded.
    expect(response).toMatchObject({ success: false, result: 'partial' })
  })
})
