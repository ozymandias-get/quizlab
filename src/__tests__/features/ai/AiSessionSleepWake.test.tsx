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
 * enough to pin the two invariants this scenario is about — a sleeping tab must
 * not look ready to the send / picker pipelines, and waking must bring the same
 * conversation back on a brand new view.
 */

const manager = vi.hoisted(() => {
  const views = new Map<string, { generation: number }>()
  const eventHandlers = new Set<(event: unknown) => void>()
  let counter = 0
  return {
    views,
    liveCount: () => views.size,
    attach: (viewId: string) => {
      const existing = views.get(viewId)
      if (existing) return { generation: existing.generation, created: false }
      counter += 1
      views.set(viewId, { generation: counter })
      return { generation: counter, created: true }
    },
    destroy: (viewId: string) => views.delete(viewId),
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

describe('AiSession sleep / wake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribers.clear()
    manager.views.clear()
    lifecycleSettings.sleepTimeoutMs = 10
    lifecycleSettings.neverSleep = false
    aiViewClient.attach.mockImplementation(async ({ viewId }: { viewId: string }) => ({
      ...manager.attach(viewId),
      currentUrl: 'https://chatgpt.com/'
    }))
    aiViewClient.destroy.mockImplementation(async ({ viewId }: { viewId: string }) => {
      manager.destroy(viewId)
      return true
    })
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
})
