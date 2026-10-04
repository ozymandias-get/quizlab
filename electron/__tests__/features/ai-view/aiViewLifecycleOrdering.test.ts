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
  shell: { openExternal: vi.fn(async () => undefined) }
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

vi.mock('../../../features/gemini-web-session/sessionConfig.js', () => ({
  PROFILE_PARTITION: 'persist:gemini_web_profile'
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
    expect(manager.hasManagedAiView('tab-A')).toBe(false)
    expect(WebContentsViewMock).not.toHaveBeenCalled()

    // The tab is closed while that attach is still resolving.
    const destroying = manager.destroyAiView('tab-A')

    // Target resolution completes and the attach creates the view.
    storeGate.releaseAll()
    await attaching
    await destroying

    // The destroy has to run after the attach it was queued behind, so the final
    // state is "gone" rather than "an orphan WebContents for a closed tab".
    expect(manager.hasManagedAiView('tab-A')).toBe(false)
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
    expect(manager.hasManagedAiView('tab-B')).toBe(true)
    // Two views were built over the sequence; the first one was closed.
    expect(WebContentsViewMock).toHaveBeenCalledTimes(2)
    expect(removeChildView).toHaveBeenCalledTimes(1)
    expect(addChildView).toHaveBeenCalledTimes(2)
    // Each attach created a fresh view, so each got its own generation.
    expect(attachTwo.generation).not.toBe(attachOne.generation)
    expect(attachTwo.created).toBe(true)
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
    expect(manager.hasManagedAiView('tab-C')).toBe(true)
    expect(manager.listManagedAiViewIds()).toEqual(['tab-C'])
    expect(firstResponse.created).toBe(true)
  })

  it('does not let an unrelated view wait for this one', async () => {
    await manager.destroyAllAiViews()

    storeGate.block(1)
    const blocked = manager.attachAiView({ viewId: 'tab-D', source: CUSTOM })
    await reachAttach()

    // A different AI tab must not be queued behind `tab-D`'s store read.
    const other = await manager.attachAiView({ viewId: 'tab-E', source: CUSTOM })
    expect(other.created).toBe(true)

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
    expect(manager.hasManagedAiView('tab-F')).toBe(false)
  })
})
