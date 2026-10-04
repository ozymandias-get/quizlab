import { describe, expect, it, vi } from 'vitest'

const WebContentsViewMock = vi.fn()
const addChildView = vi.fn()
const removeChildView = vi.fn()
const setIgnoreMouseEvents = vi.fn()

let createdViews: Array<Record<string, unknown>> = []

class FakeWebContentsView {
  static boundsHistory: Array<{ viewId: string; bounds: unknown }> = []
  static radiusHistory: Array<{ viewId: string; radius: number }> = []
  static visibleHistory: Array<{ viewId: string; visible: boolean }> = []
  static closedViews: string[] = []

  viewId: string
  bounds: unknown
  visible = false

  constructor(options: { webPreferences: { partition: string }; [key: string]: unknown }) {
    WebContentsViewMock(options)
    this.viewId = String((options as Record<string, unknown>).__viewId ?? 'unnamed')
    createdViews.push(options as unknown as Record<string, unknown>)
    this.webContents = createFakeWebContents(this.viewId)
  }

  webContents: ReturnType<typeof createFakeWebContents>

  setBounds(bounds: unknown) {
    this.bounds = bounds
    FakeWebContentsView.boundsHistory.push({ viewId: this.viewId, bounds })
  }

  setBorderRadius(radius: number) {
    FakeWebContentsView.radiusHistory.push({ viewId: this.viewId, radius })
  }

  setVisible(visible: boolean) {
    this.visible = visible
    FakeWebContentsView.visibleHistory.push({ viewId: this.viewId, visible })
  }
}

interface FakeWebContents {
  id: number
  destroyed: boolean
  listeners: Map<string, Set<(...args: unknown[]) => void>>
  session: object
  loadURL: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
  reloadIgnoringCache: ReturnType<typeof vi.fn>
  executeJavaScript: ReturnType<typeof vi.fn>
  insertText: ReturnType<typeof vi.fn>
  sendInputEvent: ReturnType<typeof vi.fn>
  paste: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  isDestroyed: () => boolean
  getURL: () => string
  setUserAgent: ReturnType<typeof vi.fn>
  setIgnoreMouseEvents: ReturnType<typeof vi.fn>
  setWindowOpenHandler: ReturnType<typeof vi.fn>
  navigationHistory: { goBack: ReturnType<typeof vi.fn>; goForward: ReturnType<typeof vi.fn> }
  on: (event: string, handler: (...args: unknown[]) => void) => void
  once: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  insertCSS: ReturnType<typeof vi.fn>
  emit: (event: string, ...args: unknown[]) => void
}

let nextWebContentsId = 1

function createFakeWebContents(viewId: string): FakeWebContents {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  let currentUrl = ''
  return {
    id: nextWebContentsId++,
    destroyed: false,
    listeners,
    session: { partition: 'test' },
    loadURL: vi.fn(async (url: string) => {
      currentUrl = url
    }),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    executeJavaScript: vi.fn(async () => ({ success: true })),
    insertText: vi.fn(),
    sendInputEvent: vi.fn(),
    paste: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(() => {
      listeners.clear()
    }),
    isDestroyed: () => false,
    getURL: () => currentUrl,
    setUserAgent: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    navigationHistory: { goBack: vi.fn(), goForward: vi.fn() },
    insertCSS: vi.fn(async () => undefined),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
      set.add(handler)
      listeners.set(event, set)
    },
    once: (event: string, handler: (...args: unknown[]) => void) => {
      const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
      set.add(handler)
      listeners.set(event, set)
    },
    removeListener: (event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler)
    },
    emit: (event: string, ...args: unknown[]) => {
      // Electron commits the navigation before `did-navigate` fires, so `getURL()`
      // already reports the new URL here. Modelling that is what makes the
      // manager's URL snapshot assertion meaningful.
      if (event === 'did-navigate' || event === 'did-navigate-in-page') {
        currentUrl = String(args[1] ?? currentUrl)
      }
      for (const handler of listeners.get(event) ?? []) handler(...args)
    },
    viewId
  } as unknown as FakeWebContents
}

