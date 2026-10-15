import { usePanelResize } from '@shared/hooks/usePanelResize'

import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePanelResize', () => {
  const originalInnerWidth = window.innerWidth

  const makeCurrentTarget = () =>
    ({
      setPointerCapture: vi.fn<(pointerId: number) => void>(),
      releasePointerCapture: vi.fn<(pointerId: number) => void>()
    }) as {
      setPointerCapture: (pointerId: number) => void
      releasePointerCapture: (pointerId: number) => void
    }

  const makePointerEvent = (overrides: Record<string, unknown> = {}) =>
    ({
      preventDefault: vi.fn(),
      pointerId: 1,
      clientX: 100,
      currentTarget: makeCurrentTarget(),
      ...overrides
    }) as unknown as ReactPointerEvent

  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore innerWidth to prevent state leaking across test files
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true
    })
    document.body.classList.remove('panel-resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    vi.restoreAllMocks()
  })

  it('should initialize with default width', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))
    expect(result.current.leftPanelWidth).toBe(50)
  })

  it('should start resizing on pointer down', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    const mockEvent = makePointerEvent()

    act(() => {
      result.current.handlePointerDown(mockEvent)
    })

    expect(result.current.isResizing).toBe(true)
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
  })

  it('should capture the pointer on the handler element (currentTarget)', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    const mockEvent = makePointerEvent()

    act(() => {
      result.current.handlePointerDown(mockEvent)
    })

    // Capturing on currentTarget keeps subsequent pointermove/pointerup
    // events flowing to the element that owns the handlers. Capturing on the
    // outer resizer wrapper instead would retarget the events away from them,
    // so the drag would never track (regression guard).
    expect(
      (mockEvent.currentTarget as { setPointerCapture: (pointerId: number) => void })
        .setPointerCapture
    ).toHaveBeenCalledWith(1)
  })

  it('should update width on pointer move and commit on pointer up', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    const mockEvent = makePointerEvent()

    act(() => {
      result.current.handlePointerDown(mockEvent)
    })

    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })

    act(() => {
      result.current.handlePointerMove({
        pointerId: 1,
        clientX: 300
      } as unknown as ReactPointerEvent)
    })

    act(() => {
      result.current.handlePointerUp({ pointerId: 1 } as unknown as ReactPointerEvent)
    })

    expect(result.current.isResizing).toBe(false)
    expect(result.current.leftPanelWidth).toBe(30)
  })

  it('should end resizing on lost pointer capture', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    act(() => {
      result.current.handlePointerDown(makePointerEvent())
    })

    act(() => {
      result.current.handleLostPointerCapture({ pointerId: 1 } as unknown as ReactPointerEvent)
    })

    expect(result.current.isResizing).toBe(false)
    expect(document.body.style.cursor).toBe('')
  })

  // A drag React never hears about leaves `isResizing` true, which is what pins
  // `pointer-events: none` onto the AI panel and keeps `col-resize` /
  // `user-select: none` on the body — the whole shell reads as frozen.
  it.each([
    ['pointerup', new Event('pointerup')],
    ['pointercancel', new Event('pointercancel')],
    ['blur', new Event('blur')]
  ])('should end resizing on a window-level %s', (_label, event) => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    act(() => {
      result.current.handlePointerDown(makePointerEvent())
    })
    expect(result.current.isResizing).toBe(true)

    act(() => {
      window.dispatchEvent(event)
    })

    expect(result.current.isResizing).toBe(false)
    expect(document.body.classList.contains('panel-resizing')).toBe(false)
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('should not touch resize state for a window event with no drag in flight', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    act(() => {
      window.dispatchEvent(new Event('pointerup'))
      window.dispatchEvent(new Event('pointercancel'))
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current.isResizing).toBe(false)
    expect(document.body.classList.contains('panel-resizing')).toBe(false)
  })

  it('should stop listening for window events on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    act(() => {
      result.current.handlePointerDown(makePointerEvent())
    })
    unmount()

    const removed = removeEventListener.mock.calls.map(([type]) => type)
    expect(removed).toContain('pointercancel')
    expect(removed).toContain('blur')
  })

  it('should respect min limits', () => {
    const { result } = renderHook(() =>
      usePanelResize({
        storageKey: 'test-panel',
        minLeft: 200,
        minRight: 200
      })
    )

    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })

    act(() => {
      result.current.handlePointerDown(makePointerEvent())
    })

    act(() => {
      result.current.handlePointerMove({
        pointerId: 1,
        clientX: 100
      } as unknown as ReactPointerEvent)
    })
    act(() => {
      result.current.handlePointerUp({ pointerId: 1 } as unknown as ReactPointerEvent)
    })

    expect(result.current.leftPanelWidth).toBe(20)
  })
})
