import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePanelResize } from '@src/hooks/usePanelResize'

// Mock useLocalStorage to just behave like useState for simplicity in this test
// OR rely on the real implementation which uses localStorage.
// Since we tested useLocalStorage separately, we can trust it works, 
// but we might need to clear storage between tests.

describe('usePanelResize Hook', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.clearAllMocks()

        // Mock requestAnimationFrame
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0)
            return 1
        })
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { })
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
            clientX: 100,
        } as unknown as React.MouseEvent

        act(() => {
            result.current.handleMouseDown(mockEvent)
        })

        expect(result.current.isResizing).toBe(true)
        // Check document body styles
        expect(document.body.style.cursor).toBe('col-resize')
        expect(document.body.style.userSelect).toBe('none')
    })

    it('should update width on mouse move', () => {
        // We need to mount the hook and simulate events on document
        const { result } = renderHook(() => usePanelResize({ storageKey: 'test-panel' }))

        // 1. Start resizing
        const mouseDownEvent = {
            preventDefault: vi.fn(),
            clientX: 100,
        } as unknown as React.MouseEvent

        act(() => {
            result.current.handleMouseDown(mouseDownEvent)
        })

        // 2. Mock window.innerWidth
        Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })

        // 3. Move mouse to 300px (30%)
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 300,
            bubbles: true
        })

        act(() => {
            document.dispatchEvent(mouseMoveEvent)
        })

        // The hook updates a ref and RAF, not state immediately during resize
        // for performance. But it updates the DOM element via ref.
        // We can't easily check the ref style here because we didn't attach the ref to a real DOM node.

        // However, we can simulate MouseUp to see if it commits the value to state.
        const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })

        act(() => {
            document.dispatchEvent(mouseUpEvent)
        })

        expect(result.current.isResizing).toBe(false)
        expect(result.current.leftPanelWidth).toBe(30) // 300 / 1000 * 100 = 30%
    })

    it('should respect min limits', () => {
        const { result } = renderHook(() => usePanelResize({
            storageKey: 'test-panel',
            minLeft: 200, // 20% of 1000
            minRight: 200 // max width = 1000 - 200 - resizer(48) = 752
        }))

        // Mock window
        Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })

        // Start resizing
        act(() => {
            result.current.handleMouseDown({ preventDefault: vi.fn() } as any)
        })

        // Try to move to 100px (below minLeft 200)
        const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 100, bubbles: true })
        act(() => {
            document.dispatchEvent(mouseMoveEvent)
        })
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        })

        // Should NOT have updated to 10%, should stay at initial 50% because move was ignored
        // Or if it clamps? Implementation: if (newWidthPx >= minLeft && ...)
        // So it ignores invalid moves.
        expect(result.current.leftPanelWidth).toBe(50)
    })
})
