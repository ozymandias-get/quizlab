import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import ToastItem from '../../../../components/ui/Toast/ToastItem'

// Mock dependencies
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({
        t: (key: string, params?: any) => key + (params ? JSON.stringify(params) : '')
    })
}))

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, layout, layoutId, initial, animate, exit, transition, variants, whileHover, whileTap, ...props }: any) => (
            <div
                {...props}
                data-testid="motion-div"
            >
                {children}
            </div>
        )
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('ToastItem', () => {
    const mockOnRemove = vi.fn()
    const mockToast = {
        id: '123',
        type: 'success' as const,
        title: 'Success Title',
        message: 'Success Message',
        duration: 1000
    }

    beforeEach(() => {
        vi.useFakeTimers()
        mockOnRemove.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should render correct content', () => {
        render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

        expect(screen.getByText('Success Title')).toBeInTheDocument()
        expect(screen.getByText('Success Message')).toBeInTheDocument()
    })

    it('should call onRemove when close button is clicked', () => {
        render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

        const closeButton = screen.getByRole('button')
        fireEvent.click(closeButton)

        expect(mockOnRemove).toHaveBeenCalledWith('123')
    })

    it('should call onRemove after duration timeout', () => {
        render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

        act(() => {
            vi.advanceTimersByTime(1100)
        })

        expect(mockOnRemove).toHaveBeenCalledWith('123')
    })

    it('should pause timer on mouse enter', () => {
        render(<ToastItem toast={mockToast} onRemove={mockOnRemove} />)

        const container = screen.getAllByTestId('motion-div')[0]

        // Advance 500ms
        act(() => {
            vi.advanceTimersByTime(500)
        })

        // Pause
        fireEvent.mouseEnter(container)

        // Advance 1000ms (should exceed original duration if not paused)
        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(mockOnRemove).not.toHaveBeenCalled()

        // Resume
        fireEvent.mouseLeave(container)

        // Advance remaining 500ms + buffer
        act(() => {
            vi.advanceTimersByTime(600)
        })

        expect(mockOnRemove).toHaveBeenCalledWith('123')
    })
})
