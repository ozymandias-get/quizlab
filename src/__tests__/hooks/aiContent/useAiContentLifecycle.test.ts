import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewEventKind, AiViewEventOf } from '@shared-core/types/aiView'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { useAiContentLifecycle } = await import('@shared/hooks/aiContent/useAiContentLifecycle')

const mockLogger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@shared/lib/logger', () => ({
  Logger: mockLogger,
  reportSuppressedError: vi.fn()
}))

interface MockController extends AiContentController {
  _emit: <K extends AiViewEventKind>(kind: K, payload?: Partial<AiViewEventOf<K>>) => void
  _subscriberCount: () => number
}

function createController(overrides: Partial<AiContentController> = {}): MockController {
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const controller: MockController = {
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    subscribeEvent: (<K extends AiViewEventKind>(
      kind: K,
      handler: (event: AiViewEventOf<K>) => void
    ) => {
      const set = listeners.get(kind) ?? new Set()
      set.add(handler as (event: unknown) => void)
      listeners.set(kind, set)
      return () => {
        set.delete(handler as (event: unknown) => void)
      }
    }) as AiContentController['subscribeEvent'],
    _emit: (kind, payload) => {
      const event = { viewId: 'tab-1', generation: 1, kind, ...(payload ?? {}) }
      for (const handler of listeners.get(kind) ?? []) handler(event)
    },
    _subscriberCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
  }
  return { ...controller, ...overrides } as MockController
}

const render = (controller: AiContentController | null, overrides = {}) =>
  renderHook(() =>
    useAiContentLifecycle({
      currentAI: 'chatgpt',
      controller,
      t: (key: string) => key,
      showWarning: vi.fn(),
      ...overrides
    })
  )

describe('useAiContentLifecycle - loading and splash', () => {
  it('starts in the loading state and hides the native view until the first load', () => {
    const controller = createController()
    const { result } = render(controller)

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)

    act(() => {
      controller._emit('did-stop-loading', { currentUrl: 'https://x.test/' })
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
  })

  it('does not re-show the splash for in-page navigations', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('did-stop-loading', { currentUrl: 'https://x.test/' })
    })
    act(() => {
      controller._emit('did-start-loading', { currentUrl: 'https://x.test/c/1' })
    })

    // The splash stays down and the native view stays revealed, so an SPA
    // navigation never blanks the panel.
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('reports the url on dom-ready and on both navigation events', () => {
    const controller = createController()
    const onUrlChange = vi.fn()
    render(controller, { onUrlChange })

    act(() => {
      controller._emit('dom-ready', { currentUrl: 'https://x.test/' })
    })
    act(() => {
      controller._emit('did-navigate', { url: 'https://x.test/c/1', isMainFrame: true })
    })
    act(() => {
      controller._emit('did-navigate-in-page', { url: 'https://x.test/c/1?x=2', isMainFrame: true })
    })

    expect(onUrlChange.mock.calls.map(([url]) => url)).toEqual([
      'https://x.test/',
      'https://x.test/c/1',
      'https://x.test/c/1?x=2'
    ])
  })

  it('aborts pending automation on every navigation', () => {
    const controller = createController()
    render(controller)

    act(() => {
      controller._emit('did-navigate', { url: 'https://x.test/c/1', isMainFrame: true })
    })
    expect(controller.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('__quizlabAbortController')
    )

    act(() => {
      controller._emit('did-navigate-in-page', { url: 'https://x.test/c/1?x=2', isMainFrame: true })
    })
    expect(controller.executeJavaScript).toHaveBeenCalledTimes(2)
  })

  it('invokes the page-settled callback with the controller', () => {
    const controller = createController()
    const onPageSettled = vi.fn()
    render(controller, { onPageSettled })

    act(() => {
      controller._emit('did-stop-loading', { currentUrl: 'https://x.test/' })
    })
    expect(onPageSettled).toHaveBeenCalledWith(controller)
  })
})

