import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/**
 * Builds a real DOM chain so `getComputedStyle` can resolve, mirroring the panel
 * that rounds its content with `overflow: hidden` + `border-radius`.
 *
 * Longhand properties are set because jsdom does not expand the `overflow` and
 * `border-radius` shorthands; a real Chromium does, which is what production
 * relies on.
 */
function createRoundedHost(
  rect: { x: number; y: number; width: number; height: number },
  panel: { radius: string; borderWidth: string }
) {
  const frame = document.createElement('div')
  frame.style.overflowX = 'hidden'
  frame.style.overflowY = 'hidden'
  frame.style.borderTopLeftRadius = panel.radius
  frame.style.borderTopWidth = panel.borderWidth
  frame.style.borderTopStyle = 'solid'

  const host = document.createElement('div')
  frame.appendChild(host)
  document.body.appendChild(frame)
  host.getBoundingClientRect = () =>
    ({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      x: rect.x,
      y: rect.y,
      toJSON: () => ({})
    }) as DOMRect

  return { host, frame }
}

describe('useAiViewHost - corner radius', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncHost.mockClear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sends the panel radius less its border, so the native view corner lines up', () => {
    const { host } = createRoundedHost(
      { x: 0, y: 0, width: 500, height: 400 },
      { radius: '16px', borderWidth: '1px' }
    )
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })

    expect(syncHost.mock.calls[0][0].bounds.borderRadius).toBe(15)
  })

  it('falls back to square corners when no ancestor clips', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })

    expect(syncHost.mock.calls[0][0].bounds.borderRadius).toBe(0)
  })

  it('ignores a clipping ancestor that is not rounded', () => {
    const { host } = createRoundedHost(
      { x: 0, y: 0, width: 500, height: 400 },
      { radius: '0px', borderWidth: '0px' }
    )
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })

    expect(syncHost.mock.calls[0][0].bounds.borderRadius).toBe(0)
  })

  it('re-publishes geometry when only the panel radius changes', async () => {
    // Regression guard on both halves of the same bug: the renderer dropped the
    // snapshot because it compared the rectangle only, and the manager therefore
    // never heard about the new radius even though it does treat it as part of
    // the bounds message. A theme / density change (or a different panel
    // wrapping the same host) would leave the native view clipped to the
    // previous corner radius while painting the new bounds.
    const rect = { x: 4, y: 6, width: 500, height: 400 }
    const { host, frame } = createRoundedHost(rect, { radius: '16px', borderWidth: '1px' })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })
    expect(syncHost).toHaveBeenCalledTimes(1)
    expect(syncHost.mock.calls[0][0].bounds.borderRadius).toBe(15)

    frame.style.borderTopLeftRadius = '13px'
    act(() => {
      result.current.flush()
    })

    expect(syncHost).toHaveBeenCalledTimes(2)
    expect(syncHost.mock.calls[1][0].bounds).toEqual({
      x: 4,
      y: 6,
      width: 500,
      height: 400,
      borderRadius: 12
    })
  })

  it('still drops a genuinely unchanged snapshot', () => {
    const rect = { x: 4, y: 6, width: 500, height: 400 }
    const { host } = createRoundedHost(rect, { radius: '16px', borderWidth: '1px' })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })
    syncHost.mockClear()

    act(() => {
      result.current.flush()
      result.current.flush()
    })

    expect(syncHost).not.toHaveBeenCalled()
  })

  it('re-sends an unchanged snapshot on demand, once per call', async () => {
    // The main process drops a sync naming a view it does not own yet and never
    // acknowledges the ones it keeps, so the host cannot tell a delivered message
    // from a lost one. `republish` is how it re-asserts a rectangle it already
    // believes main has, without waiting for something to change.
    const rect = { x: 4, y: 6, width: 500, height: 400 }
    const { host } = createRoundedHost(rect, { radius: '16px', borderWidth: '1px' })
    const { result } = renderHook(() => useAiViewHost(defaultOptions))

    act(() => {
      result.current.setHostElement(host)
    })
    expect(syncHost).toHaveBeenCalledTimes(1)
    syncHost.mockClear()

    await act(async () => {
      result.current.republish()
      await new Promise((resolve) => setTimeout(resolve, 32))
    })
    expect(syncHost).toHaveBeenCalledTimes(1)
    expect(syncHost.mock.calls[0][0].bounds).toEqual({
      x: 4,
      y: 6,
      width: 500,
      height: 400,
      borderRadius: 15
    })

    // Two calls in the same frame coalesce into one send, exactly like a resize.
    await act(async () => {
      result.current.republish()
      result.current.republish()
      await new Promise((resolve) => setTimeout(resolve, 32))
    })
    expect(syncHost).toHaveBeenCalledTimes(2)
  })
})

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
      bounds: { x: 10, y: 21, width: 300, height: 401, borderRadius: 0 },
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
      height: 100,
      borderRadius: 0
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
      height: 105,
      borderRadius: 0
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
    expect(syncHost.mock.calls[0][0].bounds).toEqual({
      x: 7,
      y: 7,
      width: 70,
      height: 70,
      borderRadius: 0
    })
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
