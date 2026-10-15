import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcHandle = vi.fn()
const ipcOn = vi.fn()

// Hoisted: the manager mock factory pulls in the real module, which imports
// `electron` before the plain consts above are initialised.
const appOn = vi.hoisted(() => vi.fn())
const releaseAllAiViewHosts = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  // The reload watcher subscribes through `app.on('browser-window-created')`.
  app: { on: appOn },
  ipcMain: { handle: ipcHandle, on: ipcOn },
  WebContentsView: class {},
  shell: { openExternal: vi.fn(async () => undefined) }
}))

const requireTrustedIpcSender = vi.hoisted(() => vi.fn((_event: unknown) => true))
vi.mock('../../../core/ipcSecurity.js', () => ({
  requireTrustedIpcSender: (event: unknown) => requireTrustedIpcSender(event)
}))

/**
 * Stable window identity, because the reload watcher compares the window a
 * navigation came from against the main window. A factory returning a fresh
 * object per call would make every navigation look like a foreign one.
 */
const mainWindow = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    listeners,
    isDestroyed: () => false,
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    webContents: {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener)
      },
      isDestroyed: () => false,
      send: vi.fn()
    }
  }
})

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: () => mainWindow
}))

vi.mock('../../../app/window/permissionPolicy.js', () => ({
  isAllowedManagedViewPartition: (partition: unknown) =>
    typeof partition === 'string' && partition.startsWith('persist:'),
  isHostTrustedForPartition: () => true
}))

vi.mock('../../../app/window/remoteContentSecurity.js', () => ({
  applyRemoteContentSecurity: vi.fn()
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: {
    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      displayName: 'ChatGPT',
      url: 'https://chatgpt.com',
      partition: 'persist:ai_chatgpt'
    }
  },
  INACTIVE_PLATFORMS: {},
  CHROME_USER_AGENT: 'ua'
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({})
}))

vi.mock('../../../features/gemini-web-session/sessionConfig.js', () => ({
  PROFILE_PARTITION: 'persist:gemini_web_profile'
}))

const manager = await import('../../../features/ai-view/aiWebContentsViewManager.js')
vi.mock('../../../features/ai-view/aiWebContentsViewManager.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../features/ai-view/aiWebContentsViewManager.js')
  >('../../../features/ai-view/aiWebContentsViewManager.js')
  return {
    ...actual,
    attachAiView: vi.fn(async () => ({
      generation: 1,
      currentUrl: 'https://chatgpt.com/',
      isLoading: true,
      hasLoadedOnce: false,
      error: null
    })),
    detachAiViewHost: vi.fn(() => true),
    destroyAiView: vi.fn(async () => true),
    destroyAllAiViews: vi.fn(async () => undefined),
    setAiViewEventSink: vi.fn(),
    executeAiViewScript: vi.fn(async () => 'ok'),
    pasteAiView: vi.fn(() => true),
    focusAiView: vi.fn(() => true),
    insertAiViewText: vi.fn(() => true),
    sendAiViewInputEvent: vi.fn(() => true),
    reloadAiView: vi.fn(() => true),
    navigateAiView: vi.fn(() => true),
    loadAiViewUrl: vi.fn(() => true),
    getAiViewUrl: vi.fn(() => 'https://chatgpt.com/'),
    syncAiViewHost: vi.fn(() => true),
    releaseAllAiViewHosts: releaseAllAiViewHosts
  }
})

const { registerAiViewHandlers, disposeAiViewHandlers } =
  await import('../../../features/ai-view/aiViewHandlers.js')

const CHANNELS = {
  attach: 'ai-view-attach',
  detach: 'ai-view-detach',
  destroy: 'ai-view-destroy',
  reload: 'ai-view-reload',
  loadUrl: 'ai-view-load-url',
  navigate: 'ai-view-navigate',
  getUrl: 'ai-view-get-url',
  execute: 'ai-view-execute-script',
  insertText: 'ai-view-insert-text',
  inputEvent: 'ai-view-send-input-event',
  paste: 'ai-view-paste',
  focus: 'ai-view-focus',
  syncHost: 'ai-view-sync-host',
  event: 'ai-view-event'
}

const trustedEvent = { sender: { id: 'main' } }
const attackerEvent = { sender: { id: 'evil' } }

// The module guards registration, so capture the tables once instead of relying
// on a re-register call after every mock reset.
registerAiViewHandlers()

/**
 * The `browser-window-created` subscription the module performed at import.
 *
 * Captured at collection time because later suites clear the mock's call log,
 * and re-running the subscription would not exercise the real wiring anyway.
 */
const onBrowserWindowCreated = (appOn as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
  ([event]) => event === 'browser-window-created'
)?.[1] as ((_event: unknown, window: unknown) => void) | undefined
const HANDLERS = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(
  ipcHandle.mock.calls.map(([channel, handler]) => [
    channel as string,
    handler as (event: unknown, ...args: unknown[]) => Promise<unknown>
  ])
)
const LISTENERS = new Map<string, (event: unknown, request: unknown) => void>(
  ipcOn.mock.calls.map(([channel, handler]) => [
    channel as string,
    handler as (event: unknown, request: unknown) => void
  ])
)

