import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

const BACKGROUND_PATH = path.join(
  process.cwd(),
  'extensions/quizlab-session-extension/background.js'
)

const source = readFileSync(BACKGROUND_PATH, 'utf-8')

const BRIDGE_SECRET = 'bridge-secret-for-the-test'
const EXTENSION_ID = 'quizlab-test-extension'
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'
const HEALTH_PATH = '/api/health'

interface FakeCookie {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: string
  expirationDate?: number
}

interface SiteTarget {
  siteId: string
  cookieDomains: string[]
}

interface SiteList {
  protocolVersion: number
  configVersion: number
  targets: SiteTarget[]
}

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

interface Packet {
  targetId: string
  status: string
  cookies: FakeCookie[]
}

interface LogEntry {
  level: string
  message: string
}

const DEFAULT_SITE_LIST: SiteList = {
  protocolVersion: 2,
  configVersion: 7,
  targets: [
    { siteId: 'chatgpt', cookieDomains: ['.chatgpt.com', '.openai.com'] },
    { siteId: 'claude', cookieDomains: ['.claude.ai'] }
  ]
}

const DEFAULT_COOKIES: Record<string, FakeCookie[]> = {
  '.chatgpt.com': [
    {
      name: '__Secure-1PSID',
      value: 'chatgpt-domain-wide',
      domain: '.chatgpt.com',
      path: '/',
      secure: true
    }
  ],
  'chatgpt.com': [
    {
      name: '__Secure-1PSID',
      value: 'chatgpt-host-only',
      domain: 'chatgpt.com',
      path: '/',
      secure: true
    }
  ],
  '.claude.ai': [
    {
      name: 'sessionKey',
      value: 'claude-domain-wide',
      domain: '.claude.ai',
      path: '/',
      secure: true
    }
  ]
}

interface HarnessOptions {
  siteList?: SiteList
  cookies?: Record<string, FakeCookie[]>
  grantedOrigins?: 'all' | 'none' | string[]
  storage?: Record<string, unknown>
  /** How many of the first cookie packets the app refuses. */
  failPackets?: number
  /** The port the bridge answers on; every other port refuses the connection. */
  bridgePort?: number
  /** The permissions API fails instead of answering. */
  permissionsThrow?: boolean
}

interface Harness {
  readonly fetchCalls: FetchCall[]
  readonly cookieQueries: string[]
  /** Every packet the extension sent, accepted or not. */
  readonly attempts: Packet[]
  /** The packets the app accepted. */
  readonly packets: Packet[]
  readonly permissionQueries: string[]
  readonly logs: LogEntry[]
  readonly storage: Map<string, unknown>
  bridgePort: number | null
  setSiteList(siteList: SiteList): void
  failNextPackets(count: number): void
  fireAlarm(name: string): void
  fireCookieChanged(cookie: FakeCookie): void
  runTimers(): Promise<void>
  settle(): Promise<void>
}

/** A response the fake bridge answers with. */
function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  }
}

/**
 * Runs the extension's service worker against a fake Chrome and a fake bridge.
 *
 * The extension is plain JavaScript without a build step, so it cannot be
 * imported by the test runner. It is executed in a sandbox instead: the fake
 * Chrome records the cookie queries and the fake bridge records the requests,
 * which lets the test pin the behaviour the app depends on.
 */
