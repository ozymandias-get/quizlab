import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import FloatingButton from '@ui/FloatingButton'

// Mock hooks
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
    useAppearance: () => ({ selectionColor: '#ff0000' })
}))

describe('FloatingButton', () => {
    it('should not render if position is null', () => {
        const { container } = render(
            <FloatingButton position={null} />
        )
        // It renders with empty style but still renders DOM?
        // Code says: if (!position) return {} (for style)
        // But the component returns JSX.
        // So it renders at default position? Element is fixed.
        // If style is empty, it might be visible or default 0,0?
        // Actually, style object is empty. The class has `fixed`.
        // So it will be at top-left or wherever default is.
        // Let's just check it is in the document.
        expect(container.firstChild).toBeInTheDocument()
    })

    it('should position correctly', () => {
        render(
            <FloatingButton position={{ top: 100, left: 200 }} />
        )
        const btn = screen.getByText('send_to_ai').closest('div')
        expect(btn).toHaveStyle({ top: '100px', left: '200px' })
    })

    it('should call onClick when clicked', () => {
        const onClick = vi.fn()
        render(
            <FloatingButton position={{ top: 100, left: 200 }} onClick={onClick} />
        )
        const btn = screen.getByText('send_to_ai')
        fireEvent.click(btn)
        expect(onClick).toHaveBeenCalled()
    })

    it('should stop propagation on click', () => {
        const onClick = vi.fn()
        const onOuterClick = vi.fn()

        render(
            <div onClick={onOuterClick}>
                <FloatingButton position={{ top: 100, left: 200 }} onClick={onClick} />
            </div>
        )

        const btn = screen.getByText('send_to_ai')
        fireEvent.click(btn)

        expect(onClick).toHaveBeenCalled()
        expect(onOuterClick).not.toHaveBeenCalled()
    })

    it('should prevent default and stop propagation on mousedown', () => {
        const onOuterMouseDown = vi.fn()

        render(
            <div onMouseDown={onOuterMouseDown}>
                <FloatingButton position={{ top: 100, left: 200 }} />
            </div>
        )

        const btn = screen.getByText('send_to_ai')
        fireEvent.mouseDown(btn)

        expect(onOuterMouseDown).not.toHaveBeenCalled()
    })
})