vi.mock('electron', () => ({
  WebContentsView: FakeWebContentsView,
  shell: { openExternal: vi.fn(async () => undefined) }
}))

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: () => ({
    isDestroyed: () => false,
    setIgnoreMouseEvents,
    contentView: {
      addChildView: (...args: unknown[]) => addChildView(...args),
      removeChildView: (...args: unknown[]) => removeChildView(...args)
    },
    webContents: { isDestroyed: () => false, send: vi.fn() }
  })
}))

vi.mock('../../../app/window/permissionPolicy.js', () => ({
  isAllowedManagedViewPartition: (partition: unknown) =>
    typeof partition === 'string' && partition.startsWith('persist:'),
  // Mirrors the real derivation: the registry origin per partition, exact host or
  // a subdomain of it, and a registered origin for user-added platforms.
  isHostTrustedForPartition: (partition: string, hostname: string) => {
    const roots: Record<string, string[]> = {
      'persist:ai_chatgpt': ['chatgpt.com'],
      'persist:ai_custom_custom_1': ['local.test']
    }
    return (
      roots[partition]?.some((root) => hostname === root || hostname.endsWith(`.${root}`)) === true
    )
  }
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
  INACTIVE_PLATFORMS: {
    grok: {
      id: 'grok',
      name: 'Grok',
      url: 'https://grok.com',
      partition: 'persist:ai_grok'
    }
  },
  CHROME_USER_AGENT: 'Mozilla/5.0 Chrome/999'
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({
    custom_1: {
      id: 'custom_1',
      name: 'Local',
      displayName: 'Local',
      url: 'https://local.test',
      partition: 'persist:ai_custom_custom_1'
    },
    hostile: {
      id: 'hostile',
      name: 'Hostile',
      url: 'http://insecure.test',
      partition: 'persist:ai_custom_hostile'
    },
    noPartition: {
      id: 'noPartition',
      name: 'NoPartition',
      url: 'https://nopartition.test'
    }
  })
}))

vi.mock('../../../features/gemini-web-session/sessionConfig.js', () => ({
  PROFILE_PARTITION: 'persist:gemini_web_profile'
}))

const manager = await import('../../../features/ai-view/aiWebContentsViewManager.js')

const CHATGPT = { kind: 'ai-platform' as const, modelId: 'chatgpt' }
const GROK = { kind: 'ai-platform' as const, modelId: 'grok' }
const CUSTOM = { kind: 'ai-platform' as const, modelId: 'custom_1' }

async function reset() {
  await manager.destroyAllAiViews()
  manager.setAiViewEventSink(null)
  WebContentsViewMock.mockClear()
  addChildView.mockClear()
  removeChildView.mockClear()
  setIgnoreMouseEvents.mockClear()
  createdViews = []
  FakeWebContentsView.boundsHistory = []
  FakeWebContentsView.visibleHistory = []
  FakeWebContentsView.closedViews = []
  nextWebContentsId = 1
}

