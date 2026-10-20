import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

const EXT_DIR = path.join(process.cwd(), 'extensions/quizlab-session-extension')
const MANIFEST_PATH = path.join(EXT_DIR, 'manifest.json')
const POPUP_HTML_PATH = path.join(EXT_DIR, 'popup.html')
const POPUP_JS_PATH = path.join(EXT_DIR, 'popup.js')

/**
 * The host permissions of the extension.
 *
 * A dropped host permission silently breaks every site, so the list is pinned
 * here: every change of the manifest has to keep it exactly as it is.
 */
const HOST_PERMISSIONS = [
  'https://google.com/*',
  'https://*.google.com/*',
  'https://*.youtube.com/*',
  'https://*.chatgpt.com/*',
  'https://*.openai.com/*',
  'https://*.claude.ai/*',
  'https://*.anthropic.com/*',
  'https://*.deepseek.com/*',
  'https://*.qwenlm.ai/*',
  'https://*.qwen.ai/*',
  'https://*.kimi.com/*',
  'https://*.moonshot.cn/*',
  'https://*.microsoft.com/*',
  'https://*.microsoftonline.com/*',
  'https://*.live.com/*',
  'https://*.grok.com/*',
  'https://*.x.com/*',
  'https://*.mistral.ai/*',
  'https://*.perplexity.ai/*',
  'https://*.huggingface.co/*',
  'https://*.manus.im/*',
  'http://127.0.0.1/*'
]

/** The permissions a user-added site is granted at runtime. */
const OPTIONAL_HOST_PERMISSIONS = ['http://*/*', 'https://*/*']

/**
 * The fingerprint of the key of the manifest.
 *
 * The key pins the id of the extension, so it must not change. It is a public
 * key and a very long one, so the test compares its fingerprint instead of the
 * key itself: a changed key has a changed fingerprint.
 */
const EXTENSION_KEY_FINGERPRINT = '698e03b01f313fcca0734933940403db5f9e0b42edeb81448181fc34b0da1750'

/** The fingerprint of a value of the manifest. */
function fingerprint(value: string | undefined): string {
  return createHash('sha256')
    .update(value ?? '')
    .digest('hex')
}

interface ExtensionManifest {
  name?: string
  version?: string
  description?: string
  key?: string
  permissions?: string[]
  host_permissions?: string[]
  optional_host_permissions?: string[]
  icons?: Record<string, string>
  action?: {
    default_popup?: string
    default_title?: string
  }
}

/** Reads a file of the extension, or an empty string when it is not there yet. */
function readExtensionFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function readManifest(): ExtensionManifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as ExtensionManifest
  } catch {
    return {}
  }
}

const manifest = readManifest()
const popupHtml = readExtensionFile(POPUP_HTML_PATH)
const popupJs = readExtensionFile(POPUP_JS_PATH)

interface SiteTarget {
  siteId: string
  cookieDomains: string[]
}

interface FakeElement {
  tagName: string
  className: string
  type: string
  textContent: string
  children: FakeElement[]
  addEventListener(type: string, handler: () => void): void
  appendChild(child: FakeElement): FakeElement
  replaceChildren(...children: FakeElement[]): void
  click(): void
}

interface LogEntry {
  level: string
  message: string
}

/** A DOM element the popup can render into. */
function createElement(tagName: string): FakeElement {
  const listeners = new Map<string, Array<() => void>>()
  const element: FakeElement = {
    tagName: tagName.toUpperCase(),
    className: '',
    type: '',
    textContent: '',
    children: [],
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? []
      handlers.push(handler)
      listeners.set(type, handlers)
    },
    appendChild(child) {
      element.children.push(child)
      return child
    },
    replaceChildren(...children) {
      element.children = [...children]
    },
    click() {
      for (const handler of listeners.get('click') ?? []) handler()
    }
  }
  return element
}

/** Every element below `element` that matches the predicate. */
function findAll(
  element: FakeElement,
  predicate: (candidate: FakeElement) => boolean
): FakeElement[] {
  const found = predicate(element) ? [element] : []
  for (const child of element.children) found.push(...findAll(child, predicate))
  return found
}

/** The text of an element and of everything below it. */
function textOf(element: FakeElement): string {
  return [element.textContent, ...element.children.map(textOf)].filter(Boolean).join(' ')
}

/**
 * Whether a granted origin pattern covers a requested one.
 *
 * A wildcard host covers the host itself and every subdomain of it, and the
 * blanket https pattern covers every https origin.
 */
