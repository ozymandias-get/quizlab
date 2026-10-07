import type { AiContentController } from '@shared-core/types/aiContent'
import type { AiViewEventKind, AiViewEventOf } from '@shared-core/types/aiView'

import { useElementPickerLifecycle } from '@app/providers/app-tool/useElementPickerLifecycle'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStartPicker = vi.fn()

vi.mock('@features/automation', () => ({
  useElementPicker: () => ({
    isPickerActive: false,
    startPicker: mockStartPicker,
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
    mockStartPicker.mockResolvedValue(undefined)
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

  it('waits for did-stop-loading instead of polling readyState in a loop', async () => {
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
      controller._trigger('did-stop-loading')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('fulfills on dom-ready when catch-up is still loading', async () => {
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

    await act(async () => {
      controller._trigger('dom-ready')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

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

  it('calls startPicker at most once per successful readiness', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    })

    const { result } = renderHook(() => useElementPickerLifecycle(() => controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
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
})