describe('AiWebContentsViewManager - creation', () => {
  it('creates exactly one view per tab id', async () => {
    await reset()
    const first = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(first.created).toBe(true)

    WebContentsViewMock.mockClear()
    const second = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(second.created).toBe(false)
    expect(second.generation).toBe(first.generation)
    expect(WebContentsViewMock).not.toHaveBeenCalled()
  })

  it('locks down the WebContentsView preferences', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    const prefs = createdViews[0].webPreferences as Record<string, unknown>
    expect(prefs).toMatchObject({
      partition: 'persist:ai_chatgpt',
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      navigateOnDragDrop: false
    })
    expect(prefs.preload).toBeUndefined()
  })

  it('resolves the partition from main-process state, never from the renderer', async () => {
    await reset()
    await manager.attachAiView({
      viewId: 'tab-1',
      // @ts-expect-error - the renderer must not be able to name a partition
      source: { kind: 'ai-platform', modelId: 'chatgpt', partition: 'persist:evil' }
    })
    expect((createdViews[0].webPreferences as { partition: string }).partition).toBe(
      'persist:ai_chatgpt'
    )
  })

  it('resolves custom platform partitions from the store', async () => {
    await reset()
    await manager.attachAiView({
      viewId: 'tab-custom',
      source: { kind: 'ai-platform', modelId: 'custom_1' }
    })
    expect((createdViews[0].webPreferences as { partition: string }).partition).toBe(
      'persist:ai_custom_custom_1'
    )
  })

  it('refuses a custom platform with a non-https origin', async () => {
    await reset()
    await expect(
      manager.attachAiView({
        viewId: 'tab-hostile',
        source: { kind: 'ai-platform', modelId: 'hostile' }
      })
    ).rejects.toThrow(/unknown_view_target/)
    expect(WebContentsViewMock).not.toHaveBeenCalled()
  })

  it('refuses a platform without a partition', async () => {
    await reset()
    await expect(
      manager.attachAiView({
        viewId: 'tab-np',
        source: { kind: 'ai-platform', modelId: 'noPartition' }
      })
    ).rejects.toThrow(/unknown_view_target/)
  })

  it('refuses an unknown model or app id', async () => {
    await reset()
    await expect(
      manager.attachAiView({ viewId: 'tab-x', source: { kind: 'ai-platform', modelId: 'nope' } })
    ).rejects.toThrow(/unknown_view_target/)
    await expect(
      manager.attachAiView({ viewId: 'tab-y', source: { kind: 'google-web-app', appId: 'nope' } })
    ).rejects.toThrow(/unknown_view_target/)
  })

  it('maps a Google web app onto the shared Gemini session partition', async () => {
    await reset()
    await manager.attachAiView({
      viewId: 'gdrive:1',
      source: { kind: 'google-web-app', appId: 'gdrive' }
    })
    expect((createdViews[0].webPreferences as { partition: string }).partition).toBe(
      'persist:gemini_web_profile'
    )
  })

  it('recreates the view when the tab points at a different model', async () => {
    await reset()
    const first = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    WebContentsViewMock.mockClear()
    const second = await manager.attachAiView({ viewId: 'tab-1', source: GROK })

    expect(second.created).toBe(true)
    expect(second.generation).not.toBe(first.generation)
    expect(removeChildView).toHaveBeenCalledTimes(1)
    expect(WebContentsViewMock).toHaveBeenCalledTimes(1)
  })

  it('attaches the view to the window content view', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(addChildView).toHaveBeenCalledTimes(1)
  })
})

describe('AiWebContentsViewManager - url restoration', () => {
  it('replays a restored url on the same trusted origin', async () => {
    await reset()
    const response = await manager.attachAiView({
      viewId: 'tab-1',
      source: CHATGPT,
      restoredUrl: 'https://chatgpt.com/c/existing-chat'
    })
    expect(response.currentUrl).toBe('https://chatgpt.com/c/existing-chat')
  })

  it('falls back to the registry entry when the restored url leaves the origin', async () => {
    await reset()
    const response = await manager.attachAiView({
      viewId: 'tab-1',
      source: CHATGPT,
      restoredUrl: 'https://evil.test/steal'
    })
    expect(response.currentUrl).toBe('https://grok.com/'.replace('grok.com', 'chatgpt.com'))
  })

  it('falls back to the registry entry for a non-https restored url', async () => {
    await reset()
    const response = await manager.attachAiView({
      viewId: 'tab-1',
      source: CHATGPT,
      restoredUrl: 'http://chatgpt.com'
    })
    expect(response.currentUrl.startsWith('https://')).toBe(true)
  })

  it('hands the next host the conversation url, not the entry url', async () => {
    // A focus-mode handoff attaches to a view the user has navigated inside.
    // `currentUrl` used to be the entry URL forever, so the new controller was
    // told the guest was sitting on the provider's home page.
    await reset()
    const first = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-navigate', {}, 'https://chatgpt.com/c/123', 200, 'OK')

    manager.detachAiViewHost('tab-1', 'h1')
    const second = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    expect(second.created).toBe(false)
    expect(second.currentUrl).toBe('https://chatgpt.com/c/123')
    expect(second.generation).toBe(first.generation)
    // A pure reposition: no reload, no second entry load.
    expect(entry.webContents.reload).not.toHaveBeenCalled()
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(1)
  })

  it('follows an in-page navigation too, since providers are single-page apps', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-navigate-in-page', {}, 'https://chatgpt.com/c/456', true, 1, 1)

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(response.currentUrl).toBe('https://chatgpt.com/c/456')
  })
})

