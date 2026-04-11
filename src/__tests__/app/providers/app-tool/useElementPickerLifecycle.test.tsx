import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebviewController, WebviewElement } from '@shared-core/types/webview'
import { useElementPickerLifecycle } from '@app/providers/app-tool/useElementPickerLifecycle'

const mockStartPicker = vi.fn()

vi.mock('@features/automation/hooks/useElementPicker', () => ({
  useElementPicker: () => ({
    isPickerActive: false,
    startPicker: mockStartPicker,
    togglePicker: vi.fn()
  })
}))

function createMockWebviewElement() {
  const listeners: Record<string, ((e?: Event) => void) | undefined> = {}
  return {
    addEventListener: vi.fn((event: string, handler: (e?: Event) => void) => {
      listeners[event] = handler
    }),
    removeEventListener: vi.fn((event: string) => {
      delete listeners[event]
    }),
    isDestroyed: vi.fn(() => false),
    _trigger: (event: string) => {
      listeners[event]?.()
    }
  }
}

type MockWebviewElement = ReturnType<typeof createMockWebviewElement>

function getMockElement(controller: WebviewController): MockWebviewElement {
  return controller.getWebview?.() as unknown as MockWebviewElement
}

function createController(overrides: Partial<WebviewController> = {}): WebviewController {
  const el = createMockWebviewElement()
  const state = {
    element: el as unknown as WebviewElement,
    subs: new Set<(e: WebviewElement | null) => void>()
  }

  const base: WebviewController = {
    getWebview: () => state.element,
    executeJavaScript: vi.fn().mockResolvedValue('loading'),
    subscribeWebviewElement: (listener) => {
      state.subs.add(listener)
      listener(state.element)
      return () => {
        state.subs.delete(listener)
      }
    }
  }

  return { ...base, ...overrides }
}

describe('useElementPickerLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartPicker.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts picker immediately when catch-up sees interactive document (already ready)', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    })

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('waits for did-stop-loading instead of polling readyState in a loop', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const el = getMockElement(controller)

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockStartPicker).not.toHaveBeenCalled()

    await act(async () => {
      el._trigger('did-stop-loading')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('fulfills on dom-ready when catch-up is still loading', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const el = getMockElement(controller)

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      el._trigger('dom-ready')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('does not start picker on a previous webview after active instance changes', async () => {
    const controllerA = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const elA = getMockElement(controllerA)

    const controllerB = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const elB = getMockElement(controllerB)

    const { result, rerender } = renderHook(
      ({ wv }: { wv: WebviewController | null }) => useElementPickerLifecycle(wv),
      {
        initialProps: { wv: controllerA as WebviewController | null }
      }
    )

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      rerender({ wv: controllerB })
    })

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      elA._trigger('did-stop-loading')
    })

    expect(mockStartPicker).not.toHaveBeenCalled()

    await act(async () => {
      elB._trigger('did-stop-loading')
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('does not start picker after unmount (listeners disposed)', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const el = getMockElement(controller)

    const { result, unmount } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    await act(async () => {
      el._trigger('did-stop-loading')
    })

    expect(mockStartPicker).not.toHaveBeenCalled()
  })

  it('removes event listeners on cleanup', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const el = getMockElement(controller)

    const { result, unmount } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    expect(el.removeEventListener).toHaveBeenCalledWith('dom-ready', expect.any(Function))
    expect(el.removeEventListener).toHaveBeenCalledWith('did-stop-loading', expect.any(Function))
  })

  it('calls startPicker at most once per successful readiness', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    })

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })

  it('cancels pending request when webview reports disposed', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('loading')
    })
    const el = getMockElement(controller)
    el.isDestroyed.mockReturnValue(true)

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockStartPicker).not.toHaveBeenCalled()
  })

  it('waits for subscribeWebviewElement when getWebview is initially null', async () => {
    const el = createMockWebviewElement()
    const state = {
      element: null as WebviewElement | null,
      subs: new Set<(e: WebviewElement | null) => void>()
    }

    const notify = () => {
      state.subs.forEach((l) => l(state.element))
    }

    const controller: WebviewController = {
      getWebview: () => state.element,
      executeJavaScript: vi.fn().mockResolvedValue('complete'),
      subscribeWebviewElement: (listener) => {
        state.subs.add(listener)
        listener(state.element)
        return () => {
          state.subs.delete(listener)
        }
      }
    }

    const { result } = renderHook(() => useElementPickerLifecycle(controller))

    await act(async () => {
      result.current.startPickerWhenReady()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockStartPicker).not.toHaveBeenCalled()

    await act(async () => {
      state.element = el as unknown as WebviewElement
      notify()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockStartPicker).toHaveBeenCalledTimes(1)
  })
})
