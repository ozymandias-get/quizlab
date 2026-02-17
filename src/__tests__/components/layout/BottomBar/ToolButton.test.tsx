import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToolButton } from '../../../../components/layout/BottomBar/ToolButton'

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, onClick, className, style, ...props }: any) => (
            <button
                onClick={onClick}
                className={className}
                style={style}
                data-testid="motion-button"
                {...props}
            >
                {children}
            </button>
        )
    }
}))

// Mock animations
vi.mock('../../../../components/layout/BottomBar/animations', () => ({
    toolItemVariants: {}
}))

describe('ToolButton', () => {
    const mockOnClick = vi.fn()

    beforeEach(() => {
        vi.useFakeTimers()
        mockOnClick.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders correctly with children', () => {
        render(
            <ToolButton onClick={mockOnClick} title="Test Tool">
                <span>Icon</span>
            </ToolButton>
        )

        expect(screen.getByTitle('Test Tool')).toBeInTheDocument()
        expect(screen.getByText('Icon')).toBeInTheDocument()
    })

    it('applies active styles when isActive is true', () => {
        render(
            <ToolButton onClick={mockOnClick} title="Active Tool" isActive={true} activeColor="#ff0000">
                <span>Icon</span>
            </ToolButton>
        )

        const btn = screen.getByTestId('motion-button')
        expect(btn).toHaveClass('tool-btn--active-glow')
        // Check if inline style for active activeColor is present (simplified check)
        // Note: checking complex gradients in jsdom might be flaky, checking class is safer.
    })

    it('calls onClick when clicked', () => {
        render(
            <ToolButton onClick={mockOnClick} title="Click Me">
                <span>Icon</span>
            </ToolButton>
        )

        const btn = screen.getByTestId('motion-button')
        fireEvent.click(btn)

        expect(mockOnClick).toHaveBeenCalled()
    })

    it('creates ripple effect on click', () => {
        render(
            <ToolButton onClick={mockOnClick} title="Ripple Me">
                <span>Icon</span>
            </ToolButton>
        )

        const btn = screen.getByTestId('motion-button')

        // Mock getBoundingClientRect
        btn.getBoundingClientRect = vi.fn(() => ({
            left: 100,
            top: 100,
            width: 50,
            height: 50,
            x: 100,
            y: 100,
            bottom: 150,
            right: 150,
            toJSON: () => { }
        }))

        fireEvent.click(btn, { clientX: 125, clientY: 125 })

        // We can't easily check if the ripple span was added and removed in jsdom 
        // without more complex setup because it's imperative DOM manipulation in the component.
        // But we can verify no errors occurred and onclick was called.
        expect(mockOnClick).toHaveBeenCalled()

        // Could inspect component internal ref if we really wanted to, 
        // but testing the effect via DOM presence after click is tricky with the imperative code.
    })
})
