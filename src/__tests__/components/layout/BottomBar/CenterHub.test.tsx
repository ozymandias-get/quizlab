import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CenterHub } from '../../../../components/layout/BottomBar/CenterHub'

// Mock dependencies
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, onPointerUp, onMouseDown, role, ...props }: any) => (
            <div
                {...props}
                role={role}
                onPointerUp={onPointerUp}
                onMouseDown={onMouseDown}
                data-testid={role === 'button' ? 'center-hub-btn' : 'motion-div'}
            >
                {children}
            </div>
        )
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

// Mock Icons
vi.mock('@src/components/ui/Icons', () => ({
    MagicWandIcon: () => <svg data-testid="magic-wand-icon" />
}))

// Mock animations
vi.mock('../../../../components/layout/BottomBar/animations', () => ({
    hubIconVariants: {},
    hubIconTransition: {},
    iconStyleVariants: {},
    hubGlowVariants: {}
}))

describe('CenterHub', () => {
    const handleHubPointerUp = vi.fn()
    const onMouseDown = vi.fn()
    const hubStyle = { transform: 'none' }

    beforeEach(() => {
        handleHubPointerUp.mockClear()
        onMouseDown.mockClear()
    })

    it('renders closed state correctly', () => {
        render(
            <CenterHub
                isOpen={false}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
            />
        )

        const hub = screen.getByTestId('center-hub-btn')
        expect(hub).toHaveClass('hub-center-btn--closed')

        expect(screen.getByTestId('magic-wand-icon')).toBeInTheDocument()
    })

    it('renders open state correctly', () => {
        render(
            <CenterHub
                isOpen={true}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
            />
        )

        const hub = screen.getByTestId('center-hub-btn')
        expect(hub).toHaveClass('hub-center-btn--open')
    })

    it('calls handleHubPointerUp when clicked (pointer up)', () => {
        render(
            <CenterHub
                isOpen={false}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
            />
        )

        const hub = screen.getByTestId('center-hub-btn')
        fireEvent.pointerUp(hub)

        expect(handleHubPointerUp).toHaveBeenCalled()
    })

    it('calls onMouseDown only when closed', () => {
        const { rerender } = render(
            <CenterHub
                isOpen={false}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
            />
        )

        const hub = screen.getByTestId('center-hub-btn')
        fireEvent.mouseDown(hub)
        expect(onMouseDown).toHaveBeenCalled()

        onMouseDown.mockClear()

        rerender(
            <CenterHub
                isOpen={true}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
            />
        )

        fireEvent.mouseDown(hub)
        expect(onMouseDown).not.toHaveBeenCalled()
    })

    it('shows tabs count badge when > 1 and closed', () => {
        const { rerender } = render(
            <CenterHub
                isOpen={false}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
                tabsCount={5}
            />
        )

        expect(screen.getByText('5')).toBeInTheDocument()

        // Hide when open
        rerender(
            <CenterHub
                isOpen={true}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
                tabsCount={5}
            />
        )

        expect(screen.queryByText('5')).not.toBeInTheDocument()

        // Hide when count <= 1
        rerender(
            <CenterHub
                isOpen={false}
                hubStyle={hubStyle}
                handleHubPointerUp={handleHubPointerUp}
                onMouseDown={onMouseDown}
                tabsCount={1}
            />
        )
        expect(screen.queryByText('1')).not.toBeInTheDocument()
    })
})