describe('AiWebContentsViewManager - navigation policy', () => {
  it('loads a renderer-requested url on a trusted origin of the same partition', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // The attach itself performs the entry load; only later calls matter here.
    vi.mocked(entry.webContents.loadURL).mockClear()

    expect(manager.loadAiViewUrl('tab-1', 'https://chatgpt.com/c/3')).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledWith('https://chatgpt.com/c/3')
  })

  it('accepts a subdomain of the registered host, so sign-in flows keep working', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // The attach itself performs the entry load; only later calls matter here.
    vi.mocked(entry.webContents.loadURL).mockClear()

    expect(manager.loadAiViewUrl('tab-1', 'https://auth.chatgpt.com/login')).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledWith('https://auth.chatgpt.com/login')
  })

  it('refuses to walk a managed view onto a foreign https origin', async () => {
    // Regression guard. `loadURL` used to be handed any https URL, so a
    // compromised renderer could point a provider partition — session cookies
    // and all — at an origin it controls.
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // The attach itself performs the entry load; only later calls matter here.
    vi.mocked(entry.webContents.loadURL).mockClear()

    expect(manager.loadAiViewUrl('tab-1', 'https://evil.test/steal')).toBe(false)
    expect(manager.loadAiViewUrl('tab-1', 'https://chatgpt.com.evil.test/steal')).toBe(false)
    expect(entry.webContents.loadURL).not.toHaveBeenCalled()
  })

  it('refuses every dangerous scheme', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    vi.mocked(entry.webContents.loadURL).mockClear()

    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'chrome://settings',
      'devtools://devtools/bundled/inspector.html',
      'about:blank',
      'not a url'
    ]) {
      expect(manager.loadAiViewUrl('tab-1', url)).toBe(false)
    }
    expect(entry.webContents.loadURL).not.toHaveBeenCalled()
  })

  it('refuses a host that only another partition trusts', async () => {
    // The trust check is per partition, not global: Grok's origin is not a ChatGPT
    // origin even though both are registry providers.
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // The attach itself performs the entry load; only later calls matter here.
    vi.mocked(entry.webContents.loadURL).mockClear()

    expect(manager.loadAiViewUrl('tab-1', 'https://grok.com/c/1')).toBe(false)
    expect(entry.webContents.loadURL).not.toHaveBeenCalled()
  })

  it('loads the url of a registered custom platform origin', async () => {
    // Custom platforms are user-added arbitrary https origins; registering the
    // origin is what keeps them working, so the policy must not break them.
    await reset()
    await manager.attachAiView({ viewId: 'tab-custom', source: CUSTOM })
    const entry = manager.getManagedAiView('tab-custom')!

    expect(manager.loadAiViewUrl('tab-custom', 'https://local.test/chat')).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledWith('https://local.test/chat')
  })

  it('refuses an empty or non-string url', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // The attach itself performs the entry load; only later calls matter here.
    vi.mocked(entry.webContents.loadURL).mockClear()

    expect(manager.loadAiViewUrl('tab-1', '')).toBe(false)
    expect(manager.loadAiViewUrl('tab-1', { url: 'https://chatgpt.com' })).toBe(false)
    expect(entry.webContents.loadURL).not.toHaveBeenCalled()
  })

  it('keeps re-validating against the partition the view was created in', async () => {
    // A later navigation cannot be re-pointed at a different partition either:
    // the target travels with the view, not with the request.
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    expect(entry.target.partition).toBe('persist:ai_chatgpt')
    expect(manager.loadAiViewUrl('tab-1', 'https://local.test/chat')).toBe(false)
  })
})

