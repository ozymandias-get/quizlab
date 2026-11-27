import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'
import { ADDITIONAL_AI_CHAT_PLATFORMS } from '../../../../shared/constants/aiChatCatalog.js'
import {
  QUIZLAB_DEV_EXTENSION_ID,
  QUIZLAB_DEV_EXTENSION_ORIGIN
} from '../../../../shared/constants/extensionRelease.js'
import {
  SELECTOR_REQUEST_ID_HEADER,
  SELECTOR_SITES_PATH as SHARED_SELECTOR_SITES_PATH,
  SELECTOR_TRANSFER_PATH as SHARED_SELECTOR_TRANSFER_PATH,
  SELECTOR_TRANSFER_VERSION
} from '../../../../shared/constants/selectorTransfer.js'
import { SITE_SESSION_PROTOCOL_VERSION } from '../../../../shared/constants/siteSessionProtocol.js'
import { getSiteSessionCookieDomains } from '../../../../shared/constants/siteSessionCookieDomains.js'

const BACKGROUND_PATH = path.join(
  process.cwd(),
  'extensions/quizlab-session-extension/background.js'
)
const PICKER_PATH = path.join(
  process.cwd(),
  'extensions/quizlab-session-extension/content/picker.js'
)

const source = readFileSync(BACKGROUND_PATH, 'utf-8')

