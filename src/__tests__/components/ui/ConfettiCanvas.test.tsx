import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import ConfettiCanvas from '../../../components/ui/ConfettiCanvas'

describe('ConfettiCanvas', () => {
    let mockContext: any
    let rafSpy: any
    let cancelRafSpy: any

    beforeEach(() => {
        vi.useFakeTimers()

        // Mock Canvas context
        mockContext = {
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillStyle: '',
            fillRect: vi.fn(),
            canvas: { width: 300, height: 300 }
        }

        // Spy on getContext
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
            if (contextId === '2d') return mockContext
            return null
        })

        // Spy on requestAnimationFrame
        rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            return setTimeout(() => cb(Date.now()), 16) as unknown as number
        })

        cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
            clearTimeout(id)
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('renders and initializes canvas when active', () => {
        const { container } = render(<ConfettiCanvas isActive={true} />)
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
        expect(canvas?.getContext).toHaveBeenCalledWith('2d')
    })

    it('does not render when inactive', () => {
        const { container } = render(<ConfettiCanvas isActive={false} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('starts animation loop when mounted', () => {
        render(<ConfettiCanvas isActive={true} />)

        // Should call rAF
        expect(rafSpy).toHaveBeenCalled()

        // Advance time to trigger animation frame
        act(() => {
            vi.advanceTimersByTime(50)
        })

        // Check if drawing occurred
        expect(mockContext.clearRect).toHaveBeenCalled()
        expect(mockContext.fillRect).toHaveBeenCalled()
        // And repeated calls to rAF
        expect(rafSpy.mock.calls.length).toBeGreaterThan(1)
    })

    it('cleans up animation on unmount', () => {
        const { unmount } = render(<ConfettiCanvas isActive={true} />)

        unmount()

        expect(cancelRafSpy).toHaveBeenCalled()
    })

    it('handles resize events', () => {
        render(<ConfettiCanvas isActive={true} />)

        // Trigger resize
        const resizeEvent = new Event('resize')
        window.dispatchEvent(resizeEvent)

        // Since resize() logic is: canvas.width = parentElement.clientWidth etc.
        // In jsdom parentElement might be null or simplified.
        // We can check if event listener was added/removed but that's internal detail.
        // The component attaches it on mount.
        // Let's verify no error is thrown at least.
    })
})