function createHarness(options: HarnessOptions = {}): Harness {
  const fetchCalls: FetchCall[] = []
  const cookieQueries: string[] = []
  const attempts: Packet[] = []
  const packets: Packet[] = []
  const permissionQueries: string[] = []
  const logs: LogEntry[] = []
  const storage = new Map<string, unknown>(Object.entries(options.storage ?? {}))
  const timers = new Map<number, () => void>()
  const alarmListeners: ((alarm: { name: string }) => void)[] = []
  const cookieListeners: ((change: {
    cookie: FakeCookie
    removed: boolean
    cause: string
  }) => void)[] = []

  let siteList = options.siteList ?? DEFAULT_SITE_LIST
  const cookies = options.cookies ?? DEFAULT_COOKIES
  const granted = options.grantedOrigins ?? 'all'
  const bridgePortOption = options.bridgePort ?? null
  const permissionsThrow = options.permissionsThrow === true
  let failingPackets = options.failPackets ?? 0
  let timerId = 0
  let bridgePort: number | null = null

  const fakeChrome = {
    runtime: {
      id: EXTENSION_ID,
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} }
    },
    alarms: {
      create: () => {},
      clear: async () => {},
      onAlarm: {
        addListener: (listener: (alarm: { name: string }) => void) => {
          alarmListeners.push(listener)
        }
      }
    },
    cookies: {
      getAll: async (query: { domain?: string }) => {
        const domain = query.domain ?? ''
        cookieQueries.push(domain)
        return cookies[domain] ?? []
      },
      onChanged: {
        addListener: (
          listener: (change: { cookie: FakeCookie; removed: boolean; cause: string }) => void
        ) => {
          cookieListeners.push(listener)
        }
      }
    },
    storage: {
      session: {
        get: async (keys: string[]) => {
          const stored: Record<string, unknown> = {}
          for (const key of keys) {
            if (storage.has(key)) stored[key] = storage.get(key)
          }
          return stored
        },
        set: async (values: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(values)) storage.set(key, value)
        }
      }
    },
    permissions: {
      contains: async (query: { origins?: string[] }) => {
        const origins = query.origins ?? []
        permissionQueries.push(...origins)
        if (permissionsThrow) throw new Error('the permissions API is not available')
        if (granted === 'all') return true
        if (granted === 'none') return false
        return origins.every((origin) => granted.includes(origin))
      }
    },
    webNavigation: {
      onCompleted: { addListener: () => {} }
    }
  }

  const fakeFetch = async (url: string, init?: RequestInit) => {
    const target = String(url)
    const headers = (init?.headers ?? {}) as Record<string, string>
    const method = init?.method ?? 'GET'
    fetchCalls.push({ url: target, method, headers, body: String(init?.body ?? '') })

    const port = Number(new URL(target).port)
    if (bridgePortOption !== null && port !== bridgePortOption) {
      // Nothing listens on that port: the connection is refused.
      throw new Error(`connect ECONNREFUSED 127.0.0.1:${port}`)
    }

    if (target.endsWith(SITE_LIST_PATH)) {
      return jsonResponse(siteList)
    }
    if (target.endsWith(COOKIE_PATH)) {
      const packet = JSON.parse(String(init?.body ?? '{}')) as Packet
      attempts.push(packet)
      if (failingPackets > 0) {
        failingPackets -= 1
        return jsonResponse({ error: 'Internal error' }, 500)
      }
      packets.push(packet)
      return jsonResponse({ success: true })
    }
    if (target.endsWith(HEALTH_PATH)) {
      bridgePort = port
      return jsonResponse({
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
        secret: BRIDGE_SECRET,
        protocolVersion: 2
      })
    }
    return jsonResponse({ error: 'Not found' }, 404)
  }

  const context = vm.createContext({
    chrome: fakeChrome,
    fetch: fakeFetch,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    AbortSignal: globalThis.AbortSignal,
    console: {
      log: (...args: unknown[]) => logs.push({ level: 'log', message: args.map(String).join(' ') }),
      warn: (...args: unknown[]) =>
        logs.push({ level: 'warn', message: args.map(String).join(' ') }),
      error: (...args: unknown[]) =>
        logs.push({ level: 'error', message: args.map(String).join(' ') })
    },
    setTimeout: (callback: () => void) => {
      const id = ++timerId
      timers.set(id, callback)
      return id
    },
    clearTimeout: (id: number) => {
      timers.delete(id)
    }
  })

  vm.runInContext(source, context, { filename: BACKGROUND_PATH })

  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 3; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return {
    fetchCalls,
    cookieQueries,
    attempts,
    packets,
    permissionQueries,
    logs,
    storage,
    get bridgePort() {
      return bridgePort
    },
    setSiteList(next: SiteList) {
      siteList = next
    },
    failNextPackets(count: number) {
      failingPackets = count
    },
    fireAlarm(name: string) {
      for (const listener of alarmListeners) listener({ name })
    },
    fireCookieChanged(cookie: FakeCookie) {
      for (const listener of cookieListeners)
        listener({ cookie, removed: false, cause: 'explicit' })
    },
    async runTimers() {
      // The listeners are asynchronous: let them register their timer first.
      await settle()
      const pending = [...timers.values()]
      timers.clear()
      for (const callback of pending) callback()
      await settle()
    },
    settle
  }
}