describe('AiWebContentsViewManager - host geometry', () => {
  it('starts hidden and collapsed so nothing flashes over the app shell', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(false)
    expect(FakeWebContentsView.boundsHistory.at(-1)?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })
  })

  it('positions and reveals the view from a host sync', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'h1', { x: 10, y: 20, width: 300, height: 400 }, true)

    expect(FakeWebContentsView.boundsHistory.at(-1)?.bounds).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 400,
      borderRadius: 0
    })
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(true)
  })

  it('clips the view to the panel corner radius the host measured', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    FakeWebContentsView.radiusHistory = []

    manager.syncAiViewHost(
      'tab-1',
      'h1',
      { x: 0, y: 0, width: 300, height: 400, borderRadius: 15 },
      true
    )

    expect(FakeWebContentsView.radiusHistory.at(-1)?.radius).toBe(15)
  })

  it('re-clips when only the radius changes', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const base = { x: 0, y: 0, width: 300, height: 400 }

    manager.syncAiViewHost('tab-1', 'h1', { ...base, borderRadius: 0 }, true)
    FakeWebContentsView.radiusHistory = []
    manager.syncAiViewHost('tab-1', 'h1', { ...base, borderRadius: 16 }, true)

    expect(FakeWebContentsView.radiusHistory.at(-1)?.radius).toBe(16)
  })

  it('hides the view when the host reports visible=false without moving it', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'h1', { x: 0, y: 0, width: 300, height: 400 }, true)
    manager.syncAiViewHost('tab-1', 'h1', { x: 0, y: 0, width: 300, height: 400 }, false)

    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(false)
  })

  it('never shows the view for a collapsed host rectangle', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'h1', { x: 0, y: 0, width: 0, height: 400 }, true)
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(false)
  })

  it('deduplicates identical rectangles instead of re-setting them', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const bounds = { x: 1, y: 2, width: 3, height: 4 }
    manager.syncAiViewHost('tab-1', 'h1', bounds, true)
    const after = FakeWebContentsView.boundsHistory.length
    manager.syncAiViewHost('tab-1', 'h1', bounds, true)
    expect(FakeWebContentsView.boundsHistory.length).toBe(after)
  })

  it('rejects a stale host token so an old placeholder cannot move the view', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'active-host', { x: 5, y: 5, width: 100, height: 100 }, true)

    const applied = FakeWebContentsView.boundsHistory.length
    expect(
      manager.syncAiViewHost('tab-1', 'stale-host', { x: 999, y: 999, width: 1, height: 1 }, true)
    ).toBe(false)
    expect(FakeWebContentsView.boundsHistory.length).toBe(applied)
  })

  it('lets the surviving host take over after the previous one releases', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'old-host', { x: 0, y: 0, width: 100, height: 100 }, true)

    // Release from the current owner, then a new host claims the same view.
    expect(manager.detachAiViewHost('tab-1', 'old-host')).toBe(true)
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(false)
    expect(
      manager.syncAiViewHost('tab-1', 'new-host', { x: 8, y: 8, width: 200, height: 300 }, true)
    ).toBe(true)
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(true)
  })

  it('ignores a release from a host that never owned the view', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    manager.syncAiViewHost('tab-1', 'owner', { x: 0, y: 0, width: 100, height: 100 }, true)
    expect(manager.detachAiViewHost('tab-1', 'impostor')).toBe(false)
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(true)
  })
})

