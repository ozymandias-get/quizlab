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
})

/**
 * `republish` re-asserts a rectangle the main process may never have received.
 *
 * The sync channel is fire-and-forget with no acknowledgement, and the manager
 * rejects a message naming a view it does not own — which is exactly the state
 * the first rectangle after an attach is in, since attach resolves its target
 * asynchronously and can still be in the air. A single frame was therefore one
 * chance, and losing it stranded the view on its previous rectangle.
 */
describe('useAiViewHost - re-assertion', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextHandle: number

  beforeEach(() => {
    syncHost.mockClear()
    document.body.innerHTML = ''
    frames = new Map()
    nextHandle = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextHandle += 1
      frames.set(nextHandle, callback)
      return nextHandle
    })
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      frames.delete(handle)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  /** Runs queued frames, including the ones a callback queues in turn. */
  function flushFrames(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const queued = [...frames.values()]
      frames.clear()
      for (const callback of queued) callback(0)
    }
  }

  function mountHost() {
    const { host } = createRoundedHost(
      { x: 4, y: 6, width: 500, height: 400 },
      { radius: '16px', borderWidth: '1px' }
    )
    const rendered = renderHook(() => useAiViewHost(defaultOptions))
    act(() => {
      rendered.result.current.setHostElement(host)
    })
    syncHost.mockClear()
    return rendered
  }

  it('re-sends an unchanged snapshot instead of trusting a single frame', () => {
    const { result } = mountHost()

    act(() => {
      result.current.republish()
      flushFrames(20)
    })

    expect(syncHost.mock.calls.length).toBeGreaterThan(1)
    for (const [payload] of syncHost.mock.calls) {
      expect(payload.bounds).toEqual({
        x: 4,
        y: 6,
        width: 500,
        height: 400,
        borderRadius: 15
      })
    }
  })

  it('stops after a bounded number of frames rather than looping forever', () => {
    const { result } = mountHost()

    act(() => {
      result.current.republish()
      flushFrames(60)
    })

    // The budget is deliberately small; what matters is that it is finite.
    expect(syncHost).toHaveBeenCalledTimes(3)
  })

  it('coalesces repeat calls in one frame into the same budget', () => {
    const { result } = mountHost()

    act(() => {
      result.current.republish()
      result.current.republish()
      result.current.republish()
      flushFrames(60)
    })

    expect(syncHost).toHaveBeenCalledTimes(3)
  })

  it('gives up when there is no placeholder left to measure', () => {
    const { result, unmount } = mountHost()

    act(() => {
      result.current.republish()
    })
    unmount()
    syncHost.mockClear()

    act(() => {
      flushFrames(20)
    })

    expect(syncHost).not.toHaveBeenCalled()
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