/** The signature the app expects for a payload. */
function sign(payload: string): string {
  return createHmac('sha256', BRIDGE_SECRET).update(payload).digest('hex')
}

/** The requests the extension sent to a path. */
function callsTo(harness: Harness, pathname: string): FetchCall[] {
  return harness.fetchCalls.filter((entry) => entry.url.endsWith(pathname))
}

describe('extension bridge contract', () => {
  it('pulls the site list from the bridge instead of a hardcoded domain list', () => {
    expect(source).toContain('/api/sites')
    expect(source).not.toContain('const GOOGLE_COOKIE_DOMAINS')
  })

  it('sends one packet per target', () => {
    expect(source).toContain('targetId')
  })

  it('reports the protocol version it speaks', () => {
    expect(source).toContain('protocolVersion')
  })

  it('never writes a cookie itself', () => {
    expect(source).not.toContain('chrome.cookies.set')
    expect(source).not.toContain('chrome.cookies.remove')
  })

  it('names the protocol version on every request it makes', () => {
    expect(source).toContain('x-protocol-version')
  })
})

describe('extension bridge behaviour', () => {
  it('asks the bridge which sites it wants, signed and with the protocol version', async () => {
    const harness = createHarness()
    await harness.settle()

    const call = callsTo(harness, SITE_LIST_PATH)[0]
    expect(call, 'the site list was never requested').toBeDefined()
    expect(call?.method).toBe('GET')
    expect(call?.headers['x-protocol-version']).toBe('2')
    expect(call?.headers['Origin']).toBe(EXTENSION_ORIGIN)
    expect(call?.headers['x-hmac-signature']).toBe(sign(SITE_LIST_PATH))
  })

  it('sends one packet per target and signs every packet over its own body', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.packets).toHaveLength(2)
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['chatgpt', 'claude'])

    const call = callsTo(harness, COOKIE_PATH)[0]
    expect(call?.method).toBe('POST')
    expect(call?.headers['x-protocol-version']).toBe('2')
    expect(call?.headers['Origin']).toBe(EXTENSION_ORIGIN)
    expect(call?.headers['x-hmac-signature']).toBe(sign(call?.body ?? ''))
  })

  it('puts only the cookies of its own site into a packet', async () => {
    const harness = createHarness()
    await harness.settle()

    const chatgpt = harness.packets.find((packet) => packet.targetId === 'chatgpt')
    const claude = harness.packets.find((packet) => packet.targetId === 'claude')
    expect(chatgpt?.cookies.every((cookie) => cookie.domain.endsWith('chatgpt.com'))).toBe(true)
    expect(claude?.cookies.every((cookie) => cookie.domain.endsWith('claude.ai'))).toBe(true)
  })

  it('reads every domain in both spellings', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.cookieQueries).toContain('.chatgpt.com')
    expect(harness.cookieQueries).toContain('chatgpt.com')
    expect(harness.cookieQueries).toContain('.claude.ai')
    expect(harness.cookieQueries).toContain('claude.ai')
  })

  it('reads a domain that is written without a leading dot in both spellings too', async () => {
    const harness = createHarness({
      siteList: {
        protocolVersion: 2,
        configVersion: 7,
        targets: [{ siteId: 'custom', cookieDomains: ['example.org'] }]
      }
    })
    await harness.settle()

    expect(harness.cookieQueries).toContain('example.org')
    expect(harness.cookieQueries).toContain('.example.org')
  })

  it('keeps the host-only and the domain-wide cookie of the same name apart', async () => {
    const harness = createHarness()
    await harness.settle()

    const chatgpt = harness.packets.find((packet) => packet.targetId === 'chatgpt')
    const names = chatgpt?.cookies.map((cookie) => cookie.name) ?? []
    expect(names).toContain('__Secure-1PSID')
    expect(chatgpt?.cookies).toHaveLength(2)
  })

  it('reports a site the browser holds no cookie for', async () => {
    const harness = createHarness({ cookies: { '.chatgpt.com': DEFAULT_COOKIES['.chatgpt.com'] } })
    await harness.settle()

    const claude = harness.packets.find((packet) => packet.targetId === 'claude')
    expect(claude?.status).toBe('no_cookies')
    expect(claude?.cookies).toEqual([])
  })

  it('reports a site it may not read', async () => {
    const harness = createHarness({ cookies: {}, grantedOrigins: 'none' })
    await harness.settle()

    const chatgpt = harness.packets.find((packet) => packet.targetId === 'chatgpt')
    expect(chatgpt?.status).toBe('permission_missing')
  })

  it('asks for the host and the wildcard pattern of a site', async () => {
    const harness = createHarness({ grantedOrigins: ['https://*.chatgpt.com/*'] })
    await harness.settle()

    expect(harness.permissionQueries).toContain('https://chatgpt.com/*')
    expect(harness.permissionQueries).toContain('https://*.chatgpt.com/*')
  })

  it('reports a site it may not read completely as missing, not as read', async () => {
    const harness = createHarness({ grantedOrigins: ['https://*.chatgpt.com/*'] })
    await harness.settle()

    // The chatgpt target has two domains and only one of them may be read:
    // the session of the site is not complete, so it is not imported at all.
    const chatgpt = harness.packets.find((packet) => packet.targetId === 'chatgpt')
    expect(chatgpt?.status).toBe('permission_missing')
    expect(chatgpt?.cookies).toEqual([])

    const claude = harness.packets.find((packet) => packet.targetId === 'claude')
    expect(claude?.status).toBe('permission_missing')
  })

  it('reports a site it may not read when the permission check fails', async () => {
    const harness = createHarness({ permissionsThrow: true })
    await harness.settle()

    const chatgpt = harness.packets.find((packet) => packet.targetId === 'chatgpt')
    expect(chatgpt?.status).toBe('permission_missing')
  })

  it('does not push when nothing changed', async () => {
    const harness = createHarness()
    await harness.settle()
    expect(harness.packets).toHaveLength(2)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('asks the bridge it knows and not the first port of the scan', async () => {
    const harness = createHarness({ bridgePort: 52000 })
    // The worker wakes up: the alarm fires before the scan found the bridge.
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()

    const siteListCalls = callsTo(harness, SITE_LIST_PATH)
    expect(siteListCalls.length).toBeGreaterThan(0)
    expect(siteListCalls.every((entry) => entry.url.includes(':52000/'))).toBe(true)
  })

  it('asks the bridge it remembers after a worker restart', async () => {
    const first = createHarness({ bridgePort: 52000 })
    await first.settle()

    const second = createHarness({
      bridgePort: 52000,
      storage: Object.fromEntries(first.storage)
    })
    second.fireAlarm(HEARTBEAT_ALARM)
    await second.settle()

    const siteListCalls = callsTo(second, SITE_LIST_PATH)
    expect(siteListCalls.length).toBeGreaterThan(0)
    expect(siteListCalls.every((entry) => entry.url.includes(':52000/'))).toBe(true)
    // The app did not change anything, so the sites are not pushed again.
    expect(second.packets).toHaveLength(0)
  })

  it('does not push again after a worker restart when the app did not change', async () => {
    const first = createHarness({ bridgePort: 52000 })
    await first.settle()
    expect(first.packets).toHaveLength(2)

    const second = createHarness({
      bridgePort: 52000,
      storage: Object.fromEntries(first.storage)
    })
    await second.settle()
    second.fireAlarm(HEARTBEAT_ALARM)
    await second.settle()

    expect(second.packets).toHaveLength(0)
  })

  it('repeats a push the app refused', async () => {
    const harness = createHarness({ failPackets: 2 })
    await harness.settle()
    expect(harness.packets).toHaveLength(0)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('repeats a cookie change push the app refused', async () => {
    const harness = createHarness()
    await harness.settle()
    expect(harness.packets).toHaveLength(2)

    harness.failNextPackets(1)
    harness.fireCookieChanged({
      name: '__Secure-1PSID',
      value: 'chatgpt-host-only',
      domain: 'chatgpt.com',
      path: '/'
    })
    await harness.runTimers()
    expect(harness.attempts).toHaveLength(3)
    expect(harness.packets).toHaveLength(2)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.attempts).toHaveLength(4)
    expect(harness.packets).toHaveLength(3)
  })

  it('looks for the bridge again when the scan alarm fires', async () => {
    const harness = createHarness()
    await harness.settle()
    const healthCallsBefore = callsTo(harness, HEALTH_PATH).length

    harness.fireAlarm(SCAN_ALARM)
    await harness.settle()

    expect(callsTo(harness, HEALTH_PATH).length).toBeGreaterThan(healthCallsBefore)
  })

  it('pushes again when the site list of the app changed', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.setSiteList({ ...DEFAULT_SITE_LIST, configVersion: 8 })
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()

    expect(harness.packets).toHaveLength(4)
  })

  it('pushes when a cookie of a known site changes', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.fireCookieChanged({
      name: '__Secure-1PSID',
      value: 'chatgpt-host-only',
      domain: 'chatgpt.com',
      path: '/'
    })
    await harness.runTimers()

    expect(harness.packets).toHaveLength(3)
    expect(harness.packets[2].targetId).toBe('chatgpt')
  })

  it('ignores a cookie of a site the app did not ask for', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.fireCookieChanged({
      name: 'session',
      value: 'somewhere-else',
      domain: '.example.org',
      path: '/'
    })
    await harness.runTimers()

    expect(harness.packets).toHaveLength(2)
  })

  it('tells an app that speaks an older protocol only once', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, protocolVersion: 1 }
    })
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
    expect(harness.packets.every((packet) => packet.status === 'permission_missing')).toBe(true)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('keeps the last seen version in the session storage', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.storage.get('lastConfigVersion')).toBe(DEFAULT_SITE_LIST.configVersion)
    expect(harness.storage.get('knownTargets')).toEqual(DEFAULT_SITE_LIST.targets)
  })

  it('remembers the last seen version across a service worker restart', async () => {
    const first = createHarness()
    await first.settle()
    expect(first.packets).toHaveLength(2)

    // The session storage is all that survives a restart of the worker.
    const second = createHarness({ storage: Object.fromEntries(first.storage) })
    await second.settle()

    expect(second.storage.get('lastConfigVersion')).toBe(DEFAULT_SITE_LIST.configVersion)
    expect(second.packets).toHaveLength(0)
  })

  it('never logs a cookie value', async () => {
    const harness = createHarness()
    await harness.settle()

    const logged = harness.logs.map((entry) => entry.message).join('\n')
    expect(logged).not.toContain('chatgpt-domain-wide')
    expect(logged).not.toContain('chatgpt-host-only')
    expect(logged).not.toContain('claude-domain-wide')
  })

  it('logs an outcome as an outcome and not as a warning', async () => {
    const harness = createHarness()
    await harness.settle()

    const outcome = harness.logs.find((entry) => entry.message.includes('chatgpt'))
    expect(outcome?.level).toBe('log')
  })

  it('keeps the alarm loop and the navigation wake-up alive', () => {
    expect(source).toContain('chrome.alarms.create')
    expect(source).toContain('chrome.webNavigation.onCompleted')
    expect(source).not.toContain('setInterval')
  })
})
