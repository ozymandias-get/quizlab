/**
 * Focus mode: an existing managed view handed to a new host placeholder.
 *
 * The bug this pins down is that asserting "same generation" is not enough. A
 * focus-mode switch keeps one `WebContents` alive and mounts a *new* controller
 * for it, so the new host knows nothing about a load that finished minutes ago.
 * `revealAfterFirstLoad` then held the native view at `visible: false` forever,
 * because the `did-stop-loading` that would have released it had already been
 * delivered to a controller that no longer exists.
 *
 * The fake below is a state machine in the shape of `AiWebContentsViewManager`:
 * it only reports what the manager actually knows (generation, current URL,
 * isLoading, hasLoadedOnce, error), and it emits no event for a load that
 * already finished. A host therefore only reaches `visible: true` if the
 * snapshot on the attach response is really consumed.
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiViewEvent } from '@shared-core/types/aiView'

const { useManagedContentView } = await import('@shared/hooks/aiContent/useManagedContentView')

interface FakeView {
  generation: number
  currentUrl: string
  isLoading: boolean
  hasLoadedOnce: boolean
  closed: boolean
}

interface FakeAttachResponse {
  generation: number
  currentUrl: string
  isLoading: boolean
  hasLoadedOnce: boolean
  error: null
}

/**
 * Mirrors `AiWebContentsViewManager`: `attach` answers with the view's
 * authoritative snapshot, and lifecycle events are only produced while a load is
 * actually in flight.
 */
const manager = vi.hoisted(() => {
  const views = new Map<string, FakeView>()
  const sinks = new Set<(event: unknown) => void>()
  let generationCounter = 0

  const snapshotOf = (view: FakeView) => ({
    generation: view.generation,
    currentUrl: view.currentUrl,
    isLoading: view.isLoading,
    hasLoadedOnce: view.hasLoadedOnce,
    error: null
  })

  const emit = (event: AiViewEvent) => {
    for (const sink of sinks) sink(event)
  }

  const model = {
    views,
    liveCount: () => [...views.values()].filter((view) => !view.closed).length,
    subscribe: (sink: (event: unknown) => void) => {
      sinks.add(sink)
      return () => {
        sinks.delete(sink)
      }
    },
    attach: (viewId: string): FakeAttachResponse => {
      const existing = views.get(viewId)
      if (existing && !existing.closed) return { ...snapshotOf(existing) }
      generationCounter += 1
      const view: FakeView = {
        generation: generationCounter,
        currentUrl: 'https://chatgpt.com/',
        isLoading: true,
        hasLoadedOnce: false,
        closed: false
      }
      views.set(viewId, view)
      return { ...snapshotOf(view) }
    },
    destroy: (viewId: string) => {
      const view = views.get(viewId)
      if (!view || view.closed) return false
      view.closed = true
      views.delete(viewId)
      return true
    },
    /** Chromium finishing the entry load of `viewId`. */
    settle: (viewId: string) => {
      const view = views.get(viewId)
      if (!view) return
      const base = { viewId, generation: view.generation }
      view.isLoading = true
      emit({ ...base, kind: 'did-start-loading', currentUrl: view.currentUrl })
      view.isLoading = false
      view.hasLoadedOnce = true
      emit({ ...base, kind: 'did-stop-loading', currentUrl: view.currentUrl })
    },
    /** The guest navigating in-page, which main mirrors into its URL. */
    navigate: (viewId: string, url: string) => {
      const view = views.get(viewId)
      if (!view) return
      view.currentUrl = url
      emit({
        viewId,
        generation: view.generation,
        kind: 'did-navigate-in-page',
        url,
        isMainFrame: true
      })
    },
    /**
     * A new load attempt inside the *same* WebContents.
     *
     * `did-start-loading` deliberately leaves `hasLoadedOnce` alone in the
     * manager's mirror, so the republished snapshot reports a view that is both
     * loading and already painted. A host that read `isLoading` as "take the
     * splash back" would blank the panel on every SPA navigation.
     */
    renavigate: (viewId: string, url: string) => {
      const view = views.get(viewId)
      if (!view) return
      view.currentUrl = url
      view.isLoading = true
      emit({ viewId, ...snapshotOf(view), kind: 'state' })
    },
    reset: () => {
      views.clear()
      sinks.clear()
      generationCounter = 0
    }
  }
  return model
})

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(),
  destroy: vi.fn(),
  reload: vi.fn(),
  loadUrl: vi.fn(),
  navigate: vi.fn(),
  getUrl: vi.fn(),
  executeScript: vi.fn(),
  insertText: vi.fn(),
  sendInputEvent: vi.fn(),
  paste: vi.fn(),
  focus: vi.fn(),
  syncHost: vi.fn(),
  onEvent: vi.fn()
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  reportSuppressedError: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showWarning: vi.fn(), showError: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const baseOptions = {
  viewId: 'tab-1',
  source: { kind: 'ai-platform' as const, modelId: 'chatgpt' },
  modelId: 'chatgpt',
  // The hook takes its warning reporter as a port instead of reaching for the
  // toast provider itself, so the test supplies the reporter directly.
  showWarning: vi.fn(),
  isEnabled: true,
  isHostOwner: true,
  visible: true,
  revealAfterFirstLoad: true
}

const HOST_RECT = { left: 12, top: 20, width: 300, height: 400 }

function createHostElement(): HTMLDivElement {
  return {
    getBoundingClientRect: () => ({
      ...HOST_RECT,
      right: HOST_RECT.left + HOST_RECT.width,
      bottom: HOST_RECT.top + HOST_RECT.height,
      x: HOST_RECT.left,
      y: HOST_RECT.top,
      toJSON: () => ({})
    })
  } as unknown as HTMLDivElement
}

