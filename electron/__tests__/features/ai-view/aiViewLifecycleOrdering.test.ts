/**
 * Main-process lifecycle ordering for one managed view id.
 *
 * `attach` is not synchronous — it awaits target resolution, which for a custom
 * platform reads the custom-platform store off disk — while `destroy` is a plain
 * message. Without a per-id queue, a `destroy` that lands during that await
 * finds nothing in the manager's map, answers `false`, and the attach then
 * finishes and creates a `WebContents` for a tab that is already gone. That
 * orphan keeps a renderer process alive until the window closes.
 *
 * `readCustomPlatforms` is the seam: it is production code the manager really
 * awaits, so gating it with a deferred promise reproduces the race without any
 * test-only hook in the manager itself.
 */

import { describe, expect, it, vi } from 'vitest'

const addChildView = vi.fn()
const removeChildView = vi.fn()

const fromPartition = vi.hoisted(() => vi.fn())
fromPartition.mockReturnValue({
  webRequest: { onBeforeSendHeaders: vi.fn() },
  setDisplayMediaRequestHandler: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
  setPermissionCheckHandler: vi.fn()
})

const WebContentsViewMock = vi.fn()

class FakeWebContentsView {
  static visibleHistory: Array<{ viewId: string; visible: boolean }> = []
  static liveViewIds: string[] = []
  static allWebContents: FakeWebContents[] = []

  viewId: string
  webContents: FakeWebContents

  constructor(options: { webPreferences: { partition: string }; [key: string]: unknown }) {
    WebContentsViewMock(options)
    this.viewId = `view-${FakeWebContentsView.allWebContents.length}`
    this.webContents = createFakeWebContents()
    FakeWebContentsView.allWebContents.push(this.webContents)
    FakeWebContentsView.liveViewIds.push(this.viewId)
  }

  setBounds() {}
  setBorderRadius() {}
  setVisible(visible: boolean) {
    FakeWebContentsView.visibleHistory.push({ viewId: this.viewId, visible })
  }
}

interface FakeWebContents {
  listeners: Map<string, Set<(...args: unknown[]) => void>>
  loadURL: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  isDestroyed: () => boolean
  getURL: () => string
  setUserAgent: ReturnType<typeof vi.fn>
  setWindowOpenHandler: ReturnType<typeof vi.fn>
  navigationHistory: { goBack: ReturnType<typeof vi.fn>; goForward: ReturnType<typeof vi.fn> }
  on: (event: string, handler: (...args: unknown[]) => void) => void
  once: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  insertCSS: ReturnType<typeof vi.fn>
  emit: (event: string, ...args: unknown[]) => void
}

function createFakeWebContents(): FakeWebContents {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  let currentUrl = ''
  return {
    listeners,
    loadURL: vi.fn(async (url: string) => {
      currentUrl = url
    }),
    reload: vi.fn(),
    close: vi.fn(),
    isDestroyed: () => false,
    getURL: () => currentUrl,
    setUserAgent: vi.fn(),
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
      // Electron commits a navigation before `did-navigate` fires, so `getURL()`
      // already reports the new URL here.
      if (event === 'did-navigate' || event === 'did-navigate-in-page') {
        currentUrl = String(args[1] ?? currentUrl)
      }
      for (const handler of listeners.get(event) ?? []) handler(...args)
    }
  } as unknown as FakeWebContents
}

vi.mock('electron', () => ({
  WebContentsView: FakeWebContentsView,
  shell: { openExternal: vi.fn(async () => undefined) },
  session: { fromPartition },
  // The per-view clipboard menu builds a native menu on right-click; these
  // stand in for the main-process APIs it touches.
  Menu: { buildFromTemplate: vi.fn(() => ({ popup: vi.fn() })) },
  clipboard: { writeText: vi.fn() },
  BrowserWindow: { fromWebContents: () => null },
  app: { getLocale: () => 'en' }
}))

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: () => ({
    isDestroyed: () => false,
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
  isHostTrustedForPartition: (partition: string, hostname: string) =>
    partition === 'persist:ai_custom_custom_1' && hostname.endsWith('local.test')
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: {},
  INACTIVE_PLATFORMS: {},
  CHROME_USER_AGENT: 'Mozilla/5.0 Chrome/999'
}))

/**
 * Gate the manager really awaits when it resolves a custom platform target.
 *
 * `block(n)` holds the next `n` store reads; `releaseAll()` lets them finish.
 * A count rather than a flag, because the tests need one specific attach to be
 * stuck while an unrelated view attaches normally.
 */
const storeGate = vi.hoisted(() => {
  const waiting: Array<() => void> = []
  let armed = 0
  return {
    block: (count: number) => {
      armed += count
    },
    releaseAll: () => {
      for (const resolve of waiting.splice(0)) resolve()
    },
    take: () => {
      if (armed <= 0) return false
      armed -= 1
      return true
    },
    register: (resolve: () => void) => {
      waiting.push(resolve)
    }
  }
})

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => {
    if (storeGate.take()) {
      await new Promise<void>((resolve) => storeGate.register(resolve))
    }
    return {
      custom_1: {
        id: 'custom_1',
        name: 'Local',
        displayName: 'Local',
        url: 'https://local.test',
        partition: 'persist:ai_custom_custom_1'
      }
    }
  }
}))

