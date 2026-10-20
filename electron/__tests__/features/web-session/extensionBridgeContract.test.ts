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
}

interface Harness {
  readonly fetchCalls: FetchCall[]
  readonly cookieQueries: string[]
  readonly packets: Packet[]
  readonly logs: string[]
  readonly storage: Map<string, unknown>
  bridgePort: number | null
  setSiteList(siteList: SiteList): void
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
  const packets: Packet[] = []
  const logs: string[] = []
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

    if (target.endsWith(SITE_LIST_PATH)) {
      return jsonResponse(siteList)
    }
    if (target.endsWith(COOKIE_PATH)) {
      if (failingPackets > 0) {
        failingPackets -= 1
        return jsonResponse({ error: 'Internal error' }, 500)
      }
      packets.push(JSON.parse(String(init?.body ?? '{}')) as Packet)
      return jsonResponse({ success: true })
    }
    if (target.endsWith('/api/health')) {
      bridgePort = Number(new URL(target).port)
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
      warn: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      log: (...args: unknown[]) => logs.push(args.map(String).join(' '))
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
    packets,
    logs,
    storage,
    get bridgePort() {
      return bridgePort
    },
    setSiteList(next: SiteList) {
      siteList = next
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

    const call = harness.fetchCalls.find((entry) => entry.url.endsWith(SITE_LIST_PATH))
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

    const call = harness.fetchCalls.find((entry) => entry.url.endsWith(COOKIE_PATH))
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

  it('does not push when nothing changed', async () => {
    const harness = createHarness()
    await harness.settle()
    expect(harness.packets).toHaveLength(2)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('repeats a push the app refused', async () => {
    const harness = createHarness({ failPackets: 2 })
    await harness.settle()
    expect(harness.packets).toHaveLength(0)

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('looks for the bridge again when the scan alarm fires', async () => {
    const harness = createHarness()
    await harness.settle()
    const healthCallsBefore = harness.fetchCalls.filter((entry) =>
      entry.url.endsWith('/api/health')
    ).length

    harness.fireAlarm(SCAN_ALARM)
    await harness.settle()

    const healthCallsAfter = harness.fetchCalls.filter((entry) =>
      entry.url.endsWith('/api/health')
    ).length
    expect(healthCallsAfter).toBeGreaterThan(healthCallsBefore)
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

    const second = createHarness({
      storage: {
        bridgePort: first.bridgePort,
        lastConfigVersion: DEFAULT_SITE_LIST.configVersion,
        knownTargets: DEFAULT_SITE_LIST.targets
      }
    })
    await second.settle()

    expect(second.packets).toHaveLength(0)
  })

  it('never logs a cookie value', async () => {
    const harness = createHarness()
    await harness.settle()

    const logged = harness.logs.join('\n')
    expect(logged).not.toContain('chatgpt-domain-wide')
    expect(logged).not.toContain('chatgpt-host-only')
    expect(logged).not.toContain('claude-domain-wide')
  })

  it('keeps the alarm loop and the navigation wake-up alive', () => {
    expect(source).toContain('chrome.alarms.create')
    expect(source).toContain('chrome.webNavigation.onCompleted')
    expect(source).not.toContain('setInterval')
  })
})