function covers(granted: string, requested: string): boolean {
  if (granted === requested) return true
  if (granted === 'https://*/*') return true
  const wildcard = /^https:\/\/\*\.([^/]+)\/\*$/.exec(granted)
  if (!wildcard) return false
  const host = wildcard[1]
  return requested === `https://${host}/*` || requested === `https://*.${host}/*`
}

interface PopupHarnessOptions {
  /** The site list the service worker persisted; `null` means there is none. */
  targets?: SiteTarget[] | null
  /** The origin patterns Chrome has already granted. */
  granted?: string[]
  /** What the user answers when Chrome asks for the permission. */
  requestAnswer?: boolean
  /** The permissions API fails instead of answering. */
  permissionsThrow?: boolean
  /** The request throws instead of answering. */
  requestThrows?: boolean
  /** The browser has no session storage; the list is in the local storage. */
  localStorageOnly?: boolean
}

interface PermissionRequest {
  origins: string[]
  /** Whether the request was made while a click was being handled. */
  duringGesture: boolean
}

interface PopupHarness {
  readonly list: FakeElement
  readonly status: FakeElement
  readonly requestCalls: PermissionRequest[]
  readonly permissionQueries: string[]
  readonly storageQueries: string[]
  readonly cookieAccesses: string[]
  readonly networkCalls: string[]
  readonly logs: LogEntry[]
  settle(): Promise<void>
  click(element: FakeElement): void
}

const DEFAULT_TARGETS: SiteTarget[] = [
  { siteId: 'chatgpt', cookieDomains: ['.chatgpt.com', '.openai.com'] },
  { siteId: 'custom:wiki', cookieDomains: ['.wiki.example.com'] }
]

const DEFAULT_GRANTED = ['https://*.chatgpt.com/*', 'https://*.openai.com/*']

/**
 * Runs the popup against a fake Chrome and a fake DOM.
 *
 * The extension is plain JavaScript without a build step, so it cannot be
 * imported by the test runner. It is executed in a sandbox instead: the fake
 * Chrome records the permission questions and the fake DOM records what the
 * popup rendered, which lets the test pin the behaviour the user depends on.
 */
function createHarness(options: PopupHarnessOptions = {}): PopupHarness {
  const granted = [...(options.granted ?? DEFAULT_GRANTED)]
  const requestCalls: PermissionRequest[] = []
  const permissionQueries: string[] = []
  const storageQueries: string[] = []
  const cookieAccesses: string[] = []
  const networkCalls: string[] = []
  const logs: LogEntry[] = []

  const targets = options.targets === undefined ? DEFAULT_TARGETS : options.targets
  const requestAnswer = options.requestAnswer ?? true
  const permissionsThrow = options.permissionsThrow === true
  const requestThrows = options.requestThrows === true
  const localStorageOnly = options.localStorageOnly === true
  let gestureActive = false

  const status = createElement('p')
  const list = createElement('ul')
  const elements = new Map<string, FakeElement>([
    ['status', status],
    ['sites', list]
  ])

  /**
   * The storage areas of the browser.
   *
   * The service worker writes the site list into the session storage and falls
   * back to the local storage when the browser has no session storage. The
   * local store therefore holds the list only in that case.
   */
  function buildStorage(): Record<string, unknown> {
    const stores: Record<string, unknown> = {}
    if (!localStorageOnly) {
      stores.session = {
        get: async (key: string) => {
          storageQueries.push(key)
          return targets === null ? {} : { [key]: targets }
        }
      }
    }
    stores.local = {
      get: async (key: string) => {
        storageQueries.push(`local:${key}`)
        if (!localStorageOnly || targets === null) return {}
        return { [key]: targets }
      }
    }
    return stores
  }

  const fakeChrome = {
    runtime: { id: 'quizlab-popup-test' },
    storage: buildStorage(),
    permissions: {
      contains: async (query: { origins?: string[] }) => {
        const origins = query.origins ?? []
        permissionQueries.push(...origins)
        if (permissionsThrow) throw new Error('the permissions API is not available')
        return origins.some((origin) => granted.some((pattern) => covers(pattern, origin)))
      },
      request: (query: { origins?: string[] }) => {
        const origins = query.origins ?? []
        requestCalls.push({ origins: [...origins], duringGesture: gestureActive })
        if (requestThrows) throw new Error('the permission request failed')
        if (!requestAnswer) return Promise.resolve(false)
        for (const origin of origins) granted.push(origin)
        return Promise.resolve(true)
      }
    },
    get cookies() {
      cookieAccesses.push('chrome.cookies')
      throw new Error('the popup must not touch the cookies')
    }
  }

  const fakeDocument = {
    getElementById: (id: string) => elements.get(id) ?? null,
    createElement: (tagName: string) => createElement(tagName)
  }

  const context = vm.createContext({
    chrome: fakeChrome,
    document: fakeDocument,
    fetch: async (url: string) => {
      networkCalls.push(String(url))
      throw new Error('the popup must not use the network')
    },
    console: {
      log: (...args: unknown[]) => logs.push({ level: 'log', message: args.map(String).join(' ') }),
      warn: (...args: unknown[]) =>
        logs.push({ level: 'warn', message: args.map(String).join(' ') }),
      error: (...args: unknown[]) =>
        logs.push({ level: 'error', message: args.map(String).join(' ') })
    },
    setTimeout: (callback: () => void, delay?: number) => setTimeout(callback, delay),
    clearTimeout: (id: number) => clearTimeout(id)
  })

  vm.runInContext(popupJs, context, { filename: POPUP_JS_PATH })

  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 3; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return {
    list,
    status,
    requestCalls,
    permissionQueries,
    storageQueries,
    cookieAccesses,
    networkCalls,
    logs,
    settle,
    click(element) {
      gestureActive = true
      try {
        element.click()
      } finally {
        gestureActive = false
      }
    }
  }
}

