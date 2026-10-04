import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const syncHost = vi.hoisted(() => vi.fn())
const electronApi = vi.hoisted(() => ({ aiView: { syncHost } }))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => electronApi
}))

const { useAiViewHost } = await import('@shared/hooks/aiContent/useAiViewHost')

/** Drives `getBoundingClientRect` on a fake host element. */
function createHost(rect: { x: number; y: number; width: number; height: number }) {
  const targets = new Set<() => void>()
  const element = {
    getBoundingClientRect: () => ({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      x: rect.x,
      y: rect.y,
      toJSON: () => ({})
    })
  } as unknown as HTMLDivElement

  class StubResizeObserver {
    private readonly notify: () => void
    constructor(callback: () => void) {
      this.notify = callback
    }
    observe() {
      targets.add(this.notify)
    }
    unobserve() {
      targets.delete(this.notify)
    }
    disconnect() {
      targets.clear()
    }
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver)

  return {
    element,
    resize: () => targets.forEach((listener) => listener()),
    observerCount: () => targets.size,
    setRect: (next: typeof rect) => {
      Object.assign(rect, next)
    }
  }
}

const defaultOptions = {
  viewId: 'tab-1',
  hostToken: 'h1',
  isHostOwner: true,
  visible: true
}

describe('useAiViewHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncHost.mockClear()
  })

  it('publishes integer, non-negative bounds for the host element', async () => {
    const host = createHost({ x: 10.4, y: 20.6, width: 300.2, height: 400.8 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })

    expect(syncHost).toHaveBeenCalledWith({
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: 10, y: 21, width: 300, height: 401 },
      visible: true
    })
  })

  it('clamps a negative origin instead of sending it', async () => {
    const host = createHost({ x: -30, y: -5, width: 100, height: 100 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })

    expect(syncHost.mock.calls.at(-1)?.[0].bounds).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
  })

  it('sends nothing while this host does not own the view', () => {
    const host = createHost({ x: 0, y: 0, width: 100, height: 100 })
    const { result } = renderHook(() => useAiViewHost({ ...defaultOptions, isHostOwner: false }))

    act(() => {
      result.current.setHostElement(host.element)
    })

    expect(syncHost).not.toHaveBeenCalled()
  })

  it('coalesces a burst of resize notifications into one update per frame', async () => {
    const host = createHost({ x: 0, y: 0, width: 100, height: 100 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })
    syncHost.mockClear()

    act(() => {
      host.setRect({ x: 5, y: 5, width: 105, height: 105 })
      host.resize()
      host.resize()
      host.resize()
    })

    await vi.waitFor(() => {
      expect(syncHost).toHaveBeenCalledTimes(1)
    })
    expect(syncHost.mock.calls[0][0].bounds).toEqual({
      x: 5,
      y: 5,
      width: 105,
      height: 105
    })
  })

  it('does not resend an unchanged rectangle', async () => {
    const host = createHost({ x: 0, y: 0, width: 100, height: 100 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })
    syncHost.mockClear()

    act(() => {
      host.resize()
      host.resize()
    })

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    })
    expect(syncHost).not.toHaveBeenCalled()
  })

  it('re-pushes geometry when only the visibility flips', () => {
    const host = createHost({ x: 0, y: 0, width: 100, height: 100 })
    const { result, rerender } = renderHook(
      (props: { visible: boolean }) => useAiViewHost({ ...defaultOptions, ...props }),
      { initialProps: { visible: true } }
    )

    act(() => {
      result.current.setHostElement(host.element)
    })
    syncHost.mockClear()

    rerender({ visible: false })

    expect(syncHost).toHaveBeenCalledTimes(1)
    expect(syncHost.mock.calls[0][0].visible).toBe(false)
  })

  it('claims ownership the moment it becomes the single writer', () => {
    const host = createHost({ x: 1, y: 2, width: 3, height: 4 })
    const { result, rerender } = renderHook(
      (props: { isHostOwner: boolean }) => useAiViewHost({ ...defaultOptions, ...props }),
      { initialProps: { isHostOwner: false } }
    )

    act(() => {
      result.current.setHostElement(host.element)
    })
    expect(syncHost).not.toHaveBeenCalled()

    rerender({ isHostOwner: true })
    expect(syncHost).toHaveBeenCalledTimes(1)
    expect(syncHost.mock.calls[0][0].hostToken).toBe('h1')
  })

  it('flushes synchronously without waiting for a frame', () => {
    const host = createHost({ x: 0, y: 0, width: 10, height: 10 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })
    syncHost.mockClear()

    host.setRect({ x: 7, y: 7, width: 70, height: 70 })
    act(() => {
      result.current.flush()
    })

    expect(syncHost).toHaveBeenCalledTimes(1)
    expect(syncHost.mock.calls[0][0].bounds).toEqual({ x: 7, y: 7, width: 70, height: 70 })
  })

  it('stops observing on unmount', () => {
    const host = createHost({ x: 0, y: 0, width: 10, height: 10 })
    const { result, unmount } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })
    expect(host.observerCount()).toBe(1)

    unmount()
    expect(host.observerCount()).toBe(0)
  })

  it('reacts to window resize', async () => {
    const host = createHost({ x: 0, y: 0, width: 10, height: 10 })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host.element)
    })
    syncHost.mockClear()

    host.setRect({ x: 0, y: 0, width: 999, height: 10 })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    await vi.waitFor(() => {
      expect(syncHost).toHaveBeenCalledTimes(1)
    })
    expect(syncHost.mock.calls[0][0].bounds.width).toBe(999)
  })
})
