import AiSession from '@features/ai/ui/AiSession'

import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewEvent } from '@shared-core/types/aiView'

import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sleep / wake across a real `WebContentsView`.
 *
 * The fake client below is a one-field model of `AiWebContentsViewManager`: a
 * view exists or it does not, and destroying it closes the `WebContents`. That is
 * enough to pin the invariants this scenario is about — a sleeping tab must not
 * look ready to the send / picker pipelines, waking must bring the same
 * conversation back on a brand new view, and the brand new view must not inherit
 * the revealed state of the one it replaced.
 *
 * Attach and destroy go through a per-view chain, because that is what the
 * manager does: a destroy issued while an attach is still resolving its target has
 * to run after it, or the tab it belongs to is left with an orphan WebContents.
 *
 * `settle` mirrors `aiViewEventBridge`: a load transition both updates the
 * manager's mirror (which is republished as a `state` snapshot) and delivers the
 * raw lifecycle event. A wake therefore arrives as a snapshot that says the
 * replacement view has painted nothing yet, which is what the host has to obey.
 */

const manager = vi.hoisted(() => {
  const views = new Map<string, { generation: number; closed: boolean }>()
  const eventHandlers = new Set<(event: unknown) => void>()
  let counter = 0
  let tail: Promise<unknown> = Promise.resolve()
  let holdDestroy: (() => void) | null = null
  let destroyHeld = false

  function enqueue<T>(run: () => T | Promise<T>): Promise<T> {
    const settled = tail.then(run, run)
    tail = settled.then(
      () => undefined,
      () => undefined
    )
    return settled
  }

  const attach = (viewId: string) =>
    enqueue(() => {
      const existing = views.get(viewId)
      if (existing && !existing.closed) {
        // A focus-mode handoff shape: the view is already settled, so the new
        // host is told so instead of waiting for another did-stop-loading.
        return {
          generation: existing.generation,
          currentUrl: 'https://chatgpt.com/',
          isLoading: false,
          hasLoadedOnce: true,
          loadState: 'settled',
          error: null,
          created: false
        }
      }
      counter += 1
      views.set(viewId, { generation: counter, closed: false })
      return {
        generation: counter,
        currentUrl: 'https://chatgpt.com/',
        isLoading: true,
        hasLoadedOnce: false,
        loadState: 'loading',
        error: null,
        created: true
      }
    })

  const destroy = (viewId: string) =>
    enqueue(async () => {
      if (destroyHeld) {
        await new Promise<void>((resolve) => {
          holdDestroy = resolve
        })
      }
      const view = views.get(viewId)
      if (!view || view.closed) return false
      view.closed = true
      views.delete(viewId)
      return true
    })

  return {
    views,
    liveCount: () => [...views.values()].filter((view) => !view.closed).length,
    closedCount: () => [...views.values()].filter((view) => view.closed).length,
    attach,
    destroy,
    /** Holds the next destroy so a wake can overtake it. */
    holdNextDestroy: () => {
      destroyHeld = true
      holdDestroy = null
    },
    releaseDestroy: () => {
      destroyHeld = false
      holdDestroy?.()
      holdDestroy = null
    },
    reset: () => {
      views.clear()
      counter = 0
      destroyHeld = false
      holdDestroy = null
    },
    emit: (event: AiViewEvent) => {
      for (const handler of eventHandlers) handler(event)
    }
  }
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

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({ aiView: aiViewClient })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  reportSuppressedError: vi.fn()
}))

const lifecycleSettings = vi.hoisted(() => ({ sleepTimeoutMs: 10, neverSleep: false }))
vi.mock('@features/ai/hooks/useAiLifecycleSettings', () => ({
  useAiLifecycleSettings: () => ({
    sleepTimeoutMs: lifecycleSettings.sleepTimeoutMs,
    isNeverSleepSite: () => lifecycleSettings.neverSleep
  })
}))

const registerContent = vi.hoisted(() => vi.fn())
vi.mock('@app/providers/ai-context', () => ({
  useAiRegistryMeta: () => ({ isRegistryLoaded: true, chromeUserAgent: 'ua' }),
  useAiSites: () => ({
    chatgpt: { url: 'https://chatgpt.com/', displayName: 'ChatGPT' }
  }),
  useAiContentHostActions: () => ({ registerContent })
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showWarning: vi.fn(), showError: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@ui/components/AestheticLoader', () => ({
  default: () => <div data-testid="loader" />
}))