const manager = await import('../../../features/ai-view/aiWebContentsViewManager.js')

const CUSTOM = { kind: 'ai-platform' as const, modelId: 'custom_1' }

/** Lets the attach reach the point where it is waiting on the store. */
async function reachAttach(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

describe('AiWebContentsViewManager - attach / destroy ordering', () => {
  it('does not orphan a view when a destroy overtakes a pending attach', async () => {
    storeGate.block(1)

    // The attach is in flight, still resolving its target: no view exists yet.
    const attaching = manager.attachAiView({ viewId: 'tab-A', source: CUSTOM })
    await reachAttach()
    expect(manager.getManagedAiView('tab-A')).toBeNull()
    expect(WebContentsViewMock).not.toHaveBeenCalled()

    // The tab is closed while that attach is still resolving.
    const destroying = manager.destroyAiView('tab-A')

    // Target resolution completes and the attach creates the view.
    storeGate.releaseAll()
    await attaching
    await destroying

    // The destroy has to run after the attach it was queued behind, so the final
    // state is "gone" rather than "an orphan WebContents for a closed tab".
    expect(manager.getManagedAiView('tab-A')).toBeNull()
    expect(manager.listManagedAiViewIds()).not.toContain('tab-A')
    expect(removeChildView).toHaveBeenCalled()
  })

  it('leaves exactly one live view for attach -> destroy -> attach', async () => {
    await manager.destroyAllAiViews()
    WebContentsViewMock.mockClear()
    addChildView.mockClear()
    removeChildView.mockClear()

    const attachOne = await manager.attachAiView({ viewId: 'tab-B', source: CUSTOM })
    const destroy = manager.destroyAiView('tab-B')
    const attachTwo = await manager.attachAiView({ viewId: 'tab-B', source: CUSTOM })
    await destroy

    expect(manager.listManagedAiViewIds()).toEqual(['tab-B'])
    expect(manager.getManagedAiView('tab-B')).not.toBeNull()
    // Two views were built over the sequence; the first one was closed.
    expect(WebContentsViewMock).toHaveBeenCalledTimes(2)
    expect(removeChildView).toHaveBeenCalledTimes(1)
    expect(addChildView).toHaveBeenCalledTimes(2)
    // Each attach created a fresh view, so each got its own generation.
    expect(attachTwo.generation).not.toBe(attachOne.generation)
    expect(attachTwo.generation).toBeGreaterThan(0)
  })

  it('settles attach #3 when a destroy #2 is interleaved mid-flight', async () => {
    await manager.destroyAllAiViews()
    WebContentsViewMock.mockClear()

    storeGate.block(1)

    const first = manager.attachAiView({ viewId: 'tab-C', source: CUSTOM })
    await reachAttach()
    const second = manager.destroyAiView('tab-C')
    const third = manager.attachAiView({ viewId: 'tab-C', source: CUSTOM })

    storeGate.releaseAll()
    const [firstResponse] = await Promise.all([first])
    await Promise.all([second, third])

    // The final state is whatever the *last* lifecycle operation asked for. The
    // middle destroy must not swallow the attach behind it either.
    expect(manager.getManagedAiView('tab-C')).not.toBeNull()
    expect(manager.listManagedAiViewIds()).toEqual(['tab-C'])
    expect(firstResponse.generation).toBeGreaterThan(0)
  })

  it('does not let an unrelated view wait for this one', async () => {
    await manager.destroyAllAiViews()

    storeGate.block(1)
    const blocked = manager.attachAiView({ viewId: 'tab-D', source: CUSTOM })
    await reachAttach()

    // A different AI tab must not be queued behind `tab-D`'s store read.
    const other = await manager.attachAiView({ viewId: 'tab-E', source: CUSTOM })
    expect(other.generation).toBeGreaterThan(0)

    storeGate.releaseAll()
    await blocked

    expect(manager.listManagedAiViewIds().sort()).toEqual(['tab-D', 'tab-E'])
    await manager.destroyAllAiViews()
  })

  it('closes every view even when one of them has a pending attach at shutdown', async () => {
    await manager.destroyAllAiViews()
    WebContentsViewMock.mockClear()

    storeGate.block(1)
    const pending = manager.attachAiView({ viewId: 'tab-F', source: CUSTOM })
    await reachAttach()

    const shutdown = manager.destroyAllAiViews()
    storeGate.releaseAll()
    await pending
    await shutdown

    expect(manager.listManagedAiViewIds()).toEqual([])
    expect(manager.getManagedAiView('tab-F')).toBeNull()
  })
})

/**
 * Duplicate navigation and dead-entry handling.
 *
 * A focus-mode handoff keeps two hosts mounted for the exit animation. Both can
 * process the same one-shot "open this conversation" request, and both used to
 * issue `loadURL` for the same document to the same view: the second load
 * aborts the first request and any upload the site had started. The guard is
 * per view and per in-flight URL, so it cannot block a deliberate visit later.
 */
describe('AiWebContentsViewManager - in-flight navigation and dead entries', () => {
  const NAV_URL = 'https://local.test/c/1'

  async function freshView(viewId: string) {
    await manager.destroyAllAiViews()
    WebContentsViewMock.mockClear()
    addChildView.mockClear()
    removeChildView.mockClear()
    await manager.attachAiView({ viewId, source: CUSTOM })
    return manager.getManagedAiView(viewId)!
  }

  it('drops an identical navigation only while the first one is still in flight', async () => {
    const entry = await freshView('nav-1')
    let resolveLoad: () => void = () => {}
    const load = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })
    vi.mocked(entry.webContents.loadURL).mockClear()
    vi.mocked(entry.webContents.loadURL).mockReturnValue(load as never)

    expect(manager.loadAiViewUrl('nav-1', NAV_URL)).toBe(true)
    expect(manager.loadAiViewUrl('nav-1', NAV_URL)).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(1)

    resolveLoad()
    await load
    await Promise.resolve()

    // The first document settled, so this is a new intent, not a duplicate.
    vi.mocked(entry.webContents.loadURL).mockResolvedValue(undefined)
    expect(manager.loadAiViewUrl('nav-1', NAV_URL)).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(2)
  })

  it('does not suppress a different URL that arrives while one is loading', async () => {
    const entry = await freshView('nav-2')
    const load = new Promise<void>(() => {})
    vi.mocked(entry.webContents.loadURL).mockClear()
    vi.mocked(entry.webContents.loadURL).mockReturnValue(load as never)

    expect(manager.loadAiViewUrl('nav-2', NAV_URL)).toBe(true)
    expect(manager.loadAiViewUrl('nav-2', 'https://local.test/c/2')).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(2)
  })

  it('lets a retry through after the first identical load failed', async () => {
    const entry = await freshView('nav-3')
    vi.mocked(entry.webContents.loadURL).mockClear()
    vi.mocked(entry.webContents.loadURL).mockRejectedValueOnce(new Error('ERR_FAILED'))

    expect(manager.loadAiViewUrl('nav-3', NAV_URL)).toBe(true)
    await Promise.resolve()
    await Promise.resolve()

    vi.mocked(entry.webContents.loadURL).mockResolvedValue(undefined)
    expect(manager.loadAiViewUrl('nav-3', NAV_URL)).toBe(true)
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(2)
  })

  it('lets an explicit reload supersede the in-flight marker', async () => {
    const entry = await freshView('nav-4')
    const load = new Promise<void>(() => {})
    vi.mocked(entry.webContents.loadURL).mockClear()
    vi.mocked(entry.webContents.loadURL).mockReturnValue(load as never)

    expect(manager.loadAiViewUrl('nav-4', NAV_URL)).toBe(true)
    manager.reloadAiView('nav-4')
    vi.mocked(entry.webContents.loadURL).mockResolvedValue(undefined)
    expect(manager.loadAiViewUrl('nav-4', NAV_URL)).toBe(true)
    expect(entry.webContents.reload).toHaveBeenCalledTimes(1)
    expect(entry.webContents.loadURL).toHaveBeenCalledTimes(2)
  })

  it('retires a destroyed entry instead of leaving its native child on the window', async () => {
    const entry = await freshView('nav-5')
    ;(entry.webContents as unknown as { isDestroyed: () => boolean }).isDestroyed = () => true

    entry.webContents.emit('destroyed')
    for (let turn = 0; turn < 4; turn += 1) await Promise.resolve()

    expect(manager.listManagedAiViewIds()).not.toContain('nav-5')
    expect(removeChildView).toHaveBeenCalledTimes(1)
  })

  it('replaces a dead entry on attach instead of shadowing its native child', async () => {
    const first = await freshView('nav-6')
    ;(first.webContents as unknown as { isDestroyed: () => boolean }).isDestroyed = () => true

    const second = await manager.attachAiView({ viewId: 'nav-6', source: CUSTOM })

    expect(second.generation).not.toBe(first.generation)
    expect(manager.listManagedAiViewIds()).toEqual(['nav-6'])
    expect(WebContentsViewMock).toHaveBeenCalledTimes(2)
    expect(removeChildView).toHaveBeenCalledTimes(1)
  })
})

describe('AiWebContentsViewManager - reload in a partition', () => {
  it('reloads the live views of that partition and nothing else', async () => {
    await manager.destroyAllAiViews()

    await manager.attachAiView({ viewId: 'tab-R1', source: CUSTOM })
    await manager.attachAiView({ viewId: 'tab-R2', source: CUSTOM })

    expect(manager.reloadManagedViewsInPartition('persist:ai_custom_custom_1')).toBe(2)
    expect(manager.getManagedAiView('tab-R1')?.webContents.reload).toHaveBeenCalledTimes(1)
    expect(manager.getManagedAiView('tab-R2')?.webContents.reload).toHaveBeenCalledTimes(1)

    // A site with its own partition is not touched by another site's import.
    expect(manager.reloadManagedViewsInPartition('persist:ai_chatgpt')).toBe(0)
  })
})
