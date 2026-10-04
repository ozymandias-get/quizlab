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
