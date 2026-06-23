import { usePanelResize } from '@shared/hooks/usePanelResize'

import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePanelResize', () => {
  const originalInnerWidth = window.innerWidth

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
    vi.restoreAllMocks()
  })

  it('should initialize with default width', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))
    expect(result.current.leftPanelWidth).toBe(50)
  })

  it('should not attach document resize listeners before dragging starts', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

    renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
      expect.anything()
    )
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('should start resizing on mouse down', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100
    } as unknown as ReactMouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    expect(result.current.isResizing).toBe(true)
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
  })

  it('should update width on mouse move', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

    const mouseDownEvent = {
      preventDefault: vi.fn(),
      clientX: 100
    } as unknown as ReactMouseEvent

    act(() => {
      result.current.handleMouseDown(mouseDownEvent)
    })

    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })

    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 300,
      bubbles: true
    })

    act(() => {
      document.dispatchEvent(mouseMoveEvent)
    })

    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })

    act(() => {
      document.dispatchEvent(mouseUpEvent)
    })

    expect(result.current.isResizing).toBe(false)
    expect(result.current.leftPanelWidth).toBe(30)
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
      result.current.handleMouseDown({ preventDefault: vi.fn() } as unknown as ReactMouseEvent)
    })

    const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 100, bubbles: true })
    act(() => {
      document.dispatchEvent(mouseMoveEvent)
    })
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(result.current.leftPanelWidth).toBe(20)
  })
})
