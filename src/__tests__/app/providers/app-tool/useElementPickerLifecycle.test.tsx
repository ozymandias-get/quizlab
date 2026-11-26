import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewEventKind, AiViewEventOf } from '@shared-core/types/aiView'

import { useElementPickerLifecycle } from '@app/providers/app-tool/useElementPickerLifecycle'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStartPicker = vi.fn()
const mockStopPicker = vi.fn()
// Mutable so individual cases can present an already-running picker.
const mockPickerState = { active: false }

vi.mock('@features/automation', () => ({
  useElementPicker: () => ({
    isPickerActive: mockPickerState.active,
    startPicker: mockStartPicker,
    stopPicker: mockStopPicker,
    togglePicker: vi.fn()
  })
}))

interface MockController extends AiContentController {
  _trigger: <K extends AiViewEventKind>(kind: K, payload?: Partial<AiViewEventOf<K>>) => void
  _unsubscribeCount: () => number
  _setReady: (ready: boolean) => void
}

function createController(overrides: Partial<AiContentController> = {}): MockController {
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const readyListeners = new Set<(ready: boolean) => void>()
  // A view main has not confirmed yet reports itself as not ready.
  let ready = !('isReady' in overrides)

  const controller: MockController = {
    executeJavaScript: vi.fn().mockResolvedValue('loading'),
    isDestroyed: () => !ready,
    isReady: () => ready,
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
    subscribeReady: (listener) => {
      readyListeners.add(listener)
      listener(ready)
      return () => {
        readyListeners.delete(listener)
      }
    },
    _trigger: (kind, payload) => {
      const event = { viewId: 'tab-1', generation: 1, kind, ...(payload ?? {}) }
      listeners.get(kind)?.forEach((handler) => handler(event))
    },
    _unsubscribeCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    _setReady: (next) => {
      ready = next
      readyListeners.forEach((listener) => listener(next))
    }
  }

  controller._setReady(true)

  return { ...controller, ...overrides } as MockController
}