describe('AiWebContentsViewManager - commands', () => {
  it('routes commands only to a tab it owns', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    expect(manager.reloadAiView('tab-1')).toBe(true)
    expect(entry.webContents.reload).toHaveBeenCalled()

    expect(manager.navigateAiView('tab-1', -1)).toBe(true)
    expect(entry.webContents.navigationHistory.goBack).toHaveBeenCalled()
    expect(manager.navigateAiView('tab-1', 1)).toBe(true)
    expect(entry.webContents.navigationHistory.goForward).toHaveBeenCalled()

    expect(manager.insertAiViewText('tab-1', 'hello')).toBe(true)
    expect(entry.webContents.insertText).toHaveBeenCalledWith('hello')

    expect(manager.pasteAiView('tab-1')).toBe(true)
    expect(entry.webContents.paste).toHaveBeenCalled()

    expect(manager.focusAiView('tab-1')).toBe(true)
    expect(entry.webContents.focus).toHaveBeenCalled()

    expect(manager.getAiViewUrl('tab-1')).toBeTruthy()
  })

  it('rejects every command for an unknown tab id', async () => {
    await reset()
    expect(manager.reloadAiView('ghost')).toBe(false)
    expect(manager.navigateAiView('ghost', 1)).toBe(false)
    expect(manager.insertAiViewText('ghost', 'x')).toBe(false)
    expect(manager.pasteAiView('ghost')).toBe(false)
    expect(manager.focusAiView('ghost')).toBe(false)
    expect(manager.loadAiViewUrl('ghost', 'https://chatgpt.com')).toBe(false)
    expect(manager.getAiViewUrl('ghost')).toBeNull()
    await expect(manager.destroyAiView('ghost')).resolves.toBe(false)
    expect(manager.syncAiViewHost('ghost', 'h', { x: 0, y: 0, width: 1, height: 1 }, true)).toBe(
      false
    )
  })

  it('never asks the window to ignore mouse events', async () => {
    // Regression guard. `setIgnoreMouseEvents` is BrowserWindow-scoped in
    // Electron 42 and `forward: true` only forwards mouse *move*, so arming it
    // swallowed every mousedown in the window -- including the panel divider's,
    // which made the panel unresizable. Nothing may bring it back.
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    await manager.attachAiView({ viewId: 'tab-2', source: GROK })

    manager.syncAiViewHost('tab-1', 'h1', { x: 0, y: 0, width: 100, height: 100 }, true)
    manager.syncAiViewHost('tab-1', 'h1', { x: 0, y: 0, width: 100, height: 100 }, false)
    manager.syncAiViewHost('tab-2', 'h2', { x: 0, y: 0, width: 100, height: 100 }, true)
    manager.detachAiViewHost('tab-1', 'h1')
    await manager.destroyAiView('tab-2')
    await manager.attachAiView({ viewId: 'tab-3', source: CHATGPT })

    expect(setIgnoreMouseEvents).not.toHaveBeenCalled()
  })

  it('executes a script through the managed WebContents', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    await expect(manager.executeAiViewScript('tab-1', 'document.readyState')).resolves.toEqual({
      success: true
    })
    await expect(manager.executeAiViewScript('ghost', '1')).rejects.toThrow(/view_not_found/)
  })

  it('normalises input events to Electron modifier names', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    manager.sendAiViewInputEvent('tab-1', {
      type: 'keyDown',
      keyCode: 'v',
      modifiers: ['control', 'not-a-modifier']
    })
    expect(entry.webContents.sendInputEvent).toHaveBeenCalledWith({
      type: 'keyDown',
      keyCode: 'v',
      modifiers: ['control']
    })
  })

  it('applies the desktop user agent the old webview attribute used to set', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    expect(entry.webContents.setUserAgent).toHaveBeenCalledWith('Mozilla/5.0 Chrome/999')
  })
})

