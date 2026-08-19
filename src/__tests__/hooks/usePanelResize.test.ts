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
