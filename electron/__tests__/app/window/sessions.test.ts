import { beforeEach, describe, expect, it, vi } from 'vitest'

const setPermissionRequestHandler = vi.fn()
const setPermissionCheckHandler = vi.fn()
const setDisplayMediaRequestHandler = vi.fn()
const onBeforeSendHeaders = vi.fn()
const getSources = vi.fn()
const showDisplayMediaPicker = vi.fn()
const resolveWebPermission = vi.fn(async (_request: unknown, decision: { granted: boolean }) => {
  if (decision.granted) return true
  const req = _request as { permission: string; requestingUrl?: string }
  return req.permission === 'media' && req.requestingUrl?.includes('chatgpt.com') === true
})

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null)
  },
  desktopCapturer: {
    getSources
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler,
      setPermissionCheckHandler
    },
    fromPartition: vi.fn(() => ({
      webRequest: {
        onBeforeSendHeaders
      },
      setPermissionRequestHandler,
      setPermissionCheckHandler,
      setDisplayMediaRequestHandler
    }))
  }
}))

vi.mock('../../../app/displayMediaPicker', () => ({
  showDisplayMediaPicker
}))

vi.mock('../../../app/window/permissionConsent', () => ({
  resolveWebPermission
}))

/** Grabs the handler most recently registered with `mock`. */
const lastHandler = (mock: typeof setPermissionRequestHandler) =>
  mock.mock.calls[mock.mock.calls.length - 1]?.[0]

/**
 * setupSessions registers the default session first and the AI partitions
 * after, so the default session's handler is the first call.
 */
const defaultSessionHandler = () => setPermissionRequestHandler.mock.calls[0]?.[0]

describe('window/sessions', () => {
  beforeEach(() => {
    vi.resetModules()
    setPermissionRequestHandler.mockReset()
    setPermissionCheckHandler.mockReset()
    setDisplayMediaRequestHandler.mockReset()
    onBeforeSendHeaders.mockReset()
    getSources.mockReset()
    showDisplayMediaPicker.mockReset()
    resolveWebPermission.mockClear()
  })

  it('configures a dynamic custom AI partition only once', async () => {
    const module = await import('../../../app/window/sessions.js')

    module.setupAiSession('persist:ai_custom_dynamic')
    module.setupAiSession('persist:ai_custom_dynamic')

    expect(setPermissionRequestHandler).toHaveBeenCalledTimes(1)
    expect(setPermissionCheckHandler).toHaveBeenCalledTimes(1)
    expect(setDisplayMediaRequestHandler).toHaveBeenCalledTimes(1)
  })

  it('configures permissions and display media handler', async () => {
    getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Display 1' },
      { id: 'window:1', name: 'Window 1' }
    ])
    showDisplayMediaPicker.mockResolvedValue(1)
    const module = await import('../../../app/window/sessions.js')

    module.setupSessions(() => ({}) as never)

    expect(setPermissionRequestHandler).toHaveBeenCalled()
    expect(setPermissionCheckHandler).toHaveBeenCalled()
    expect(setDisplayMediaRequestHandler).toHaveBeenCalled()

    const displayHandler = lastHandler(setDisplayMediaRequestHandler)
    const callback = vi.fn()
    displayHandler({ videoRequested: true }, callback)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(callback).toHaveBeenCalledWith({
      video: { id: 'window:1', name: 'Window 1' }
    })
  })

  it('preserves the Chrome User-Agent override', async () => {
    const module = await import('../../../app/window/sessions.js')
    module.setupAiSession('persist:ai_chatgpt')

    const handler = lastHandler(onBeforeSendHeaders)
    const details = { requestHeaders: { 'User-Agent': 'original' } }
    const callback = vi.fn()
    handler(details, callback)

    expect(details.requestHeaders['User-Agent']).toContain('Mozilla/5.0')
    expect(callback).toHaveBeenCalled()
  })

  describe('permission handlers', () => {
    const requestPermission = async (
      permission: string,
      details: Record<string, unknown>,
      partition = 'persist:ai_chatgpt'
    ) => {
      const module = await import('../../../app/window/sessions.js')
      module.setupAiSession(partition)
      const callback = vi.fn()
      lastHandler(setPermissionRequestHandler)(null, permission, callback, details)
      await new Promise((resolve) => setTimeout(resolve, 0))
      return callback
    }

    it('denies an ambient request from an unregistered origin', async () => {
      const callback = await requestPermission('media', {
        requestingUrl: 'https://evil.com/',
        requestingOrigin: 'https://evil.com',
        isMainFrame: true
      })

      expect(callback).toHaveBeenCalledWith(false)
      expect(resolveWebPermission).not.toHaveBeenCalled()
    })

    it('denies a custom partition with no registered origin', async () => {
      const callback = await requestPermission(
        'media',
        { requestingUrl: 'https://my-llm.example.com/', isMainFrame: true },
        'persist:ai_custom_unregistered'
      )

      expect(callback).toHaveBeenCalledWith(false)
    })

    it('does not prompt for a request the policy denies outright', async () => {
      const callback = await requestPermission('geolocation', {
        requestingUrl: 'https://chatgpt.com/',
        isMainFrame: true
      })

      expect(callback).toHaveBeenCalledWith(false)
      expect(resolveWebPermission).not.toHaveBeenCalled()
    })

    it('defers a consent-gated request to the consent resolver', async () => {
      const callback = await requestPermission('media', {
        requestingUrl: 'https://chatgpt.com/',
        requestingOrigin: 'https://chatgpt.com',
        isMainFrame: true
      })

      expect(resolveWebPermission).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(true)
    })

    it('reports a consent-gated request as not-yet-permitted to the check handler', async () => {
      const module = await import('../../../app/window/sessions.js')
      module.setupAiSession('persist:ai_chatgpt')

      const check = lastHandler(setPermissionCheckHandler)
      const granted = check(null, 'media', 'https://chatgpt.com', {
        requestingUrl: 'https://chatgpt.com/',
        isMainFrame: true
      })

      expect(granted).toBe(false)
    })

    it('allows a passive request on a trusted origin without prompting', async () => {
      const callback = await requestPermission('notifications', {
        requestingUrl: 'https://chatgpt.com/',
        isMainFrame: true
      })

      expect(callback).toHaveBeenCalledWith(true)
      expect(resolveWebPermission).not.toHaveBeenCalled()
    })

    it('denies a subframe ambient request on a trusted origin', async () => {
      const callback = await requestPermission('media', {
        requestingUrl: 'https://chatgpt.com/',
        isMainFrame: false
      })

      expect(callback).toHaveBeenCalledWith(false)
      expect(resolveWebPermission).not.toHaveBeenCalled()
    })

    it('denies a malformed requestingUrl', async () => {
      const callback = await requestPermission('notifications', {
        requestingUrl: 'not-a-url',
        isMainFrame: true
      })

      expect(callback).toHaveBeenCalledWith(false)
    })
  })

  it('scopes the default session to the app document', async () => {
    const module = await import('../../../app/window/sessions.js')
    module.setupSessions(() => ({}) as never)

    const handler = defaultSessionHandler()
    const allow = vi.fn()
    handler(null, 'notifications', allow, {
      requestingUrl: 'file:///app/dist/index.html',
      isMainFrame: true
    })
    const deny = vi.fn()
    handler(null, 'notifications', deny, {
      requestingUrl: 'https://evil.com/',
      isMainFrame: true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(allow).toHaveBeenCalledWith(true)
    expect(deny).toHaveBeenCalledWith(false)
  })
})
