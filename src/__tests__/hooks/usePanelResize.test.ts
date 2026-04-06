import type { MouseEvent as ReactMouseEvent } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePanelResize } from '@shared/hooks/usePanelResize'

describe('usePanelResize Hook', () => {
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
    vi.restoreAllMocks()
  })

  it('should initialize with default width', () => {
    const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))
    expect(result.current.leftPanelWidth).toBe(50)
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

    expect(result.current.leftPanelWidth).toBe(50)
  })
})