describe('useElementPickerLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPickerState.active = false
    mockStartPicker.mockResolvedValue(undefined)
    mockStopPicker.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts picker immediately when catch-up sees an interactive document', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    })

    const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await vi.waitFor(() => {
      expect(mockStartPicker).toHaveBeenCalledTimes(1)
    })
  })

  // Catch-up hâlâ 'loading' derken hazır olma iki olaydan gelir ve ikisi de
  // aynı davranışı gösterir: olay gelene kadar picker başlamaz, gelir gelmez
  // bir kez başlar.
  it.each(['did-stop-loading', 'dom-ready'] as const)(
    'waits for %s instead of polling readyState in a loop',
    async (event) => {
      const controller = createController({
        executeJavaScript: vi.fn().mockResolvedValue('loading')
      })

      const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

      await act(async () => {
        result.current.startPickerWhenReady()
      })

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockStartPicker).not.toHaveBeenCalled()

      await act(async () => {
        controller._trigger(event)
      })

      expect(mockStartPicker).toHaveBeenCalledTimes(1)
    }
  )

  it('does not start picker on a previous content after the active instance changes', async () => {
    const controllerA = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const controllerB = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result, rerender } = renderHook(
      ({ controller }: { controller: AiContentController | null }) =>
        useElementPickerLifecycle(() => controller),
      { initialProps: { controller: controllerA as AiContentController | null } }
    )

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      rerender({ controller: controllerB })
    })

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      controllerA._trigger('did-stop-loading')
    })

    expect(mockStartPicker).not.toHaveBeenCalled()

    await act(async () => {
      controllerB._trigger('did-stop-loading')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('does not start picker after unmount', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result, unmount } = renderHook(() => useElementPickerLifecycle(() => controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    await act(async () => {
      controller._trigger('did-stop-loading')
    })

    expect(mockStartPicker).not.toHaveBeenCalled()
  })

  it('removes event listeners on cleanup', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result, unmount } = renderHook(() => useElementPickerLifecycle(() => controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await vi.waitFor(() => {
      expect(controller._unsubscribeCount()).toBeGreaterThan(0)
    })

    const before = controller._unsubscribeCount()
    unmount()

    expect(controller._unsubscribeCount()).toBeLessThan(before)
  })

  it('cancels the pending request when the managed view reports it is gone', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading'),
      isDestroyed: () => true
    })

    const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockStartPicker).not.toHaveBeenCalled()
  })

  it('injects exactly one session when readiness signals and arm calls race', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

    // Double click / two callers arming in the same tick.
    await act(async () => {
      result.current.startPickerWhenReady()
      result.current.startPickerWhenReady()
    })
    await act(async () => {
      await Promise.resolve()
    })

    // dom-ready and did-stop-loading can land back to back for one load.
    await act(async () => {
      controller._trigger('dom-ready')
      controller._trigger('did-stop-loading')
    })

    await vi.waitFor(() => {
      expect(mockStartPicker).toHaveBeenCalledTimes(1)
    })
    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('stops an active picker when the user switches tabs', async () => {
    mockPickerState.active = true
    const controllerA = createController()
    const controllerB = createController()

    const { rerender } = renderHook(
      ({ controller, tabId }: { controller: AiContentController; tabId: string }) =>
        useElementPickerLifecycle(() => controller, tabId),
      { initialProps: { controller: controllerA as AiContentController, tabId: 'tab-a' } }
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(mockStopPicker).not.toHaveBeenCalled()

    await act(async () => {
      rerender({ controller: controllerB as AiContentController, tabId: 'tab-b' })
    })

    expect(mockStopPicker).toHaveBeenCalledTimes(1)
  })

  it('does not cancel a picker when the tab id only arrives after the start', async () => {
    const controller = createController()
    mockPickerState.active = true

    const { rerender } = renderHook(
      ({ tabId }: { tabId?: string }) => useElementPickerLifecycle(() => controller, tabId),
      { initialProps: { tabId: undefined as string | undefined } }
    )

    await act(async () => {
      rerender({ tabId: 'tab-a' })
    })

    // undefined -> 'tab-a' is the id materialising, not a tab switch.
    expect(mockStopPicker).not.toHaveBeenCalled()
  })

  it('drops readiness subscriptions when the arm timeout fires', async () => {
    vi.useFakeTimers()
    try {
      const controller = createController({
        executeJavaScript: vi.fn().mockResolvedValue('loading')
      })

      const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

      await act(async () => {
        result.current.startPickerWhenReady()
      })
      await act(async () => {
        // The readiness module is imported dynamically; let its microtasks run
        // before asserting on the subscriptions.
        for (let i = 0; i < 5; i++) await Promise.resolve()
      })

      const before = controller._unsubscribeCount()
      expect(before).toBeGreaterThan(0)

      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })

      expect(controller._unsubscribeCount()).toBeLessThan(before)
      expect(mockStartPicker).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels an armed start when the user switches to a different tab', async () => {
    const controllerA = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const controllerB = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result, rerender } = renderHook(
      ({ controller, tabId }: { controller: AiContentController; tabId: string }) =>
        useElementPickerLifecycle(() => controller, tabId),
      { initialProps: { controller: controllerA as AiContentController, tabId: 'tab-a' } }
    )

    await act(async () => {
      result.current.startPickerWhenReady('tab-a')
    })
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      rerender({ controller: controllerB as AiContentController, tabId: 'tab-b' })
    })
    await act(async () => {
      controllerB._trigger('did-stop-loading')
    })
    expect(mockStartPicker).not.toHaveBeenCalled()

    // The arm is gone, not merely paused: returning to the original tab must
    // not revive it.
    await act(async () => {
      rerender({ controller: controllerA as AiContentController, tabId: 'tab-a' })
    })
    await act(async () => {
      controllerA._trigger('did-stop-loading')
    })
    expect(mockStartPicker).not.toHaveBeenCalled()
  })

  it('starts on the armed target tab once it becomes active', async () => {
    const controllerA = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const controllerB = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })

    const { result, rerender } = renderHook(
      ({ controller, tabId }: { controller: AiContentController; tabId: string }) =>
        useElementPickerLifecycle(() => controller, tabId),
      { initialProps: { controller: controllerA as AiContentController, tabId: 'tab-a' } }
    )

    // Settings flow: the id of the tab that was just opened is known before the
    // tab itself becomes active.
    await act(async () => {
      result.current.startPickerWhenReady('tab-b')
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockStartPicker).not.toHaveBeenCalled()

    await act(async () => {
      rerender({ controller: controllerB as AiContentController, tabId: 'tab-b' })
    })
    await act(async () => {
      controllerB._trigger('did-stop-loading')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })
})