describe('AiWebContentsViewManager - lifecycle', () => {
  it('closes the view and drops the map entry on destroy', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    await expect(manager.destroyAiView('tab-1')).resolves.toBe(true)
    expect(removeChildView).toHaveBeenCalledTimes(1)
    expect(entry.webContents.close).toHaveBeenCalledTimes(1)
    expect(manager.getManagedAiView('tab-1')).toBeNull()
    expect(manager.listManagedAiViewIds()).not.toContain('tab-1')
  })

  it('closes every managed view when the window goes away', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    await manager.attachAiView({ viewId: 'tab-2', source: GROK })
    const tab1 = manager.getManagedAiView('tab-1')!
    const tab2 = manager.getManagedAiView('tab-2')!

    await manager.destroyAllAiViews()

    expect(tab1.webContents.close).toHaveBeenCalledTimes(1)
    expect(tab2.webContents.close).toHaveBeenCalledTimes(1)
    expect(manager.listManagedAiViewIds()).toEqual([])
  })

  it('keeps the view alive when a host unmounts, so a surface swap preserves state', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    manager.detachAiViewHost('tab-1', 'h1')

    expect(entry.webContents.close).not.toHaveBeenCalled()
    expect(manager.getManagedAiView('tab-1')).not.toBeNull()
    expect(FakeWebContentsView.visibleHistory.at(-1)?.visible).toBe(false)
  })

  it('forwards lifecycle and console events with the view generation', async () => {
    await reset()
    const received: Array<Record<string, unknown>> = []
    manager.setAiViewEventSink((event) =>
      received.push(event as unknown as Record<string, unknown>)
    )

    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    const generation = entry.generation

    entry.webContents.emit('dom-ready')
    entry.webContents.emit('did-stop-loading')
    entry.webContents.emit('did-navigate', {}, 'https://chatgpt.com/c/1', 200, 'OK')
    entry.webContents.emit('did-navigate-in-page', {}, 'https://chatgpt.com/c/1?x=1', true, 1, 1)
    entry.webContents.emit('did-fail-load', {}, -6, 'FILE_NOT_FOUND', 'https://x.test', true)
    entry.webContents.emit('did-fail-load', {}, -6, 'FILE_NOT_FOUND', 'https://x.test', false)
    entry.webContents.emit('did-fail-load', {}, -2, 'FAILED', 'https://x.test', true)
    entry.webContents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 9 })
    entry.webContents.emit('render-process-gone', {}, { reason: 'clean-exit', exitCode: 0 })
    entry.webContents.emit('console-message', {
      level: 'info',
      message: '_aiPicker:result:{}',
      lineNumber: 1,
      sourceId: 'x'
    })
    entry.webContents.emit('console-message', undefined, 'warning', 'legacy message', 2, 'y')

    const kinds = received.map((event) => event.kind)
    expect(kinds).toContain('dom-ready')
    expect(kinds).toContain('did-stop-loading')
    expect(kinds).toContain('did-navigate')
    expect(kinds).toContain('did-navigate-in-page')
    expect(kinds).toContain('did-fail-load')
    expect(kinds).toContain('render-process-gone')
    expect(kinds).toContain('console-message')
    // Sub-frame load failures and non-crash render-process exits are dropped here.
    // Transient *error codes* are still forwarded; the renderer decides not to
    // surface them as an error.
    expect(received.filter((e) => e.kind === 'did-fail-load')).toHaveLength(2)
    expect(received.filter((e) => e.kind === 'render-process-gone')).toHaveLength(1)
    expect(received.every((event) => event.generation === generation)).toBe(true)
    expect(received.every((event) => event.viewId === 'tab-1')).toBe(true)

    const consoleMessages = received.filter((e) => e.kind === 'console-message')
    expect(consoleMessages.map((e) => e.message)).toEqual(['_aiPicker:result:{}', 'legacy message'])
  })

  it('stops bridging events once the view is destroyed', async () => {
    await reset()
    const received: unknown[] = []
    manager.setAiViewEventSink((event) => received.push(event))
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!

    await manager.destroyAiView('tab-1')
    entry.webContents.emit('dom-ready')

    expect(received).toHaveLength(0)
  })
})