describe('useAiContentLifecycle - error state', () => {
  it('surfaces a real load failure', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('did-fail-load', {
        errorCode: -6,
        errorDescription: 'FILE_NOT_FOUND',
        currentUrl: 'https://x.test/'
      })
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('FILE_NOT_FOUND')
  })

  it('falls back to a translated message when the page gives none', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('did-fail-load', {
        errorCode: -6,
        errorDescription: '',
        currentUrl: 'https://x.test/'
      })
    })
    expect(result.current.error).toBe('page_load_failed')
  })

  it('treats aborted and offline codes as transient', () => {
    const controller = createController()
    const { result } = render(controller)

    for (const errorCode of [-3, -2, -100, -101, -102, -103, -104]) {
      act(() => {
        controller._emit('did-fail-load', {
          errorCode,
          errorDescription: 'transient',
          currentUrl: 'https://x.test/'
        })
      })
      expect(result.current.error).toBeNull()
    }
  })

  it('clears a previous error when a new load starts', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('did-fail-load', {
        errorCode: -6,
        errorDescription: 'boom',
        currentUrl: 'https://x.test/'
      })
    })
    expect(result.current.error).toBe('boom')

    act(() => {
      controller._emit('did-start-loading', { currentUrl: 'https://x.test/' })
    })
    expect(result.current.error).toBeNull()
  })
})