const invoke = (channel: string) => {
  const handler = HANDLERS.get(channel)
  if (!handler) throw new Error(`handler for ${channel} was not registered`)
  return handler
}

const onMessage = (channel: string) => {
  const handler = LISTENERS.get(channel)
  if (!handler) throw new Error(`listener for ${channel} was not registered`)
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrustedIpcSender.mockReturnValue(true)
  ;(manager.attachAiView as ReturnType<typeof vi.fn>).mockResolvedValue({
    generation: 1,
    currentUrl: 'https://chatgpt.com/',
    isLoading: true,
    hasLoadedOnce: false,
    error: null
  })
  ;(manager.executeAiViewScript as ReturnType<typeof vi.fn>).mockResolvedValue('ok')
  ;(manager.getAiViewUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://chatgpt.com/')
})

describe('ai view IPC - registration', () => {
  it('registers every managed-view channel exactly once', () => {
    for (const channel of Object.values(CHANNELS)) {
      if (channel === CHANNELS.syncHost) continue
      if (channel === CHANNELS.event) continue
      expect(HANDLERS.has(channel)).toBe(true)
    }
    expect([...LISTENERS.keys()]).toEqual(expect.arrayContaining([CHANNELS.syncHost]))
  })

  it('no longer exposes a window-wide mouse-ignore channel', () => {
    // The channel used to arm BrowserWindow.setIgnoreMouseEvents, whose
    // `forward: true` forwards mouse move only and therefore killed every
    // mousedown in the window -- the panel divider included.
    expect([...LISTENERS.keys()]).not.toContain('ai-view-set-ignore-mouse')
  })
})

describe('ai view IPC - trusted sender boundary', () => {
  const rejectingChannels = [
    CHANNELS.attach,
    CHANNELS.detach,
    CHANNELS.destroy,
    CHANNELS.reload,
    CHANNELS.loadUrl,
    CHANNELS.navigate,
    CHANNELS.getUrl,
    CHANNELS.execute,
    CHANNELS.insertText,
    CHANNELS.inputEvent,
    CHANNELS.paste,
    CHANNELS.focus
  ]

  it('returns a failure envelope for an untrusted sender instead of acting', async () => {
    requireTrustedIpcSender.mockReturnValue(false)

    for (const channel of rejectingChannels) {
      const result = (await invoke(channel)(attackerEvent, {
        viewId: 'tab-1'
      })) as { ok: boolean; data?: unknown }
      // The repo convention is a typed envelope: commands that answer with a
      // boolean deny as { ok: true, data: false }, the rest as { ok: false }.
      // Either way no manager call is made.
      if (result.ok) {
        // getUrl is the one command whose "nothing" answer is null.
        expect(result.data === false || result.data === null).toBe(true)
      } else {
        expect(result.ok).toBe(false)
      }
    }

    expect(manager.pasteAiView).not.toHaveBeenCalled()
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
    expect(manager.focusAiView).not.toHaveBeenCalled()
  })

  it('drops fire-and-forget geometry from an untrusted sender', () => {
    requireTrustedIpcSender.mockReturnValue(false)

    const boundsHandler = onMessage(CHANNELS.syncHost)

    boundsHandler(attackerEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: 0, y: 0, width: 999, height: 999 },
      visible: true
    })

    expect(manager.syncAiViewHost).not.toHaveBeenCalled()
  })
})

describe('ai view IPC - input validation', () => {
  it('rejects an attach without a known target', async () => {
    await expect(
      invoke(CHANNELS.attach)(trustedEvent, { viewId: 'tab-1', source: { kind: 'nope' } })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.attachAiView).not.toHaveBeenCalled()
  })

  it('never lets the renderer choose the partition', async () => {
    await invoke(CHANNELS.attach)(trustedEvent, {
      viewId: 'tab-1',
      source: { kind: 'ai-platform', modelId: 'chatgpt', partition: 'persist:evil' }
    })

    const request = (manager.attachAiView as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(request).toMatchObject({ viewId: 'tab-1' })
    expect(request).not.toHaveProperty('partition')
  })

  it('rejects a script request with no script', async () => {
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, { viewId: 'tab-1', script: '' })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
  })

  it('rejects an oversized script', async () => {
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, {
        viewId: 'tab-1',
        script: 'a'.repeat(512 * 1024 + 1)
      })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
  })

  it('rejects a non-https load url', async () => {
    await invoke(CHANNELS.loadUrl)(trustedEvent, {
      viewId: 'tab-1',
      url: 'file:///etc/passwd'
    })
    expect(manager.loadAiViewUrl).toHaveBeenCalledWith('tab-1', null)
  })

  it('rejects a multi-step navigation delta', async () => {
    await invoke(CHANNELS.navigate)(trustedEvent, { viewId: 'tab-1', delta: 5 })
    expect(manager.navigateAiView).not.toHaveBeenCalled()
  })

  it('rejects a mouse input event', async () => {
    await invoke(CHANNELS.inputEvent)(trustedEvent, {
      viewId: 'tab-1',
      inputEvent: { type: 'mouseDown', x: 1, y: 1 }
    })
    expect(manager.sendAiViewInputEvent).not.toHaveBeenCalled()
  })

  it('rejects a malformed bounds message', () => {
    const boundsHandler = onMessage(CHANNELS.syncHost)

    boundsHandler(trustedEvent, { viewId: 'tab-1', hostToken: 'h1', bounds: 'big', visible: true })
    boundsHandler(trustedEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: NaN, y: 0, width: 1, height: 1 },
      visible: true
    })

    expect(manager.syncAiViewHost).not.toHaveBeenCalled()
  })

  it('normalises bounds before handing them to the manager', () => {
    const boundsHandler = onMessage(CHANNELS.syncHost)

    boundsHandler(trustedEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: -5, y: 1.4, width: 10.5, height: 0 },
      visible: true
    })

    expect(manager.syncAiViewHost).toHaveBeenCalledWith(
      'tab-1',
      'h1',
      { x: 0, y: 1, width: 11, height: 0, borderRadius: 0 },
      true
    )
  })
})