describe('AiWebContentsViewManager - state snapshot', () => {
  /** Collects only the manager's authoritative snapshots, live. */
  const captureState = (): Array<Record<string, unknown>> => {
    const states: Array<Record<string, unknown>> = []
    manager.setAiViewEventSink((event) => {
      if (event.kind === 'state') states.push(event as unknown as Record<string, unknown>)
    })
    return states
  }

  it('reports a freshly created view as loading, not yet painted', async () => {
    await reset()
    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    expect(response.created).toBe(true)
    expect(response.isLoading).toBe(true)
    expect(response.hasLoadedOnce).toBe(false)
    expect(response.loadState).toBe('loading')
    expect(response.error).toBeNull()
  })

  it('reports an existing settled view as ready to be shown immediately', async () => {
    // The focus-mode shape: `created: false` and no further load event is coming,
    // so this snapshot is the only thing that can release the splash.
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-stop-loading')

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    expect(response.created).toBe(false)
    expect(response.isLoading).toBe(false)
    expect(response.hasLoadedOnce).toBe(true)
    expect(response.loadState).toBe('settled')
  })

  it('reports an existing still-loading view as loading', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    expect(response.isLoading).toBe(true)
    expect(response.hasLoadedOnce).toBe(false)
    expect(response.loadState).toBe('loading')
  })

  it('carries a fatal load failure to the next host instead of a spinner', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', '', true)
    entry.webContents.emit('did-stop-loading')

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })

    expect(response.isLoading).toBe(false)
    expect(response.hasLoadedOnce).toBe(true)
    expect(response.loadState).toBe('failed')
    expect(response.error).toEqual({ code: -105, description: 'ERR_NAME_NOT_RESOLVED' })
  })

  it('does not settle a load that an aborted redirect hop reported as failed', async () => {
    // Providers redirect constantly (consent pages, sign-in hops), and Chromium
    // reports each abandoned hop as ERR_ABORTED. Treating that as "the attempt
    // settled" would reveal the view on a blank page and skip the settled
    // callback for the document that is still on its way.
    await reset()
    captureState()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', '', true)

    const midFlight = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(midFlight.isLoading).toBe(true)
    expect(midFlight.hasLoadedOnce).toBe(false)
    expect(midFlight.loadState).toBe('loading')

    entry.webContents.emit('dom-ready')
    entry.webContents.emit('did-stop-loading')

    const settled = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(settled.loadState).toBe('settled')
    expect(settled.hasLoadedOnce).toBe(true)
    expect(settled.error).toBeNull()
  })

  it('stops reporting a crashed guest as loading, which would never settle', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    // Crashed during the first load: no `did-stop-loading` is coming, so the
    // snapshot must not keep claiming it is still loading.
    entry.webContents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 9 })

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(response.isLoading).toBe(false)
    expect(response.hasLoadedOnce).toBe(false)
  })

  it('clears a recorded failure once a new attempt produces a document', async () => {
    await reset()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const entry = manager.getManagedAiView('tab-1')!
    entry.webContents.emit('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND', '', true)
    entry.webContents.emit('did-start-loading')
    entry.webContents.emit('dom-ready')
    entry.webContents.emit('did-stop-loading')

    const response = await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(response.loadState).toBe('settled')
    expect(response.error).toBeNull()
  })

  it('pushes a state event when the load state changes, and not for URL churn', async () => {
    await reset()
    const states = captureState()

    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    expect(states).toHaveLength(0)

    const entry = manager.getManagedAiView('tab-1')!
    // A navigation on its own changes nothing a host depends on; the URL rides
    // on the `did-navigate` event instead.
    entry.webContents.emit('did-navigate', {}, 'https://chatgpt.com/c/1', 200, 'OK')
    expect(states).toHaveLength(0)

    entry.webContents.emit('did-stop-loading')
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      viewId: 'tab-1',
      generation: entry.generation,
      isLoading: false,
      hasLoadedOnce: true,
      loadState: 'settled'
    })

    // A re-navigation flips back to loading and then settles again, so a host
    // that missed the original event still converges on the truth.
    entry.webContents.emit('did-start-loading')
    expect(states.map((state) => state.loadState)).toEqual(['settled', 'loading'])
    entry.webContents.emit('did-stop-loading')
    expect(states.map((state) => state.loadState)).toEqual(['settled', 'loading', 'settled'])
  })

  it('stops publishing snapshots for a view that a newer generation replaced', async () => {
    await reset()
    const states = captureState()
    await manager.attachAiView({ viewId: 'tab-1', source: CHATGPT })
    const first = manager.getManagedAiView('tab-1')!

    // The tab switched model, so the first view is closed and replaced.
    await manager.attachAiView({ viewId: 'tab-1', source: GROK })
    const second = manager.getManagedAiView('tab-1')!
    expect(second.generation).not.toBe(first.generation)

    first.webContents.emit('did-stop-loading')
    expect(states).toHaveLength(0)

    second.webContents.emit('did-stop-loading')
    expect(states).toHaveLength(1)
    expect(states[0].generation).toBe(second.generation)
  })
})