/** The buttons the popup rendered. */
function buttonsOf(element: FakeElement): FakeElement[] {
  return findAll(element, (candidate) => candidate.tagName === 'BUTTON')
}

/** The title of a rendered site row. */
function titleOf(element: FakeElement): string {
  const title = findAll(element, (candidate) => candidate.className === 'site-name')[0]
  return title?.textContent ?? ''
}

describe('extension permission popup', () => {
  it('is registered as the extension popup', () => {
    expect(manifest.action?.default_popup).toBe('popup.html')
  })

  it('requests the permission from a user gesture', () => {
    expect(popupJs).toContain('chrome.permissions.request')
  })

  it('never writes cookies itself', () => {
    expect(popupJs).not.toContain('chrome.cookies.set')
    expect(popupJs).not.toContain('chrome.cookies')
  })

  it('reads the site list the service worker persisted', () => {
    expect(popupJs).toContain('knownTargets')
  })

  it('renders into the elements the page provides', () => {
    expect(popupHtml).toContain('id="status"')
    expect(popupHtml).toContain('id="sites"')
    expect(popupHtml).toContain('popup.js')
  })

  it('is a plain page that loads nothing from the network', () => {
    expect(popupHtml).not.toMatch(/src="https?:/)
    expect(popupHtml).not.toMatch(/href="https?:/)
  })

  it('keeps the identity of the extension', () => {
    expect(fingerprint(manifest.key)).toBe(EXTENSION_KEY_FINGERPRINT)
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.icons).toEqual({
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    })
  })

  it('keeps the host permissions of the manifest', () => {
    expect(manifest.host_permissions).toEqual(HOST_PERMISSIONS)
    expect(manifest.optional_host_permissions).toEqual(OPTIONAL_HOST_PERMISSIONS)
  })

  it('speaks about sites in general and not about Google alone', () => {
    expect(manifest.name).toBe('Quizlab Site Session Bridge')
    expect(manifest.description).not.toContain('Google')
    expect(manifest.description?.toLowerCase()).toContain('site')
  })
})

describe('extension permission popup behaviour', () => {
  it('lists the sites the app asks for', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.storageQueries).toContain('knownTargets')
    expect(harness.list.children).toHaveLength(2)
    expect(textOf(harness.list.children[0])).toContain('chatgpt')
    expect(textOf(harness.list.children[1])).toContain('wiki')
  })

  it('offers a button for the site that misses a permission', async () => {
    const harness = createHarness()
    await harness.settle()

    const buttons = buttonsOf(harness.list)
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('İzin ver')
  })

  it('offers no button for a site that already has its permission', async () => {
    const harness = createHarness()
    await harness.settle()

    const chatgpt = harness.list.children[0]
    expect(buttonsOf(chatgpt)).toHaveLength(0)
    expect(textOf(chatgpt)).toContain('İzin verilmiş')
  })

  it('asks for the wildcard pattern of the host', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.click(buttonsOf(harness.list)[0])

    expect(harness.requestCalls).toHaveLength(1)
    expect(harness.requestCalls[0].origins).toEqual(['https://*.wiki.example.com/*'])
  })

  it('asks for the permission inside the click handler', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.click(buttonsOf(harness.list)[0])

    // The request is recorded before the handler returned: Chrome only grants
    // a runtime permission to a request that comes from a user gesture.
    expect(harness.requestCalls).toHaveLength(1)
    expect(harness.requestCalls[0].duringGesture).toBe(true)
  })

  it('shows the site as granted after the user allowed it', async () => {
    const harness = createHarness()
    await harness.settle()

    harness.click(buttonsOf(harness.list)[0])
    await harness.settle()

    expect(buttonsOf(harness.list)).toHaveLength(0)
    expect(textOf(harness.list.children[1])).toContain('İzin verilmiş')
  })

  it('asks a host the same way the service worker does', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.permissionQueries).toContain('https://wiki.example.com/*')
    expect(harness.permissionQueries).toContain('https://*.wiki.example.com/*')
  })

  it('asks for the host of a site that is only partly granted', async () => {
    // The service worker needs every domain of a site: a site that may be read
    // only partly is a site the app may not import.
    const harness = createHarness({ granted: ['https://*.chatgpt.com/*'] })
    await harness.settle()

    const chatgpt = harness.list.children[0]
    const buttons = buttonsOf(chatgpt)
    expect(buttons).toHaveLength(1)

    harness.click(buttons[0])
    expect(harness.requestCalls[0].origins).toEqual(['https://*.openai.com/*'])
  })

  it('tells the user when the permission was refused', async () => {
    const harness = createHarness({ requestAnswer: false })
    await harness.settle()

    harness.click(buttonsOf(harness.list)[0])
    await harness.settle()

    expect(harness.status.textContent).toContain('İzin verilmedi')
    // The site still misses its permission, so the button is still there.
    expect(buttonsOf(harness.list)).toHaveLength(1)
  })

  it('tells the user when the permission request fails', async () => {
    const harness = createHarness({ requestThrows: true })
    await harness.settle()

    harness.click(buttonsOf(harness.list)[0])
    await harness.settle()

    expect(harness.status.textContent).toContain('İzin verilemedi')
    expect(harness.logs.some((entry) => entry.level === 'warn')).toBe(true)
  })

  it('never renders the internal id of a user-added site', async () => {
    const harness = createHarness()
    await harness.settle()

    // `custom:<id>` is a key of the app, not a name the user knows.
    const custom = harness.list.children[1]
    expect(titleOf(custom)).toBe('wiki.example.com')
    expect(textOf(custom)).not.toContain('custom:wiki')
  })

  it('keeps the readable id of a built-in site', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(titleOf(harness.list.children[0])).toBe('chatgpt')
  })

  it('finds the site list in the local storage when the browser has no session storage', async () => {
    const harness = createHarness({ localStorageOnly: true })
    await harness.settle()

    expect(harness.storageQueries).toContain('local:knownTargets')
    expect(harness.list.children).toHaveLength(2)
  })

  it('reads the session storage when the browser has one', async () => {
    const harness = createHarness()
    await harness.settle()

    // The service worker writes the list into the session storage, so the
    // popup reads it from there and not from the local storage.
    expect(harness.storageQueries).toContain('knownTargets')
    expect(harness.storageQueries).not.toContain('local:knownTargets')
  })

  it('treats a permission it could not read as a missing one', async () => {
    const harness = createHarness({ permissionsThrow: true })
    await harness.settle()

    // A check that fails is a check that did not pass: the service worker
    // refuses the site as well, so the popup has to ask for the permission.
    expect(buttonsOf(harness.list)).toHaveLength(2)
    expect(harness.logs.some((entry) => entry.level === 'warn')).toBe(true)
  })

  it('tells the user to open the app when the extension knows no site yet', async () => {
    const harness = createHarness({ targets: null })
    await harness.settle()

    expect(harness.list.children).toHaveLength(0)
    expect(harness.status.textContent).toContain('Quizlab Reader')
  })

  it('never reads a cookie', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.cookieAccesses).toEqual([])
  })

  it('never asks the network for the site list', async () => {
    const harness = createHarness()
    await harness.settle()

    expect(harness.networkCalls).toEqual([])
  })
})
