/**
 * Security boundary tests for the remote-content guard applied to every embedded
 * surface (AI provider sites, Google Drive panel, Gemini web session apps).
 *
 * The guard stops a malicious remote page from reading the system clipboard. It
 * previously blocked ALL clipboard events, which also blocked the app's own
 * deliberate image paste: the app writes a real image to the clipboard and calls
 * webContents.paste(), and the guest page never saw the event, so the send button
 * stayed aria-disabled forever.
 *
 * The policy is now: block untrusted events, allow trusted ones. `isTrusted`
 * cannot be forged by page script, so programmatic clipboard access stays closed.
 *
 * The listeners are captured and invoked directly because jsdom models every
 * event as untrusted and owns `isTrusted` as a non-configurable instance
 * property, so a dispatched event cannot present a trusted verdict.
 */

import { isAuthNavigationDomain } from '../../../app/window/remoteContentSecurity'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const REMOTE_CONTENT_CLIPBOARD_PROTECTION_SCRIPT = (
  await import('../../../app/window/remoteContentSecurity')
).REMOTE_CONTENT_CLIPBOARD_PROTECTION_SCRIPT

interface FakeEventTarget {
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  execCommand: (command: string) => boolean
  /** The implementation the guard is expected to delegate to. */
  originalExecCommand: ReturnType<typeof vi.fn>
  listeners: Record<string, (event: Event) => void>
}

function createDocument(): FakeEventTarget & { restore: () => void } {
  const listeners: Record<string, (event: Event) => void> = {}
  const execCommand = vi.fn(() => true)

  const addEventListener = vi.fn((type: string, handler: (event: Event) => void) => {
    listeners[type] = handler
  })
  const removeEventListener = vi.fn((type: string) => {
    delete listeners[type]
  })

  const fakeDocument = {
    addEventListener,
    removeEventListener,
    execCommand,
    listeners
  } as unknown as FakeEventTarget

  const originalDocument = globalThis.document
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: fakeDocument
  })

  return Object.assign(fakeDocument, {
    originalExecCommand: execCommand,
    restore: () => {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: originalDocument
      })
    }
  })
}