describe('ai view IPC - capability boundary', () => {
  it('addresses the managed view by tab id only', async () => {
    await invoke(CHANNELS.paste)(trustedEvent, { viewId: 'tab-9' })
    expect(manager.pasteAiView).toHaveBeenCalledWith('tab-9')
  })

  it('refuses to paste into an arbitrary webContents id', async () => {
    await invoke(CHANNELS.paste)(trustedEvent, { webContentsId: 42 })
    expect(manager.pasteAiView).not.toHaveBeenCalled()
  })

  it('returns a typed failure when the view is unknown', async () => {
    ;(manager.executeAiViewScript as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('view_not_found')
    )
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, { viewId: 'ghost', script: '1' })
    ).resolves.toMatchObject({ ok: false, error: { message: 'view_not_found' } })
  })

  it('returns null for the url of an unknown view', async () => {
    ;(manager.getAiViewUrl as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)
    await expect(invoke(CHANNELS.getUrl)(trustedEvent, { viewId: 'ghost' })).resolves.toEqual({
      ok: true,
      data: null
    })
  })
})

describe('ai view IPC - shutdown', () => {
  it('detaches the event sink and closes every managed view', async () => {
    vi.clearAllMocks()
    requireTrustedIpcSender.mockReturnValue(true)
    await disposeAiViewHandlers()
    expect(manager.setAiViewEventSink).toHaveBeenLastCalledWith(null)
    expect(manager.destroyAllAiViews).toHaveBeenCalledTimes(1)
  })
})

describe('ai view IPC - renderer reload', () => {
  // The managed views live in the main process, so they outlive the renderer
  // that positions them. A reload replaces that renderer without a single
  // cleanup running, which used to leave every host token naming a host that no
  // longer existed — and since the geometry channel is fire-and-forget, the next
  // renderer's first rectangle was then dropped against that stale owner for
  // good, leaving the view painting its previous rectangle over the DOM.
  interface NavigationSource {
    listeners: Map<string, (...args: unknown[]) => void>
    webContents: { on: (event: string, listener: (...args: unknown[]) => void) => void }
  }

  function createWindow(): NavigationSource {
    const listeners = new Map<string, (...args: unknown[]) => void>()
    return {
      listeners,
      webContents: {
        on: (event, listener) => {
          listeners.set(event, listener)
        }
      }
    }
  }

  function navigate(
    source: NavigationSource,
    url: string,
    isInPlace: boolean,
    isMainFrame: boolean
  ) {
    source.listeners.get('did-start-navigation')?.({}, url, isInPlace, isMainFrame)
  }

  beforeEach(() => {
    releaseAllAiViewHosts.mockClear()
  })

  it('releases every host claim when the main frame navigates', () => {
    onBrowserWindowCreated?.({}, mainWindow)

    navigate(mainWindow, 'http://localhost:5173/', false, true)

    expect(releaseAllAiViewHosts).toHaveBeenCalledTimes(1)
  })

  it('leaves the claims alone for an in-place navigation', () => {
    // A `#hash` change keeps the same document, so the React tree and its hosts
    // survive it — releasing here would blank every visible panel.
    onBrowserWindowCreated?.({}, mainWindow)

    navigate(mainWindow, 'http://localhost:5173/#tab', true, true)

    expect(releaseAllAiViewHosts).not.toHaveBeenCalled()
  })

  it('leaves the claims alone for a subframe navigation', () => {
    onBrowserWindowCreated?.({}, mainWindow)

    navigate(mainWindow, 'http://localhost:5173/frame', false, false)

    expect(releaseAllAiViewHosts).not.toHaveBeenCalled()
  })

  it('ignores a window that is not the main window', () => {
    // Picker windows share the BrowserWindow class and raise the same event, but
    // only the main window owns the AI panels.
    const picker = createWindow()
    onBrowserWindowCreated?.({}, picker)

    navigate(picker, 'http://localhost:5173/', false, true)

    expect(releaseAllAiViewHosts).not.toHaveBeenCalled()
  })
})