vi.mock('@features/ai/ui/SleepPlaceholderView', () => ({
  default: ({ onWakeUp }: { onWakeUp: () => void }) => (
    <button type="button" data-testid="wake-up" onClick={onWakeUp}>
      wake
    </button>
  )
}))

const tab = { id: 'tab-1', modelId: 'chatgpt', title: 'ChatGPT' }

const currentController = (): AiContentController | null => {
  // `registerContent` is the registry-shaped action: (tabId, controller, expected).
  const live = registerContent.mock.calls
    .map((call) => call[1] as AiContentController | null | undefined)
    .filter((value): value is AiContentController => Boolean(value))
  return live.at(-1) ?? null
}

const subscribers = new Set<(event: AiViewEvent) => void>()

/** The last geometry + visibility message the host placeholder published. */
const lastSync = () =>
  aiViewClient.syncHost.mock.calls.at(-1)?.[0] as { visible: boolean } | undefined

/**
 * Chromium finishing the entry load of the live view for `viewId`.
 *
 * Mirrors `aiViewEventBridge`: the transition updates the manager's mirror — which
 * it republishes as a `state` snapshot — and delivers the raw lifecycle event, so
 * both reach the host exactly as they would in production.
 */
const settle = (viewId: string, currentUrl = 'https://chatgpt.com/') => {
  const generation = manager.views.get(viewId)?.generation
  if (generation === undefined) return
  for (const subscriber of subscribers) {
    subscriber({
      viewId,
      generation,
      kind: 'state',
      currentUrl,
      isLoading: false,
      hasLoadedOnce: true,
      loadState: 'settled',
      error: null
    })
    subscriber({ viewId, generation, kind: 'did-stop-loading', currentUrl })
  }
}