const BRIDGE_SECRET = 'ab'.repeat(32)
const EXTENSION_ID = 'quizlab-test-extension'
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`
const DEV_EXTENSION_ID = QUIZLAB_DEV_EXTENSION_ID
const DEV_EXTENSION_ORIGIN = QUIZLAB_DEV_EXTENSION_ORIGIN
const TEST_PROFILE_ID = 'test-profile-1234'
const TEST_PROFILE_NAME = 'Test Chrome'
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'
const SELECTOR_SITES_PATH = '/api/selectors/sites'
const SELECTOR_TRANSFER_PATH = '/api/selectors'
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
  label?: string
  siteId: string
  cookieDomains: string[]
}

interface SiteList {
  protocolVersion: number
  configVersion: number
  targets: SiteTarget[]
  selectedProfileId?: string | null
  selectionVersion?: number
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
  protocolVersion: 3,
  configVersion: 7,
  targets: [
    { siteId: 'chatgpt', cookieDomains: ['.chatgpt.com', '.openai.com'] },
    { siteId: 'claude', cookieDomains: ['.claude.ai'] }
  ],
  selectedProfileId: TEST_PROFILE_ID
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
  /** How many of the first cookie packets the app refuses as too large. */
  tooLargePackets?: number
  /** How many of the first cookie packets never reach the app. */
  failPosts?: number
  /** The port the bridge answers on; every other port refuses the connection. */
  bridgePort?: number
  /** The permissions API fails instead of answering. */
  permissionsThrow?: boolean
  /** Whether the browser already holds the pairing code. Defaults to true. */
  paired?: boolean
  /** The address the active tab reports. */
  tabUrl?: string
  /** The build the fake Chrome reports: the release build unless set. */
  extensionId?: string
  /**
   * The environment the fake bridge reports in its health answer.
   *
   * Defaults to the environment of the extension. `legacy` omits the field, the
   * way a bridge installed before the two builds existed answers.
   */
  healthEnvironment?: 'dev' | 'prod' | 'legacy'
  /** The answer the fake bridge gives to a selector transfer. */
  selectorResponse?: { status: number; body: unknown }
  /** The error `chrome.scripting.executeScript` throws, if any. */
  injectionError?: string
}

interface Harness {
  message(
    message: Record<string, unknown>
  ): Promise<Record<string, unknown> & { success: boolean; result?: string }>
  messageFromTab(
    message: Record<string, unknown>,
    sender: { tab: { id: number }; frameId: number; documentId?: string }
  ): Promise<Record<string, unknown>>
  readonly fetchCalls: FetchCall[]
  readonly cookieQueries: string[]
  /** Every packet the extension sent, accepted or not. */
  readonly attempts: Packet[]
  /** The packets the app accepted. */
  readonly packets: Packet[]
  readonly selectorPosts: Array<{ body: string; headers: Record<string, string> }>
  readonly injectionCalls: Array<{ tabId: number; files: string[] }>
  readonly tabMessages: Array<{ tabId: number; message: Record<string, unknown> }>
  readonly permissionQueries: string[]
  readonly logs: LogEntry[]
  readonly storage: Map<string, unknown>
  bridgePort: number | null
  setSiteList(siteList: SiteList): void
  /** The answer the fake bridge gives to the next selector transfers. */
  setSelectorResponse(response: { status: number; body: unknown }): void
  failNextPackets(count: number): void
  failNextCookieRead(domain: string): void
  /** The hosts the navigation wake-up listens for at the moment. */
  wakeUpHosts(): string[]
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
  const selectorPosts: Array<{ body: string; headers: Record<string, string> }> = []
  const injectionCalls: Array<{ tabId: number; files: string[] }> = []
  const tabMessages: Array<{ tabId: number; message: Record<string, unknown> }> = []
  const permissionQueries: string[] = []
  const logs: LogEntry[] = []
  // The user pairs the extension by hand; the worker finds the code in the
  // local store. A harness without one cannot sign its requests.
  const storage = new Map<string, unknown>(
    Object.entries({
      profileId: TEST_PROFILE_ID,
      profileName: TEST_PROFILE_NAME,
      ...(options.paired === false ? {} : { bridgeSecret: BRIDGE_SECRET }),
      ...(options.storage ?? {})
    })
  )
  const timers = new Map<number, () => void>()
  let messageListener: (
    message: Record<string, unknown>,
    sender: object,
    respond: (response: { success: boolean }) => void
  ) => void
  const alarmListeners: ((alarm: { name: string }) => void)[] = []
  const cookieListeners: ((change: {
    cookie: FakeCookie
    removed: boolean
    cause: string
  }) => void)[] = []
  const navigationListeners: {
    listener: (details: unknown) => void
    filter: { url?: { hostSuffix?: string }[] } | undefined
  }[] = []

  let siteList: SiteList = {
    ...(options.siteList ?? DEFAULT_SITE_LIST),
    selectedProfileId:
      options.siteList?.selectedProfileId === undefined
        ? TEST_PROFILE_ID
        : options.siteList.selectedProfileId,
    selectionVersion: options.siteList?.selectionVersion ?? 0
  }
  const cookies = options.cookies ?? DEFAULT_COOKIES
  const granted = options.grantedOrigins ?? 'all'
  const bridgePortOption = options.bridgePort ?? null
  const permissionsThrow = options.permissionsThrow === true
  const extensionId = options.extensionId ?? EXTENSION_ID
  const extensionEnvironment = extensionId === DEV_EXTENSION_ID ? 'dev' : 'prod'
  const healthEnvironment = options.healthEnvironment ?? extensionEnvironment
  let failingPackets = options.failPackets ?? 0
  let tooLargePackets = options.tooLargePackets ?? 0
  let failingPosts = options.failPosts ?? 0
  let failingCookieDomain: string | null = null
  let selectorResponseAnswer = options.selectorResponse ?? {
    status: 200,
    body: { status: 'saved', saved: true }
  }
  let timerId = 0
  let bridgePort: number | null = null

  /**
   * The signatures the extension has in flight.
   *
   * The real WebCrypto is used — the test pins the exact HMAC the extension
   * sends — but it resolves on the thread pool, so the harness has to know
   * whether a signature is still on its way.
   */
  let pendingSignatures = 0
  const harnessCrypto = {
    randomUUID: () => `req-${String(++timerId).padStart(16, '0')}`,
    subtle: {
      importKey: (
        format: 'raw',
        keyData: BufferSource,
        algorithm: HmacImportParams,
        extractable: boolean,
        keyUsages: readonly KeyUsage[]
      ): Promise<CryptoKey> => {
        pendingSignatures += 1
        return globalThis.crypto.subtle
          .importKey(format, keyData, algorithm, extractable, keyUsages)
          .finally(() => {
            pendingSignatures -= 1
          })
      },
      sign: (
        algorithm: AlgorithmIdentifier,
        key: CryptoKey,
        data: BufferSource
      ): Promise<ArrayBuffer> => {
        pendingSignatures += 1
        return globalThis.crypto.subtle.sign(algorithm, key, data).finally(() => {
          pendingSignatures -= 1
        })
      }
    }
  }

  const fakeChrome = {
    runtime: {
      id: extensionId,
      getURL: (path: string) => `chrome-extension://${extensionId}/${path}`,
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
        if (domain === failingCookieDomain) {
          failingCookieDomain = null
          throw new Error('cookie read failed')
        }
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
      onCompleted: {
        addListener: (
          listener: (details: unknown) => void,
          filter?: { url?: { hostSuffix?: string }[] }
        ) => {
          navigationListeners.push({ listener, filter })
        },
        removeListener: (listener: (details: unknown) => void) => {
          const index = navigationListeners.findIndex((entry) => entry.listener === listener)
          if (index >= 0) navigationListeners.splice(index, 1)
        }
      }
    },
    tabs: {
      get: async (tabId: number) => ({
        id: tabId,
        url: options.tabUrl ?? 'https://chatgpt.com/c/1'
      }),
      sendMessage: async (tabId: number, message: Record<string, unknown>) => {
        tabMessages.push({ tabId, message })
      }
    },
    scripting: {
      executeScript: async (scriptOptions: { target: { tabId: number }; files?: string[] }) => {
        injectionCalls.push({
          tabId: scriptOptions.target.tabId,
          files: scriptOptions.files ?? []
        })
        if (options.injectionError) throw new Error(options.injectionError)
        return [{ frameId: 0, documentId: 'doc-1' }]
      }
    }
  }

  Object.assign(fakeChrome.storage, { local: fakeChrome.storage.session })
  Object.assign(fakeChrome.runtime, {
    onMessage: {
      addListener: (listener: typeof messageListener) => {
        messageListener = listener
      }
    }
  })

  const fakeFetch = async (url: string, init?: RequestInit) => {
    const target = String(url)
    const headers = (init?.headers ?? {}) as Record<string, string>
    const method = init?.method ?? 'GET'
    fetchCalls.push({ url: target, method, headers, body: String(init?.body ?? '') })

    const port = Number(new URL(target).port)
    if (target.startsWith('chrome-extension://')) {
      return jsonResponse({ secret: BRIDGE_SECRET })
    }
    if (bridgePortOption !== null && port !== bridgePortOption) {
      // Nothing listens on that port: the connection is refused.
      throw new Error(`connect ECONNREFUSED 127.0.0.1:${port}`)
    }

    if (target.endsWith(SITE_LIST_PATH)) {
      // The app only answers a caller that holds the pairing code.
      if (headers['x-hmac-signature'] !== sign(SITE_LIST_PATH)) {
        return jsonResponse({ error: 'Invalid signature' }, 401)
      }
      return jsonResponse(siteList)
    }
    if (target.endsWith(SELECTOR_SITES_PATH)) {
      if (headers['x-hmac-signature'] !== sign(SELECTOR_SITES_PATH)) {
        return jsonResponse({ error: 'Invalid signature' }, 401)
      }
      return jsonResponse({
        version: 1,
        sites: [
          {
            siteId: 'chatgpt',
            displayName: 'ChatGPT',
            hostname: 'chatgpt.com',
            hosts: ['chatgpt.com', 'openai.com'],
            fields: ['input', 'button'],
            status: { input: 'missing', button: 'ready' }
          }
        ]
      })
    }
    if (target.endsWith(SELECTOR_TRANSFER_PATH)) {
      const requestId = headers['x-quizlab-request-id'] ?? ''
      const expected = createHmac('sha256', BRIDGE_SECRET)
        .update(
          `${TEST_PROFILE_ID}\n${SELECTOR_TRANSFER_PATH}\n${requestId}\n${String(init?.body ?? '')}`
        )
        .digest('hex')
      if (headers['x-hmac-signature'] !== expected) {
        return jsonResponse({ error: 'Invalid signature' }, 401)
      }
      selectorPosts.push({ body: String(init?.body ?? ''), headers })
      return jsonResponse(selectorResponseAnswer.body, selectorResponseAnswer.status)
    }
    if (target.endsWith(COOKIE_PATH)) {
      const packet = JSON.parse(String(init?.body ?? '{}')) as Packet
      attempts.push(packet)
      if (failingPosts > 0) {
        failingPosts -= 1
        // The request never reaches the app.
        throw new Error(`connect ECONNREFUSED 127.0.0.1:${port}`)
      }
      if (tooLargePackets > 0) {
        tooLargePackets -= 1
        return jsonResponse({ error: 'packet_too_large' }, 413)
      }
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
        instanceId: 'bridge-instance-1',
        protocolVersion: 3,
        ...(healthEnvironment === 'legacy' ? {} : { environment: healthEnvironment })
      })
    }
    return jsonResponse({ error: 'Not found' }, 404)
  }

  const context = vm.createContext({
    chrome: fakeChrome,
    fetch: fakeFetch,
    crypto: harnessCrypto,
    TextEncoder: globalThis.TextEncoder,
    AbortSignal: globalThis.AbortSignal,
    URL: globalThis.URL,
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
    // The extension signs every request with WebCrypto, and that resolves on
    // the thread pool. Waiting for a fixed number of event loop turns can end
    // before the signature arrives, so the number of packets the extension had
    // sent then depended on how busy the machine was. Waiting for the pending
    // signatures instead makes the settle independent of the load.
    for (let turn = 0; turn < 100; turn++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (pendingSignatures === 0) return
    }
  }

  return {
    message: (message) => new Promise((resolve) => messageListener(message, {}, resolve)),
    messageFromTab: (message, sender) =>
      new Promise((resolve) =>
        (
          messageListener as unknown as (
            message: Record<string, unknown>,
            sender: unknown,
            respond: (response: Record<string, unknown>) => void
          ) => void
        )(message, sender, resolve)
      ),
    fetchCalls,
    cookieQueries,
    attempts,
    packets,
    selectorPosts,
    injectionCalls,
    tabMessages,
    permissionQueries,
    logs,
    storage,
    get bridgePort() {
      return bridgePort
    },
    setSiteList(next: SiteList) {
      siteList = next
    },
    setSelectorResponse(next: { status: number; body: unknown }) {
      selectorResponseAnswer = next
    },
    failNextPackets(count: number) {
      failingPackets = count
    },
    failNextCookieRead(domain: string) {
      failingCookieDomain = domain
    },
    wakeUpHosts() {
      const current = navigationListeners[navigationListeners.length - 1]
      return (current?.filter?.url ?? []).map((entry) => entry.hostSuffix ?? '')
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
  return createHmac('sha256', BRIDGE_SECRET).update(`${TEST_PROFILE_ID}\n${payload}`).digest('hex')
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

  it('speaks the same protocol as the app', () => {
    const declared = /const PROTOCOL_VERSION = (\d+)/.exec(source)
    expect(declared).not.toBeNull()
    expect(Number(declared?.[1])).toBe(SITE_SESSION_PROTOCOL_VERSION)
  })

  it('never writes a cookie itself', () => {
    expect(source).not.toContain('chrome.cookies.set')
    expect(source).not.toContain('chrome.cookies.remove')
  })

  it('names the protocol version on every request it makes', () => {
    expect(source).toContain('x-protocol-version')
  })

  it('identifies the Chrome profile on every request it makes', () => {
    expect(source).toContain('x-quizlab-profile-id')
    expect(source).toContain('x-quizlab-profile-name')
  })

  it('lets the user name this Chrome profile', () => {
    expect(source).toContain('set_profile_name')
  })

  it('speaks the selector transfer contract of the app', () => {
    expect(SELECTOR_TRANSFER_PATH).toBe(SHARED_SELECTOR_TRANSFER_PATH)
    expect(SELECTOR_SITES_PATH).toBe(SHARED_SELECTOR_SITES_PATH)
    expect(source).toContain(`const SELECTOR_TRANSFER_PATH = '${SHARED_SELECTOR_TRANSFER_PATH}'`)
    expect(source).toContain(`const SELECTOR_SITES_PATH = '${SHARED_SELECTOR_SITES_PATH}'`)
    expect(source).toContain(`const SELECTOR_TRANSFER_VERSION = ${SELECTOR_TRANSFER_VERSION}`)
    expect(source).toContain(`const SELECTOR_REQUEST_ID_HEADER = '${SELECTOR_REQUEST_ID_HEADER}'`)
  })

  it('never lets the content script hold the pairing secret or sign a request', () => {
    const picker = readFileSync(PICKER_PATH, 'utf-8')
    expect(picker).not.toContain('bridgeSecret')
    expect(picker).not.toContain('x-hmac-signature')
    expect(picker).not.toContain('fetch(')
    expect(picker).not.toContain('chrome.cookies')
  })
})

describe('extension bridge behaviour', () => {
  it('collects the additional catalogue sites into separate signed packets and preserves their labels', async () => {
    const targets = Object.values(ADDITIONAL_AI_CHAT_PLATFORMS)
      .filter((platform) => platform.id !== 'notebooklm')
      .map((platform) => ({
        siteId: platform.id,
        label: platform.name,
        cookieDomains: [...getSiteSessionCookieDomains(platform.id)]
      }))
    const cookies = Object.fromEntries(
      targets.flatMap((target) =>
        target.cookieDomains.map((domain) => [
          domain,
          [{ name: 'session', value: 'test-value', domain, path: '/', secure: true }]
        ])
      )
    )
    const harness = createHarness({
      siteList: { protocolVersion: 3, configVersion: 8, targets },
      cookies
    })
    await harness.settle()
    expect(harness.packets).toHaveLength(41)
    for (const target of targets) {
      const packet = harness.packets.find((p) => p.targetId === target.siteId)
      expect(packet?.status, target.siteId).toBe('ok')
      expect(packet?.cookies.map((cookie) => cookie.domain).sort()).toEqual(
        [...target.cookieDomains].sort()
      )
    }
    expect(harness.storage.get('knownTargets')).toEqual(targets)
    for (const call of callsTo(harness, COOKIE_PATH)) {
      expect(call.headers['x-hmac-signature']).toBe(sign(call.body))
    }
  })

  it('does not read a new service until its optional host permission is granted', async () => {
    const harness = createHarness({
      siteList: {
        protocolVersion: 3,
        configVersion: 8,
        targets: [{ siteId: 'poe', label: 'Poe', cookieDomains: ['.poe.com'] }]
      },
      grantedOrigins: 'none'
    })
    await harness.settle()
    expect(harness.cookieQueries).toEqual([])
    expect(harness.packets).toEqual([
      { targetId: 'poe', status: 'permission_missing', cookies: [] }
    ])
  })

  it('asks the bridge which sites it wants, signed and with the protocol version', async () => {
    const harness = createHarness()
    await harness.settle()

    const call = callsTo(harness, SITE_LIST_PATH)[0]
    expect(call, 'the site list was never requested').toBeDefined()
    expect(call?.method).toBe('GET')
    expect(call?.headers['x-protocol-version']).toBe('3')
    expect(call?.headers['Origin']).toBe(EXTENSION_ORIGIN)
    expect(call?.headers['x-quizlab-profile-id']).toBe(TEST_PROFILE_ID)
    expect(call?.headers['x-quizlab-profile-name']).toBe(encodeURIComponent(TEST_PROFILE_NAME))
    expect(call?.headers['x-hmac-signature']).toBe(sign(SITE_LIST_PATH))
  })

  it('does not push cookies while another Chrome profile is the selected source', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, selectedProfileId: 'another-profile-1234' }
    })
    await harness.settle()

    expect(harness.packets).toHaveLength(0)
    expect(harness.cookieQueries).toEqual([])
    // The popup still needs the list to show the permissions of each site.
    expect(harness.storage.get('knownTargets')).toHaveLength(2)
  })

  it('pushes everything when this profile becomes the selected source', async () => {
    const harness = createHarness({
      storage: {
        lastSelectedProfileId: 'another-profile-1234',
        lastSelectionVersion: 0,
        lastConfigVersion: DEFAULT_SITE_LIST.configVersion,
        knownTargets: DEFAULT_SITE_LIST.targets
      },
      siteList: { ...DEFAULT_SITE_LIST, selectionVersion: 1 }
    })
    await harness.settle()

    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['chatgpt', 'claude'])
  })

  it('names "not selected" when a manual sync comes from another profile', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, selectedProfileId: 'another-profile-1234' }
    })
    await harness.settle()

    const response = await harness.message({ type: 'sync_now' })

    expect(response.success).toBe(false)
    expect(response.result).toBe('not_selected')
  })

  it('does not lose the selection change while auto-sync is off', async () => {
    const harness = createHarness({
      storage: {
        autoSync: false,
        lastSelectedProfileId: 'another-profile-1234',
        lastSelectionVersion: 0
      },
      siteList: { ...DEFAULT_SITE_LIST, selectionVersion: 1 }
    })
    await harness.settle()
    expect(harness.packets).toHaveLength(0)

    const response = await harness.message({ type: 'sync_now' })
    await harness.settle()

    expect(response.success).toBe(true)
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['chatgpt', 'claude'])
  })

  it('stores the name the user gives this Chrome profile', async () => {
    const harness = createHarness()
    const response = await harness.message({ type: 'set_profile_name', name: '  Ana   Chrome  ' })

    expect(response.success).toBe(true)
    expect(harness.storage.get('profileName')).toBe('Ana Chrome')
  })

  it('sends one packet per target and signs every packet over its own body', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.packets).toHaveLength(2)
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['chatgpt', 'claude'])

    const call = callsTo(harness, COOKIE_PATH)[0]
    expect(call?.method).toBe('POST')
    expect(call?.headers['x-protocol-version']).toBe('3')
    expect(call?.headers['Origin']).toBe(EXTENSION_ORIGIN)
    expect(call?.headers['x-quizlab-profile-id']).toBe(TEST_PROFILE_ID)
    expect(call?.headers['x-quizlab-profile-name']).toBe(encodeURIComponent(TEST_PROFILE_NAME))
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
        protocolVersion: 3,
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

  it('checks the wildcard permission covering the site and its subdomains', async () => {
    const harness = createHarness({ grantedOrigins: ['https://*.chatgpt.com/*'] })
    await harness.settle()

    expect(harness.permissionQueries).toContain('https://*.chatgpt.com/*')
  })

  it('refuses an exact-host-only grant before reading potentially incomplete cookies', async () => {
    const harness = createHarness({
      siteList: {
        protocolVersion: 3,
        configVersion: 7,
        targets: [{ siteId: 'chatgpt', cookieDomains: ['.chatgpt.com'] }]
      },
      grantedOrigins: ['https://chatgpt.com/*']
    })
    await harness.settle()
    expect(harness.packets[0].status).toBe('permission_missing')
    expect(harness.cookieQueries).toEqual([])
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
    // The running bridge is remembered: without this, the restarted worker
    // would treat the same app as a new one and rewrite every session.
    expect(first.storage.get('bridgeInstanceId')).toBe('bridge-instance-1')

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
    // The report went through, so the app is not told about it again.
    expect(harness.storage.get('outdatedState')).toBeDefined()

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('repeats the outdated report when it did not reach the app', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, protocolVersion: 1 },
      failPosts: 1
    })
    await harness.settle()

    // The report did not go through, so it is not marked as reported: the
    // user is told to reload the extension with the next poll.
    expect(harness.storage.get('outdatedState')).toBeUndefined()

    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.storage.get('outdatedState')).toBeDefined()

    // The report that went through is not repeated.
    const attempts = harness.attempts.length
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.attempts).toHaveLength(attempts)
  })

  it('says that the report did not reach the app', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, protocolVersion: 1 },
      failPosts: 1
    })
    await harness.settle()

    const warning = harness.logs.find((entry) => entry.message.includes('report is repeated'))
    expect(warning?.level).toBe('warn')
  })

  it('retries an oversized packet when a site cookie changes', async () => {
    const harness = createHarness({ tooLargePackets: 1 })
    await harness.settle()

    // The first packet did not fit into the app: only the other one was taken.
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['claude'])

    // A cookie change can shrink the packet, so it gets another chance.
    harness.fireCookieChanged({
      name: '__Secure-1PSID',
      value: 'chatgpt-host-only',
      domain: 'chatgpt.com',
      path: '/'
    })
    await harness.runTimers()

    expect(harness.attempts.map((packet) => packet.targetId)).toEqual([
      'chatgpt',
      'claude',
      'chatgpt'
    ])
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['claude', 'chatgpt'])
  })

  it('retries a failed cookie read and continues with other sites', async () => {
    const harness = createHarness()
    await harness.settle()
    harness.failNextCookieRead('.chatgpt.com')
    harness.setSiteList({ ...DEFAULT_SITE_LIST, configVersion: 8 })
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets.map((packet) => packet.targetId)).toEqual([
      'chatgpt',
      'claude',
      'claude'
    ])
    expect(harness.storage.get('pendingSiteIds')).toContain('chatgpt')
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets.at(-1)?.targetId).toBe('chatgpt')
  })

  it('says that a packet did not fit into the app', async () => {
    const harness = createHarness({ tooLargePackets: 1 })
    await harness.settle()

    const warning = harness.logs.find((entry) => entry.message.includes('too large'))
    expect(warning?.level).toBe('warn')
  })

  it('remembers the site whose packet did not fit into the app', async () => {
    const harness = createHarness({ tooLargePackets: 1 })
    await harness.settle()

    expect(harness.storage.get('tooLargeSiteIds')).toEqual(['chatgpt'])
  })

  it('remembers an oversized packet after restart and retries when cookies change', async () => {
    const first = createHarness({ tooLargePackets: 1 })
    await first.settle()

    const second = createHarness({ storage: Object.fromEntries(first.storage) })
    await second.settle()
    expect(second.attempts).toHaveLength(0)
    second.fireCookieChanged({
      name: '__Secure-1PSID',
      value: 'chatgpt-host-only',
      domain: 'chatgpt.com',
      path: '/'
    })
    await second.runTimers()

    expect(second.attempts.map((packet) => packet.targetId)).toEqual(['chatgpt'])
  })

  it('gives a site another chance when the app asks for something new', async () => {
    const harness = createHarness({ tooLargePackets: 1 })
    await harness.settle()

    harness.setSiteList({ ...DEFAULT_SITE_LIST, configVersion: 8 })
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()

    // The user may have changed something in the app, so the site is pushed
    // once more.
    expect(harness.attempts.map((packet) => packet.targetId)).toEqual([
      'chatgpt',
      'claude',
      'chatgpt',
      'claude'
    ])
  })

  it('wakes up for the sites the app asks for', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.wakeUpHosts()).toEqual(['chatgpt.com', 'openai.com', 'claude.ai'])
  })

  it('wakes up for the sites of the saved list after a worker restart', async () => {
    const first = createHarness()
    await first.settle()

    const second = createHarness({ storage: Object.fromEntries(first.storage) })
    await second.settle()

    expect(second.wakeUpHosts()).toEqual(['chatgpt.com', 'openai.com', 'claude.ai'])
  })

  it('does not wake up for Google alone any more', () => {
    expect(source).not.toContain('gemini.google.com')
    expect(source).not.toContain('aistudio.google.com')
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

describe('extension environment isolation', () => {
  /** The ports a path was requested on, in order. */
  function portsOf(harness: Harness, pathname: string): number[] {
    return callsTo(harness, pathname).map((entry) => Number(new URL(entry.url).port))
  }

  it('scans only the release ports in the release build', async () => {
    const harness = createHarness({ bridgePort: 52003 })
    await harness.settle()

    const ports = portsOf(harness, HEALTH_PATH)
    expect(ports).toEqual([51999, 52000, 52001, 52002, 52003])
    expect(harness.packets).toHaveLength(2)
  })

  it('scans only the dev ports in the dev build', async () => {
    const harness = createHarness({ extensionId: DEV_EXTENSION_ID, bridgePort: 52012 })
    await harness.settle()

    expect(portsOf(harness, HEALTH_PATH)).toEqual([52010, 52011, 52012])

    const call = callsTo(harness, SITE_LIST_PATH)[0]
    expect(call?.headers['Origin']).toBe(DEV_EXTENSION_ORIGIN)
    expect(call?.headers['x-quizlab-environment']).toBe('dev')
    expect(harness.packets).toHaveLength(2)
  })

  it('names the release build on every request', async () => {
    const harness = createHarness()
    await harness.settle()

    const call = callsTo(harness, SITE_LIST_PATH)[0]
    expect(call?.headers['x-quizlab-environment']).toBe('prod')
    expect(call?.headers['Origin']).toBe(EXTENSION_ORIGIN)
  })

  it('refuses a bridge that reports the dev environment', async () => {
    const harness = createHarness({ healthEnvironment: 'dev' })
    await harness.settle()

    expect(callsTo(harness, SITE_LIST_PATH)).toHaveLength(0)
    expect(harness.packets).toHaveLength(0)
    expect(
      harness.logs.some((entry) => entry.level === 'warn' && entry.message.includes('environment'))
    ).toBe(true)
  })

  it('refuses a bridge that reports the release environment from the dev build', async () => {
    const harness = createHarness({ extensionId: DEV_EXTENSION_ID, healthEnvironment: 'prod' })
    await harness.settle()

    expect(callsTo(harness, SITE_LIST_PATH)).toHaveLength(0)
    expect(harness.packets).toHaveLength(0)
    // The dev build only looked at its own ports while it did so.
    expect(portsOf(harness, HEALTH_PATH).every((port) => port >= 52010 && port <= 52020)).toBe(true)
  })

  it('accepts a release bridge that predates the environment field', async () => {
    const harness = createHarness({ healthEnvironment: 'legacy' })
    await harness.settle()

    expect(harness.packets).toHaveLength(2)
  })

  it('does not accept an unidentified bridge in the dev build', async () => {
    const harness = createHarness({ extensionId: DEV_EXTENSION_ID, healthEnvironment: 'legacy' })
    await harness.settle()

    expect(harness.packets).toHaveLength(0)
  })

  it('reconnects on its own after a worker restart in the dev build', async () => {
    const first = createHarness({ extensionId: DEV_EXTENSION_ID, bridgePort: 52012 })
    await first.settle()
    expect(first.packets).toHaveLength(2)

    const second = createHarness({
      extensionId: DEV_EXTENSION_ID,
      bridgePort: 52012,
      storage: Object.fromEntries(first.storage)
    })
    second.fireAlarm(HEARTBEAT_ALARM)
    await second.settle()

    const siteListCalls = callsTo(second, SITE_LIST_PATH)
    expect(siteListCalls.length).toBeGreaterThan(0)
    expect(siteListCalls.every((entry) => entry.url.includes(':52012/'))).toBe(true)
    // The app did not change anything, so the sessions are not pushed again.
    expect(second.packets).toHaveLength(0)
  })
})

describe('extension pairing', () => {
  it('does not ask for sessions before the user pairs the extension', async () => {
    const harness = createHarness({ paired: false })
    await harness.settle()

    expect(callsTo(harness, SITE_LIST_PATH)).toHaveLength(0)
    expect(harness.packets).toHaveLength(0)
  })

  it('pairs with the app and starts the first import', async () => {
    const harness = createHarness({ paired: false })
    await harness.settle()

    const response = await harness.message({ type: 'pair', secret: BRIDGE_SECRET })

    expect(response.success).toBe(true)
    expect(harness.storage.get('bridgeSecret')).toBe(BRIDGE_SECRET)
    await harness.settle()
    expect(harness.packets).toHaveLength(2)
  })

  it('refuses a code the app does not accept', async () => {
    const harness = createHarness({ paired: false })
    await harness.settle()

    const response = await harness.message({ type: 'pair', secret: 'b'.repeat(64) })

    expect(response.success).toBe(false)
    await harness.settle()
    expect(harness.packets).toHaveLength(0)
  })
})

describe('extension account snapshots', () => {
  it('uses the single session for non-Google imports and keeps automatic sync after a manual transfer', async () => {
    const harness = createHarness({ storage: { autoSync: true } })
    await harness.settle()
    const response = await harness.message({ type: 'sync_now', targetId: 'claude' })
    expect(response.success).toBe(true)
    expect(harness.packets.at(-1)).toMatchObject({ targetId: 'claude' })
    // A manual transfer is a one-off action, not a preference change.
    expect(harness.storage.get('autoSync')).toBe(true)

    // Automatic sync therefore still runs: a cookie change of the site is
    // pushed without another manual action.
    const count = harness.packets.length
    harness.fireCookieChanged(DEFAULT_COOKIES['.claude.ai'][0])
    await harness.runTimers()
    harness.fireAlarm(HEARTBEAT_ALARM)
    await harness.settle()
    expect(harness.packets).toHaveLength(count + 1)

    const restarted = createHarness({ storage: Object.fromEntries(harness.storage) })
    await restarted.settle()
    expect(restarted.packets).toHaveLength(0)
    expect(restarted.wakeUpHosts()).toContain('claude.ai')
  })

  it('serializes captures for two requested sites', async () => {
    const harness = createHarness()
    await harness.settle()
    const offset = harness.packets.length
    await Promise.all([
      harness.message({ type: 'sync_now', targetId: 'claude' }),
      harness.message({ type: 'sync_now', targetId: 'chatgpt' })
    ])
    expect(harness.packets.slice(offset)).toMatchObject([
      { targetId: 'claude' },
      { targetId: 'chatgpt' }
    ])
  })

  it('reports a missing browser session and an unknown selected site as failures', async () => {
    const harness = createHarness({ cookies: {} })
    await harness.settle()
    expect((await harness.message({ type: 'sync_now', targetId: 'claude' })).success).toBe(false)
    expect((await harness.message({ type: 'sync_now', targetId: 'unknown' })).success).toBe(false)
  })

  it('resumes automatic writes', async () => {
    const harness = createHarness({ storage: { autoSync: false } })
    await harness.settle()
    await harness.message({ type: 'set_auto_sync', enabled: true })
    expect(harness.packets.map((packet) => packet.targetId)).toEqual(['chatgpt', 'claude'])
    harness.fireCookieChanged(DEFAULT_COOKIES['.claude.ai'][0])
    await harness.runTimers()
    expect(harness.packets.length).toBeGreaterThan(0)
  })

  it('reports failure when resuming automatic sync cannot reach the bridge', async () => {
    const harness = createHarness({ storage: { autoSync: false } })
    await harness.settle()
    harness.failNextPackets(1)
    expect((await harness.message({ type: 'set_auto_sync', enabled: true })).success).toBe(false)
  })

  it('retries previously oversized sites when automatic sync is resumed', async () => {
    const harness = createHarness({ tooLargePackets: 1 })
    await harness.settle()
    await harness.message({ type: 'sync_now', targetId: 'claude' })
    await harness.message({ type: 'set_auto_sync', enabled: true })
    expect(harness.packets.at(-2)?.targetId).toBe('chatgpt')
    expect(harness.packets.at(-1)?.targetId).toBe('claude')
  })
})

describe('extension magic selector', () => {
  it('names the active tab site and its stored selector status', async () => {
    const harness = createHarness()
    await harness.settle()

    const state = await harness.message({ type: 'selector_state', tabId: 7 })
    expect(state).toMatchObject({
      success: true,
      connection: 'ok',
      host: 'chatgpt.com'
    })
    expect((state as { site?: unknown }).site).toMatchObject({
      displayName: 'ChatGPT',
      fields: ['input', 'button'],
      status: { input: 'missing', button: 'ready' }
    })
  })

  it('injects the engine and the picker only when a pick starts', async () => {
    const harness = createHarness()
    await harness.settle()
    expect(harness.injectionCalls).toHaveLength(0)

    const response = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    expect(response.success).toBe(true)
    expect(harness.injectionCalls).toEqual([
      { tabId: 7, files: ['content/selector-engine.js', 'content/picker.js'] }
    ])
    expect(harness.tabMessages[0]).toMatchObject({
      tabId: 7,
      message: {
        type: 'quizlab_selector_init',
        field: 'input',
        sessionId: response.sessionId
      }
    })
  })

  it('refuses to start on a site the app did not name', async () => {
    const harness = createHarness({ tabUrl: 'https://example.com/' })
    await harness.settle()

    const response = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    expect(response.success).toBe(false)
    expect((response as { error?: string }).error).toBe('unsupported_site')
    expect(harness.injectionCalls).toHaveLength(0)
  })

  it('tells a missing host permission apart from a broken page', async () => {
    const harness = createHarness({
      injectionError:
        'Cannot access contents of the page. Extension manifest must request permission.'
    })
    await harness.settle()

    const response = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    expect(response.success).toBe(false)
    expect((response as { error?: string }).error).toBe('permission_missing')
    expect((response as { origins?: string[] }).origins).toContain('https://*.chatgpt.com/*')
  })

  it('signs the picked element and reports it saved', async () => {
    const harness = createHarness()
    await harness.settle()
    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })

    const outcome = await harness.messageFromTab(
      {
        type: 'selector_pick_result',
        sessionId: String(started.sessionId),
        field: 'input',
        payload: {
          selector: '#composer',
          candidates: ['#composer'],
          fingerprint: { tag: 'textarea' },
          sourceUrl: 'https://chatgpt.com/c/1'
        }
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )

    expect(outcome).toMatchObject({ ok: true, state: 'saved' })
    expect(harness.selectorPosts).toHaveLength(1)
    const body = JSON.parse(harness.selectorPosts[0].body) as Record<string, unknown>
    expect(body).toMatchObject({
      version: 1,
      hostname: 'chatgpt.com',
      field: 'input',
      selector: '#composer'
    })
    expect(harness.selectorPosts[0].headers['x-quizlab-request-id']).toBe(body.requestId)
    // The pick is a signed selector request, never a cookie packet.
    expect(harness.packets).toHaveLength(2)
  })

  it('refuses a result that comes from another tab', async () => {
    const harness = createHarness()
    await harness.settle()
    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })

    const outcome = await harness.messageFromTab(
      {
        type: 'selector_pick_result',
        sessionId: String(started.sessionId),
        field: 'input',
        payload: {
          selector: '#composer',
          candidates: ['#composer'],
          fingerprint: { tag: 'textarea' },
          sourceUrl: 'https://chatgpt.com/c/1'
        }
      },
      { tab: { id: 8 }, frameId: 0, documentId: 'doc-1' }
    )

    expect(outcome.ok).toBe(false)
    expect(harness.selectorPosts).toHaveLength(0)
  })

  it('transfers a pick while the cookie sync is switched off', async () => {
    const harness = createHarness({ storage: { autoSync: false } })
    await harness.settle()
    expect(harness.packets).toHaveLength(0)

    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'button' })
    const outcome = await harness.messageFromTab(
      {
        type: 'selector_pick_result',
        sessionId: String(started.sessionId),
        field: 'button',
        payload: {
          selector: '#send',
          candidates: ['#send'],
          fingerprint: { tag: 'button' },
          sourceUrl: 'https://chatgpt.com/c/1'
        }
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )

    expect(outcome).toMatchObject({ ok: true, state: 'saved' })
    // No cookie was pushed by the selector transfer.
    expect(harness.packets).toHaveLength(0)
  })

  it('transfers a pick while another Chrome profile owns the cookie source', async () => {
    const harness = createHarness({
      siteList: { ...DEFAULT_SITE_LIST, selectedProfileId: 'another-profile' }
    })
    await harness.settle()

    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    const outcome = await harness.messageFromTab(
      {
        type: 'selector_pick_result',
        sessionId: String(started.sessionId),
        field: 'input',
        payload: {
          selector: '#composer',
          candidates: ['#composer'],
          fingerprint: { tag: 'textarea' },
          sourceUrl: 'https://chatgpt.com/c/1'
        }
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )

    // The selector transfer is not a cookie packet: the donor profile choice
    // must not block a pick made in this Chrome profile.
    expect(outcome).toMatchObject({ ok: true, state: 'saved' })
    expect(harness.packets).toHaveLength(0)
  })

  it('does not report a legacy duplicate answer as a saved pick', async () => {
    const harness = createHarness()
    await harness.settle()
    harness.setSelectorResponse({
      status: 409,
      body: { error: 'duplicate_request', retryable: false }
    })
    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })

    const outcome = await harness.messageFromTab(
      {
        type: 'selector_pick_result',
        sessionId: String(started.sessionId),
        field: 'input',
        payload: {
          selector: '#composer',
          candidates: ['#composer'],
          fingerprint: { tag: 'textarea' },
          sourceUrl: 'https://chatgpt.com/c/1'
        }
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )

    // An older bridge gives no outcome with a duplicate answer. Saying "saved"
    // would tell the user a pick landed that may have been refused.
    expect(outcome).toMatchObject({ ok: false, state: 'rejected' })
    expect(outcome.retryable).toBe(false)
  })

  it('lets the same pick be retried after the site was opened in QuizLab', async () => {
    const harness = createHarness()
    await harness.settle()
    harness.setSelectorResponse({
      status: 409,
      body: { error: 'site_not_open', retryable: true }
    })
    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    const pick = () =>
      harness.messageFromTab(
        {
          type: 'selector_pick_result',
          sessionId: String(started.sessionId),
          field: 'input',
          payload: {
            selector: '#composer',
            candidates: ['#composer'],
            fingerprint: { tag: 'textarea' },
            sourceUrl: 'https://chatgpt.com/c/1'
          }
        },
        { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
      )

    expect(await pick()).toMatchObject({ ok: false, state: 'site_not_open', retryable: true })

    harness.setSelectorResponse({ status: 200, body: { status: 'saved', saved: true } })
    expect(await pick()).toMatchObject({ ok: true, state: 'saved' })
    const ids = harness.selectorPosts.map(
      (post) => (JSON.parse(post.body) as { requestId: string }).requestId
    )
    // The retry is the same request (the bridge did not store the open-site
    // answer), so it can be processed once the site is open.
    expect(ids[1]).toBe(ids[0])
  })

  it('keeps the request id for the same payload and mints one for a different pick', async () => {
    const harness = createHarness()
    await harness.settle()
    harness.setSelectorResponse({
      status: 422,
      body: { error: 'verification_failed', reason: 'identity_insufficient' }
    })
    const started = await harness.message({ type: 'selector_start', tabId: 7, field: 'input' })
    const send = (selector: string) =>
      harness.messageFromTab(
        {
          type: 'selector_pick_result',
          sessionId: String(started.sessionId),
          field: 'input',
          payload: {
            selector,
            candidates: [selector],
            fingerprint: { tag: 'textarea' },
            sourceUrl: 'https://chatgpt.com/c/1'
          }
        },
        { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
      )

    await send('#composer')
    await send('#composer')
    await send('textarea[data-testid="prompt"]')

    const ids = harness.selectorPosts.map(
      (post) => (JSON.parse(post.body) as { requestId: string }).requestId
    )
    expect(ids).toHaveLength(3)
    // A retry of the very same payload keeps the idempotency key; a re-pick of
    // a different element is a new request, not a new body under the old id.
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[0])
  })
})