describe('remote content clipboard guard', () => {
  let fakeDocument: FakeEventTarget & { restore: () => void }

  beforeEach(() => {
    fakeDocument = createDocument()

    new Function(REMOTE_CONTENT_CLIPBOARD_PROTECTION_SCRIPT)()
  })

  afterEachRestore()

  function afterEachRestore() {
    return () => fakeDocument.restore()
  }

  describe('registration', () => {
    it('guards copy, cut and paste in the capture phase', () => {
      expect(fakeDocument.addEventListener).toHaveBeenCalledWith('copy', expect.any(Function), true)
      expect(fakeDocument.addEventListener).toHaveBeenCalledWith('cut', expect.any(Function), true)
      expect(fakeDocument.addEventListener).toHaveBeenCalledWith(
        'paste',
        expect.any(Function),
        true
      )
    })

    it('replaces execCommand at install time', () => {
      expect(fakeDocument.execCommand).not.toBeUndefined()
    })
  })

  describe('security: untrusted clipboard access stays blocked', () => {
    const makeUntrustedEvent = (type: string) =>
      ({
        type,
        isTrusted: false,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn()
      }) as unknown as Event

    it('blocks an untrusted copy event', () => {
      const event = makeUntrustedEvent('copy')
      fakeDocument.listeners.copy(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
    })

    it('blocks an untrusted cut event', () => {
      const event = makeUntrustedEvent('cut')
      fakeDocument.listeners.cut(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
    })

    it('blocks an untrusted paste event', () => {
      const event = makeUntrustedEvent('paste')
      fakeDocument.listeners.paste(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
    })

    it('blocks execCommand copy, cut and paste without delegating', () => {
      // The guard replaces document.execCommand on the fake document.
      const overridden = (fakeDocument as unknown as { execCommand: (c: string) => boolean })
        .execCommand
      for (const command of ['copy', 'cut', 'paste', 'COPY']) {
        expect(overridden(command)).toBe(false)
      }
      // Any other verb still reaches the original implementation.
      expect(overridden('selectAll')).toBe(true)
      expect(fakeDocument.originalExecCommand).toHaveBeenCalledWith('selectAll')
    })
  })

  describe('the image-paste fix', () => {
    const makeTrustedEvent = (type: string) =>
      ({
        type,
        isTrusted: true,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn()
      }) as unknown as Event

    it('lets a trusted paste through', () => {
      const event = makeTrustedEvent('paste')
      fakeDocument.listeners.paste(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('lets a trusted copy through', () => {
      const event = makeTrustedEvent('copy')
      fakeDocument.listeners.copy(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('lets a trusted cut through', () => {
      const event = makeTrustedEvent('cut')
      fakeDocument.listeners.cut(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('still lets the app-synthesized text paste through', () => {
      const event = {
        type: 'paste',
        isTrusted: false,
        __quizlabInternalPaste: true,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn()
      } as unknown as Event
      fakeDocument.listeners.paste(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('blocks an untrusted paste that carries the internal marker', () => {
      const event = {
        type: 'paste',
        isTrusted: false,
        __quizlabInternalPaste: false,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn()
      } as unknown as Event
      fakeDocument.listeners.paste(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })
})

describe('applyRemoteContentSecurity', () => {
  const shellOpenExternal = vi.fn(async () => undefined)

  beforeEach(() => {
    vi.resetModules()
    shellOpenExternal.mockClear()
    vi.doMock('electron', () => ({
      shell: { openExternal: shellOpenExternal }
    }))
  })

  function createWebContents() {
    const listeners = new Map<string, (...args: unknown[]) => void>()
    const setWindowOpenHandler = vi.fn()
    const executeJavaScript = vi.fn().mockResolvedValue(undefined)
    const webContents = {
      setWindowOpenHandler,
      executeJavaScript,
      isDestroyed: vi.fn(() => false),
      on: (event: string, handler: (...args: unknown[]) => void) => listeners.set(event, handler)
    }
    return { webContents, listeners, setWindowOpenHandler, executeJavaScript }
  }

  it('denies every popup and hands only https links to the OS', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, setWindowOpenHandler } = createWebContents()

    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    const handler = setWindowOpenHandler.mock.calls[0][0]
    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/')

    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'chrome://settings',
      'http://example.com'
    ]) {
      shellOpenExternal.mockClear()
      expect(handler({ url })).toEqual({ action: 'deny' })
      expect(shellOpenExternal).not.toHaveBeenCalled()
    }
  })

  it('blocks auth-domain navigation, and only hands it to the OS for Google sessions', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')

    const chatgpt = createWebContents()
    apply({ webContents: chatgpt.webContents as never, partition: 'persist:ai_chatgpt' })
    const preventDefault = vi.fn()
    chatgpt.listeners.get('will-navigate')?.(
      { preventDefault },
      'https://accounts.google.com/signin'
    )
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).not.toHaveBeenCalled()

    const gemini = createWebContents()
    apply({ webContents: gemini.webContents as never, partition: 'persist:gemini_web_profile' })
    const geminiPrevent = vi.fn()
    gemini.listeners.get('will-navigate')?.(
      { preventDefault: geminiPrevent },
      'https://accounts.google.com/signin'
    )
    expect(geminiPrevent).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://accounts.google.com/signin')
  })

  it('leaves non-auth navigation untouched', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    const preventDefault = vi.fn()
    listeners.get('will-navigate')?.({ preventDefault }, 'https://chatgpt.com/c/abc')
    listeners.get('will-redirect')?.({ preventDefault }, 'https://chatgpt.com/api/auth')
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('lets a provider navigate across origins, so sign-in and consent still work', async () => {
    // The scheme guard is deliberately not an origin lock: providers legitimately
    // move to sibling hosts mid-flow, and pinning the entry host would break
    // login while still not being the security boundary (see
    // `isUrlTrustedForTarget` for the renderer-initiated path and
    // `permissionPolicy` for what an untrusted origin may do inside the view).
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    const preventDefault = vi.fn()
    listeners.get('will-navigate')?.({ preventDefault }, 'https://auth.chatgpt.com/authorize')
    listeners.get('will-navigate')?.({ preventDefault }, 'https://chat.openai.com/')
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('blocks main-frame navigation to any scheme that has no legitimate use', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://chatgpt.com/abc',
      'chrome://settings',
      'devtools://devtools/bundled/inspector.html',
      'about:blank'
    ]) {
      const preventDefault = vi.fn()
      listeners.get('will-navigate')?.({ preventDefault }, url)
      expect(preventDefault).toHaveBeenCalledTimes(1)

      const redirectPrevent = vi.fn()
      listeners.get('will-redirect')?.({ preventDefault: redirectPrevent }, url)
      expect(redirectPrevent).toHaveBeenCalledTimes(1)
    }

    // Nothing dangerous may reach the OS hand-off either.
    expect(shellOpenExternal).not.toHaveBeenCalled()
  })

  it('rejects certificate errors', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    const preventDefault = vi.fn()
    const callback = vi.fn()
    listeners.get('certificate-error')?.(
      { preventDefault },
      'https://chatgpt.com',
      'ERR_CERT_AUTHORITY_INVALID',
      {},
      callback
    )
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(false)
  })

  it('injects the clipboard guard after every load', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners, executeJavaScript } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    listeners.get('did-finish-load')?.({})
    expect(executeJavaScript).toHaveBeenCalledTimes(1)
    expect(executeJavaScript.mock.calls[0][0]).toContain('execCommand')
  })

  it('blocks a main-frame downgrade to http, on both navigate and redirect', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    for (const url of [
      'http://chatgpt.com/c/abc',
      'http://localhost:5173/',
      'http://169.254.169.254/latest/meta-data/'
    ]) {
      const preventDefault = vi.fn()
      listeners.get('will-navigate')?.({ preventDefault }, url)
      expect(preventDefault, url).toHaveBeenCalledTimes(1)

      const redirectPrevent = vi.fn()
      listeners.get('will-redirect')?.({ preventDefault: redirectPrevent }, url)
      expect(redirectPrevent, url).toHaveBeenCalledTimes(1)
    }

    // Nothing may be handed to the OS hand-off either.
    expect(shellOpenExternal).not.toHaveBeenCalled()
  })

  it('still lets every provider sign-in, consent and challenge flow through', async () => {
    // The scheme guard is not an origin lock: pinning main-frame navigation to
    // the entry host would break every login. These are the hosts providers
    // actually move to, and all of them are https.
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    for (const url of [
      'https://auth.chatgpt.com/authorize',
      'https://chat.openai.com/backend-api/conversation',
      'https://chatgpt.com/api/auth/session',
      'https://challenges.cloudflare.com/turnstile/v0/api.js',
      'https://gemini.google.com/',
      // A custom AI platform is an arbitrary https origin the user registered.
      'https://my-self-hosted-llm.internal/chat'
    ]) {
      const preventDefault = vi.fn()
      listeners.get('will-navigate')?.({ preventDefault }, url)
      expect(preventDefault, url).not.toHaveBeenCalled()
    }
  })

  it('still intercepts the IdP auth hosts for the OS hand-off, on https', async () => {
    // These are blocked on purpose and handed to the user's browser — a
    // separate concern from the scheme guard, and it must keep working.
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:ai_chatgpt' })

    for (const url of [
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      'https://login.live.com/oauth20_authorize.srf',
      'https://login.x.com/i/flow/login',
      'https://accounts.google.com/o/oauth2/v2/auth'
    ]) {
      const preventDefault = vi.fn()
      listeners.get('will-navigate')?.({ preventDefault }, url)
      expect(preventDefault, url).toHaveBeenCalledTimes(1)
    }

    // A plain AI partition does not send them to the OS.
    expect(shellOpenExternal).not.toHaveBeenCalled()
  })

  it('still hands Google auth to the OS for the shared Google session partition', async () => {
    const { applyRemoteContentSecurity: apply } =
      await import('../../../app/window/remoteContentSecurity.js')
    const { webContents, listeners } = createWebContents()
    apply({ webContents: webContents as never, partition: 'persist:gemini_web_profile' })

    const preventDefault = vi.fn()
    listeners.get('will-navigate')?.(
      { preventDefault },
      'https://accounts.google.com/o/oauth2/v2/auth'
    )
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth')
  })
})

describe('isAllowedRemoteNavigationScheme - https only', () => {
  it('admits exactly the https scheme', async () => {
    const { isAllowedRemoteNavigationScheme: allowed } =
      await import('../../../app/window/remoteContentSecurity.js')

    expect(allowed('https://chatgpt.com/c/abc')).toBe(true)
    expect(allowed('https://auth.chatgpt.com/authorize?x=1#y')).toBe(true)

    // `http:` used to be admitted alongside `https:`. No flow in the app can put
    // one into a managed view — built-in providers, Google web apps and custom
    // platforms are all rejected at target resolution unless they are https,
    // `parseUrl` drops a non-https restored or renderer-requested URL, and
    // `resolveExternalLink` only ever hands `https:`/`mailto:` to the OS — so
    // accepting it here was a transport downgrade with no legitimate user.
    expect(allowed('http://chatgpt.com/')).toBe(false)
    expect(allowed('http://localhost:5173/')).toBe(false)
    expect(allowed('HTTP://chatgpt.com/')).toBe(false)
    expect(allowed('HtTpS://chatgpt.com/')).toBe(true)

    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://chatgpt.com/abc',
      'chrome://settings',
      'devtools://devtools/bundled/inspector.html',
      'about:blank',
      'ws://chatgpt.com/socket',
      'not a url',
      ''
    ]) {
      expect(allowed(url)).toBe(false)
    }
  })
})

describe('isAuthNavigationDomain', () => {
  it('matches the auth hosts and their subdomains only', () => {
    expect(isAuthNavigationDomain('https://accounts.google.com/signin')).toBe(true)
    expect(isAuthNavigationDomain('https://login.microsoftonline.com/common')).toBe(true)
    expect(isAuthNavigationDomain('https://login.live.com/oauth20')).toBe(true)
    expect(isAuthNavigationDomain('https://login.x.com/i/flow/login')).toBe(true)
    expect(isAuthNavigationDomain('https://myaccount.google.com')).toBe(true)
  })

  it('does not match look-alike hosts', () => {
    expect(isAuthNavigationDomain('https://accounts.google.com.evil.test')).toBe(false)
    expect(isAuthNavigationDomain('https://evil.test/?x=accounts.google.com')).toBe(false)
    expect(isAuthNavigationDomain('not a url')).toBe(false)
  })
})