describe('AiSession sleep / wake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribers.clear()
    manager.reset()
    lifecycleSettings.sleepTimeoutMs = 10
    lifecycleSettings.neverSleep = false
    aiViewClient.attach.mockImplementation(async ({ viewId }: { viewId: string }) =>
      manager.attach(viewId)
    )
    aiViewClient.destroy.mockImplementation(async ({ viewId }: { viewId: string }) =>
      manager.destroy(viewId)
    )
    aiViewClient.executeScript.mockResolvedValue('complete')
    aiViewClient.detach.mockResolvedValue(true)
    aiViewClient.syncHost.mockReturnValue(undefined)
    aiViewClient.onEvent.mockImplementation((handler: (event: unknown) => void) => {
      // The shared client fans one ipcRenderer subscription out to every
      // controller; mirror that so the test drives the same path.
      const wrapped = handler as (event: AiViewEvent) => void
      subscribers.add(wrapped)
      return () => {
        subscribers.delete(wrapped)
      }
    })
  })

  it('destroys the view on sleep and re-creates it with the cached url on wake', async () => {
    const view = render(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)

    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })
    const firstGeneration = manager.views.get('tab-1')?.generation

    // The guest settles on a conversation, which the panel caches for the wake.
    act(() => {
      for (const subscriber of subscribers) {
        subscriber({
          viewId: 'tab-1',
          generation: firstGeneration ?? 0,
          kind: 'did-navigate',
          url: 'https://chatgpt.com/c/keep',
          isMainFrame: true
        })
        subscriber({
          viewId: 'tab-1',
          generation: firstGeneration ?? 0,
          kind: 'did-stop-loading',
          currentUrl: 'https://chatgpt.com/c/keep'
        })
      }
    })

    // Going inactive arms the sleep timer.
    view.rerender(<AiSession tab={tab} isActive={false} isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(screen.getByTestId('wake-up')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(manager.liveCount()).toBe(0)
    })
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })

    act(() => {
      screen.getByTestId('wake-up').click()
    })

    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })
    const secondGeneration = manager.views.get('tab-1')?.generation
    expect(secondGeneration).not.toBe(firstGeneration)
    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewId: 'tab-1' })
    )
  })

  it('reports a sleeping tab as not ready, so automation refuses it', async () => {
    const view = render(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)

    await waitFor(() => {
      expect(currentController()?.isReady?.()).toBe(true)
    })

    view.rerender(<AiSession tab={tab} isActive={false} isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(screen.getByTestId('wake-up')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(manager.liveCount()).toBe(0)
    })
    // The registry entry survives the sleep (the React host is still mounted), so
    // this is exactly the case where a stale mirror would let the send pipeline
    // inject into a WebContents that no longer exists.
    const controller = currentController()
    expect(controller?.isReady?.()).toBe(false)
    expect(controller?.isDestroyed?.()).toBe(true)
    await expect(controller?.executeJavaScript('1')).resolves.toBeUndefined()
    expect(aiViewClient.executeScript).not.toHaveBeenCalled()
  })

  it('never sleeps a site the user excluded', async () => {
    lifecycleSettings.neverSleep = true
    render(<AiSession tab={tab} isActive={false} isSurfaceActive isOverlayActive={false} />)

    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(manager.liveCount()).toBe(1)
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('survives a sleep whose destroy is overtaken by an immediate wake', async () => {
    // active -> inactive -> sleep (destroy issued) -> active again, with the
    // destroy round trip still in the air when the wake's attach is sent.
    const view = render(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })
    const firstGeneration = manager.views.get('tab-1')?.generation

    // Gen 1 reveals itself first, so the wake below starts from a host that
    // genuinely believes its view is on screen.
    act(() => {
      settle('tab-1')
    })
    await waitFor(() => {
      expect(lastSync()?.visible).toBe(true)
    })

    manager.holdNextDestroy()
    view.rerender(<AiSession tab={tab} isActive={false} isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(screen.getByTestId('wake-up')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })
    })

    // The user comes straight back, so the wake's attach is queued behind the
    // destroy that main has not finished yet.
    view.rerender(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)
    await act(async () => {
      manager.releaseDestroy()
    })

    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })

    // Exactly one live view, and it is the wake's, with the readiness the panel
    // reports to the send pipeline. No second view, no half-closed orphan.
    expect([...manager.views.keys()]).toEqual(['tab-1'])
    const live = manager.views.get('tab-1')!
    expect(live.closed).toBe(false)
    expect(live.generation).not.toBe(firstGeneration)
    await waitFor(() => {
      expect(currentController()?.isReady?.()).toBe(true)
    })
    expect(currentController()?.isDestroyed?.()).toBe(false)
    expect(currentController()?.isLoading?.()).toBe(true)

    // A live controller whose view has painted nothing must not be treated as
    // revealed: the wake's snapshot has not settled yet, so the native view stays
    // hidden and the splash is back. Asserting only `isLoading()` would pass even
    // with the reveal already leaked into React state.
    await waitFor(() => {
      expect(lastSync()?.visible).toBe(false)
    })
    expect(screen.getByTestId('loader')).toBeInTheDocument()

    act(() => {
      settle('tab-1')
    })
    await waitFor(() => {
      expect(lastSync()?.visible).toBe(true)
    })
    expect(screen.queryByTestId('loader')).toBeNull()
  })

  it('keeps the replacement view behind the splash until it has painted', async () => {
    const view = render(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })
    const firstGeneration = manager.views.get('tab-1')?.generation

    // The first generation paints a conversation, which is what the panel caches
    // for the wake and what `revealAfterFirstLoad` revealed.
    act(() => {
      settle('tab-1', 'https://chatgpt.com/c/keep')
    })
    await waitFor(() => {
      expect(lastSync()?.visible).toBe(true)
    })
    expect(screen.queryByTestId('loader')).toBeNull()

    view.rerender(<AiSession tab={tab} isActive={false} isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(manager.liveCount()).toBe(0)
    })

    act(() => {
      screen.getByTestId('wake-up').click()
    })
    // The user is back on the tab, so the wake is not immediately undone by the
    // sleep timer that an inactive tab re-arms.
    view.rerender(<AiSession tab={tab} isActive isSurfaceActive isOverlayActive={false} />)
    await waitFor(() => {
      expect(manager.liveCount()).toBe(1)
    })

    // A brand new WebContents: the manager is right and says it is still loading
    // with `hasLoadedOnce: false`.
    const secondGeneration = manager.views.get('tab-1')?.generation
    expect(secondGeneration).not.toBe(firstGeneration)
    expect(lastSync()?.visible).toBe(false)
    expect(screen.getByTestId('loader')).toBeInTheDocument()
    expect(currentController()?.isLoading?.()).toBe(true)

    // Only its own load may reveal it.
    act(() => {
      settle('tab-1', 'https://chatgpt.com/c/keep')
    })
    await waitFor(() => {
      expect(lastSync()?.visible).toBe(true)
    })
    expect(screen.queryByTestId('loader')).toBeNull()
  })
})