/** Lets the attach round trip and every queued `act` settle before asserting. */
async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
  })
}

async function mount(options = {}) {
  const utils = renderHook(
    (props: Parameters<typeof useManagedContentView>[0]) => useManagedContentView(props),
    { initialProps: { ...baseOptions, ...options } }
  )
  await act(async () => {
    utils.result.current.setHostElement(createHostElement())
  })
  await flush()
  return utils
}

const lastSync = () => aiViewClient.syncHost.mock.calls.at(-1)?.[0]
const generationOf = () => manager.views.get('tab-1')?.generation

beforeEach(() => {
  vi.clearAllMocks()
  manager.reset()
  aiViewClient.attach.mockImplementation(async ({ viewId }: { viewId: string }) =>
    manager.attach(viewId)
  )
  aiViewClient.destroy.mockImplementation(async ({ viewId }: { viewId: string }) =>
    manager.destroy(viewId)
  )
  aiViewClient.detach.mockResolvedValue(true)
  aiViewClient.syncHost.mockReturnValue(undefined)
  aiViewClient.onEvent.mockImplementation((handler: (event: unknown) => void) =>
    manager.subscribe(handler)
  )
})

describe('focus mode - the settled view handoff', () => {
  it('reveals an already-loaded view on the new host, without reloading it', async () => {
    // Workspace host: the view is created here and its first load settles.
    const workspace = await mount()
    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
    expect(lastSync()?.visible).toBe(false)
    expect(workspace.result.current.hasLoadedOnce).toBe(false)

    await act(async () => {
      manager.settle('tab-1')
    })
    expect(workspace.result.current.hasLoadedOnce).toBe(true)
    expect(lastSync()?.visible).toBe(true)
    const workspaceGeneration = generationOf()

    // Workspace unmounts for the focus overlay. That is a *host* event: the
    // conversation has to keep running.
    workspace.unmount()
    await flush()
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    expect(manager.liveCount()).toBe(1)

    // Focus host mounts a brand new controller for the same view.
    const focus = await mount()

    // Bootstrap, not luck: the new host learned the guest had already painted
    // from the snapshot, and the native view is on screen without ever waiting
    // for another did-stop-loading.
    expect(aiViewClient.attach).toHaveBeenCalledTimes(2)
    expect(focus.result.current.hasLoadedOnce).toBe(true)
    expect(focus.result.current.isLoading).toBe(false)
    expect(lastSync()?.visible).toBe(true)

    // Same WebContents, same conversation, no reload and no new entry load.
    expect(manager.liveCount()).toBe(1)
    expect(generationOf()).toBe(workspaceGeneration)
    expect(aiViewClient.reload).not.toHaveBeenCalled()
    expect(aiViewClient.loadUrl).not.toHaveBeenCalled()
  })

  it('hands the conversation URL to the new controller, not the entry URL', async () => {
    const workspace = await mount()
    await act(async () => {
      manager.settle('tab-1')
      manager.navigate('tab-1', 'https://chatgpt.com/c/abc-123')
    })
    workspace.unmount()
    await flush()

    const focus = await mount()

    expect(focus.result.current.controller.getURL?.()).toBe('https://chatgpt.com/c/abc-123')
    expect(aiViewClient.loadUrl).not.toHaveBeenCalled()
    expect(aiViewClient.reload).not.toHaveBeenCalled()
  })

  it('keeps an existing still-loading view hidden until the real load settles', async () => {
    // The workspace host unmounts before the entry load finishes.
    const workspace = await mount()
    expect(lastSync()?.visible).toBe(false)
    workspace.unmount()
    await flush()

    const focus = await mount()

    // The snapshot says the guest is still loading, so the new host must not
    // declare itself ready to display it — reporting `hasLoadedOnce` here is
    // exactly the premature reveal this test guards.
    expect(focus.result.current.hasLoadedOnce).toBe(false)
    expect(focus.result.current.isLoading).toBe(true)
    expect(lastSync()?.visible).toBe(false)
    expect(manager.liveCount()).toBe(1)

    await act(async () => {
      manager.settle('tab-1')
    })
    expect(focus.result.current.hasLoadedOnce).toBe(true)
    expect(lastSync()?.visible).toBe(true)
  })

  it('never brings the splash back for a navigation inside an already-loaded view', async () => {
    const workspace = await mount()
    await act(async () => {
      manager.settle('tab-1')
    })
    workspace.unmount()
    await flush()

    const focus = await mount()
    await act(async () => {
      manager.navigate('tab-1', 'https://chatgpt.com/c/next')
    })

    expect(focus.result.current.isLoading).toBe(false)
    expect(lastSync()?.visible).toBe(true)
  })

  it('leaves the current page on screen while the same view starts another load', async () => {
    // The distinction that makes a generation change safe: this snapshot also
    // says `isLoading`, but it comes from the WebContents the user is already
    // looking at, so the painted page stays and the splash does not return.
    const workspace = await mount()
    await act(async () => {
      manager.settle('tab-1')
    })
    const generation = generationOf()
    workspace.unmount()
    await flush()

    const focus = await mount()
    expect(generationOf()).toBe(generation)

    await act(async () => {
      manager.renavigate('tab-1', 'https://chatgpt.com/c/next')
    })

    expect(focus.result.current.hasLoadedOnce).toBe(true)
    expect(focus.result.current.isLoading).toBe(false)
    expect(lastSync()?.visible).toBe(true)
    expect(generationOf()).toBe(generation)
  })
})