describe('useAiContentLifecycle - crash recovery', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries a crash a bounded number of times, then gives up with a warning', () => {
    vi.useFakeTimers()
    const controller = createController()
    const showWarning = vi.fn()
    const onCrashRecoveryRequested = vi.fn()
    const { result } = render(controller, { showWarning, onCrashRecoveryRequested })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        controller._emit('render-process-gone', { reason: 'crashed', exitCode: 9 })
      })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(onCrashRecoveryRequested).toHaveBeenCalledTimes(3)
    expect(showWarning).toHaveBeenCalledTimes(3)
    expect(result.current.error).toBeNull()

    act(() => {
      controller._emit('render-process-gone', { reason: 'crashed', exitCode: 9 })
    })
    expect(result.current.error).toBe('webview_crashed_max')
    expect(onCrashRecoveryRequested).toHaveBeenCalledTimes(3)
  })

  it('ignores clean exits and kills', () => {
    vi.useFakeTimers()
    const controller = createController()
    const onCrashRecoveryRequested = vi.fn()
    const { result } = render(controller, { onCrashRecoveryRequested })

    for (const reason of ['clean-exit', 'killed']) {
      act(() => {
        controller._emit('render-process-gone', { reason, exitCode: 0 })
      })
    }
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(onCrashRecoveryRequested).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('does not recover a tab the user already switched away from', () => {
    vi.useFakeTimers()
    const first = createController()
    const onCrashRecoveryRequested = vi.fn()
    const { rerender } = renderHook(
      ({ controller }: { controller: AiContentController | null }) =>
        useAiContentLifecycle({
          currentAI: 'chatgpt',
          controller,
          t: (key: string) => key,
          showWarning: vi.fn(),
          onCrashRecoveryRequested
        }),
      { initialProps: { controller: first as AiContentController | null } }
    )

    act(() => {
      first._emit('render-process-gone', { reason: 'crashed', exitCode: 9 })
    })

    const second = createController()
    act(() => {
      rerender({ controller: second })
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(onCrashRecoveryRequested).not.toHaveBeenCalled()
  })

  it('resets the retry budget when the model changes', () => {
    vi.useFakeTimers()
    const controller = createController()
    const onCrashRecoveryRequested = vi.fn()
    const { rerender } = renderHook(
      ({ currentAI }: { currentAI: string }) =>
        useAiContentLifecycle({
          currentAI,
          controller,
          t: (key: string) => key,
          showWarning: vi.fn(),
          onCrashRecoveryRequested
        }),
      { initialProps: { currentAI: 'chatgpt' } }
    )

    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => {
        controller._emit('render-process-gone', { reason: 'crashed', exitCode: 9 })
      })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    act(() => {
      rerender({ currentAI: 'claude' })
    })
    act(() => {
      controller._emit('render-process-gone', { reason: 'crashed', exitCode: 9 })
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onCrashRecoveryRequested).toHaveBeenCalledTimes(4)
  })

  it('prefers a full remount over a plain reload on retry', () => {
    const controller = createController({
      reload: vi.fn()
    } as Partial<AiContentController>)
    const onCrashRecoveryRequested = vi.fn()
    const { result } = render(controller, { onCrashRecoveryRequested })

    act(() => {
      result.current.handleRetry()
    })

    expect(onCrashRecoveryRequested).toHaveBeenCalledTimes(1)
    expect(controller.reload).not.toHaveBeenCalled()
  })

  it('falls back to reload when no remount handler is wired', () => {
    const reload = vi.fn()
    const controller = createController({ reload } as Partial<AiContentController>)
    const { result } = render(controller)

    act(() => {
      result.current.handleRetry()
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('useAiContentLifecycle - registry', () => {
  it('publishes the controller and retracts exactly its own instance', () => {
    const controller = createController()
    const registerContent = vi.fn()
    const { unmount } = render(controller, { registerContent })

    expect(registerContent).toHaveBeenCalledWith(controller)

    unmount()
    expect(registerContent).toHaveBeenLastCalledWith(null, controller)
  })

  it('detaches every event listener on unmount', () => {
    const controller = createController()
    const { unmount } = render(controller)
    expect(controller._subscriberCount()).toBeGreaterThan(0)

    unmount()
    expect(controller._subscriberCount()).toBe(0)
  })

  it('tolerates a missing controller', () => {
    expect(() => render(null)).not.toThrow()
  })
})

describe('useAiContentLifecycle - bootstrap from the manager snapshot', () => {
  const snapshot = (overrides: Record<string, unknown> = {}) => ({
    currentUrl: 'https://chatgpt.com/c/abc',
    isLoading: false,
    hasLoadedOnce: true,
    loadState: 'settled',
    error: null,
    ...overrides
  })

  it('reveals an existing settled view without waiting for a load event', () => {
    // The focus-mode shape. No `did-stop-loading` follows this, so if the
    // snapshot were ignored the splash would never leave.
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', snapshot() as never)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('keeps an existing still-loading view behind the splash', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit(
        'state',
        snapshot({
          currentUrl: 'https://chatgpt.com/',
          isLoading: true,
          hasLoadedOnce: false,
          loadState: 'loading'
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)
  })

  it('shows the last failure of an existing view instead of an endless splash', () => {
    const controller = createController()
    const { result } = render(controller)

    // The failure was recorded while the previous host held the view; the load
    // itself had already settled, so this host must not start the splash at all.
    act(() => {
      controller._emit(
        'state',
        snapshot({
          loadState: 'failed',
          error: { code: -105, description: 'ERR_NAME_NOT_RESOLVED' }
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.error).toBe('ERR_NAME_NOT_RESOLVED')
  })

  it('keeps waiting when a failure is recorded mid-navigation', () => {
    // An aborted redirect hop reports a failure while the real document is still
    // on its way. Settling here would reveal the view on a blank page and skip
    // the settled-callback for the page that actually arrives.
    const controller = createController()
    const onPageSettled = vi.fn()
    const { result } = render(controller, { onPageSettled })

    act(() => {
      controller._emit(
        'state',
        snapshot({
          isLoading: true,
          hasLoadedOnce: false,
          loadState: 'loading',
          error: { code: -3, description: 'ERR_ABORTED' }
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)
    expect(result.current.error).toBeNull()
    expect(onPageSettled).not.toHaveBeenCalled()

    // The navigation completes, which is what finally settles it.
    act(() => {
      controller._emit('state', snapshot({ currentUrl: 'https://chatgpt.com/c/real' }) as never)
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(onPageSettled).toHaveBeenCalledTimes(1)
  })

  it('does not run the settled-callback for a view that never produced a document', () => {
    const controller = createController()
    const onPageSettled = vi.fn()
    const { result } = render(controller, { onPageSettled })

    act(() => {
      controller._emit(
        'state',
        snapshot({
          loadState: 'failed',
          error: { code: -6, description: 'ERR_FILE_NOT_FOUND' }
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.error).toBe('ERR_FILE_NOT_FOUND')
    expect(onPageSettled).not.toHaveBeenCalled()
  })

  it('settles a transient failure without surfacing an error', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit(
        'state',
        snapshot({
          loadState: 'failed',
          error: { code: -3, description: 'ERR_ABORTED' }
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('does not bring the splash back when the snapshot reports a re-navigation', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', snapshot() as never)
    })
    expect(result.current.hasLoadedOnce).toBe(true)

    act(() => {
      controller._emit(
        'state',
        snapshot({
          currentUrl: 'https://chatgpt.com/c/next',
          isLoading: true,
          hasLoadedOnce: true,
          loadState: 'loading'
        }) as never
      )
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
  })

  it('reports the conversation url from the snapshot', () => {
    const controller = createController()
    const onUrlChange = vi.fn()
    render(controller, { onUrlChange })

    act(() => {
      controller._emit('state', snapshot() as never)
    })

    expect(onUrlChange).toHaveBeenCalledWith('https://chatgpt.com/c/abc')
  })

  it('treats a snapshot from an older preload as still loading', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', { currentUrl: 'https://chatgpt.com/' } as never)
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)
  })

  it('still bootstraps from a settled snapshot that carries no generation', () => {
    // A preload that predates the generation field must not be mistaken for a
    // view change: there is no identity to compare, so the existing bootstrap
    // has to keep working.
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', {
        currentUrl: 'https://chatgpt.com/',
        isLoading: false,
        hasLoadedOnce: true,
        loadState: 'settled',
        error: null
      } as never)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
  })
})

/**
 * `generation` is the identity of the concrete `WebContentsView` a snapshot came
 * from, and it is the only thing that changes when the manager *replaces* the
 * view instead of continuing to drive it: a sleep, a wake and a crash recovery
 * each build a new one. The host placeholder stays mounted across all of them, so
 * without reading the generation the previous view's first-load state leaks into
 * its replacement.
 */
describe('useAiContentLifecycle - WebContents generation changes', () => {
  const settled = (generation: number, currentUrl = 'https://chatgpt.com/c/abc') => ({
    generation,
    currentUrl,
    isLoading: false,
    hasLoadedOnce: true,
    loadState: 'settled',
    error: null
  })

  const startingFresh = (generation: number, currentUrl = 'https://chatgpt.com/') => ({
    generation,
    currentUrl,
    isLoading: true,
    hasLoadedOnce: false,
    loadState: 'loading',
    error: null
  })

  it("drops the previous view's revealed state when a new WebContents appears", () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', settled(10) as never)
    })
    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.isLoading).toBe(false)

    // Generation 11 is a brand new WebContents: it has painted nothing yet, so
    // the splash has to come back and the native view must not be revealed.
    act(() => {
      controller._emit('state', startingFresh(11) as never)
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)
  })

  it('reveals the replacement view once its own first load settles', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', settled(10) as never)
      controller._emit('state', startingFresh(11) as never)
    })
    expect(result.current.hasLoadedOnce).toBe(false)

    act(() => {
      controller._emit('did-stop-loading', {
        generation: 11,
        currentUrl: 'https://chatgpt.com/c/fresh'
      })
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLoadedOnce).toBe(true)
  })

  it('keeps hasLoadedOnce monotonic while the generation does not change', () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', settled(10) as never)
    })

    // Same WebContents, second navigation: main mirrors this as isLoading with
    // hasLoadedOnce still true, and the panel must not blank out for it.
    act(() => {
      controller._emit('state', {
        generation: 10,
        currentUrl: 'https://chatgpt.com/c/2',
        isLoading: true,
        hasLoadedOnce: true,
        loadState: 'loading',
        error: null
      } as never)
    })

    expect(result.current.hasLoadedOnce).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('does not re-run the settled callback for a view that is still loading', () => {
    const controller = createController()
    const onPageSettled = vi.fn()
    const { result } = render(controller, { onPageSettled })

    act(() => {
      controller._emit('did-stop-loading', { generation: 10, currentUrl: 'https://x.test/' })
    })
    expect(onPageSettled).toHaveBeenCalledTimes(1)

    act(() => {
      controller._emit('state', startingFresh(11) as never)
    })

    // Nothing to inspect in a guest that has not painted yet, so the stale-check
    // callback must not run against the wrong document.
    expect(result.current.hasLoadedOnce).toBe(false)
    expect(onPageSettled).toHaveBeenCalledTimes(1)
  })

  it("clears the previous view's error when its replacement reports in", () => {
    const controller = createController()
    const { result } = render(controller)

    act(() => {
      controller._emit('state', {
        generation: 10,
        currentUrl: 'https://chatgpt.com/',
        isLoading: false,
        hasLoadedOnce: true,
        loadState: 'failed',
        error: { code: -105, description: 'ERR_NAME_NOT_RESOLVED' }
      } as never)
    })
    expect(result.current.error).toBe('ERR_NAME_NOT_RESOLVED')

    act(() => {
      controller._emit('state', startingFresh(11) as never)
    })

    // The failure belonged to the destroyed view; the new one is still loading.
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasLoadedOnce).toBe(false)
  })

  it("reports the replacement view's url rather than the destroyed one", () => {
    const controller = createController()
    const onUrlChange = vi.fn()
    render(controller, { onUrlChange })

    act(() => {
      controller._emit('state', settled(10, 'https://chatgpt.com/c/gone') as never)
      controller._emit('state', startingFresh(11, 'https://chatgpt.com/') as never)
    })

    expect(onUrlChange).toHaveBeenLastCalledWith('https://chatgpt.com/')
  })
})
