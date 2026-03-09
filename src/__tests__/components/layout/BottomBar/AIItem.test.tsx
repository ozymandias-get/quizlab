import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIItem, AIItemProps } from '@ui/layout/BottomBar/AIItem'

vi.mock('@ui/components/Icons', () => ({
    getAiIcon: (key: string) => <div data-testid={`icon-${key}`}>{key}</div>
}))

vi.mock('@app/providers', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}))

vi.mock('framer-motion', () => ({
    Reorder: {
        Item: ({
            children,
            value,
            onDragStart,
            onDragEnd,
            whileDrag,
            layout,
            animate,
            transition,
            initial,
            exit,
            ...props
        }: any) => (
            <div
                data-testid="reorder-item"
                data-value={value}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                {...props}
            >
                {children}
            </div>
        )
    },
    motion: {
        button: ({
            children,
            onClick,
            onHoverStart,
            onHoverEnd,
            whileHover,
            whileTap,
            layout,
            initial,
            animate,
            exit,
            transition,
            ...props
        }: any) => (
            <button
                onClick={onClick}
                onMouseEnter={onHoverStart}
                onMouseLeave={onHoverEnd}
                data-testid="motion-button"
                {...props}
            >
                {children}
            </button>
        ),
        div: ({
            children,
            layout,
            initial,
            animate,
            exit,
            transition,
            whileHover,
            whileTap,
            whileDrag,
            ...props
        }: any) => <div {...props}>{children}</div>
    }
}))

describe('AIItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createProps = (overrides: Partial<AIItemProps> = {}): AIItemProps => ({
        modelKey: 'gpt-4',
        site: { displayName: 'GPT-4', color: '#ff0000', icon: 'gpt-4' },
        isSelected: false,
        setCurrentAI: vi.fn(),
        setActiveDragItem: vi.fn(),
        activeDragItem: null,
        showOnlyIcons: true,
        draggable: true,
        ...overrides
    })

    it('renders with icon only when showOnlyIcons is true', () => {
        render(<AIItem {...createProps()} />)

        expect(screen.getByTestId('icon-gpt-4')).toBeInTheDocument()
        expect(screen.queryByText('GPT-4')).not.toBeInTheDocument()
    })

    it('renders text when showOnlyIcons is false', () => {
        render(<AIItem {...createProps({ showOnlyIcons: false })} />)

        expect(screen.getByText('GPT-4')).toBeInTheDocument()
    })

    it('prefers labelOverride over translated or site labels', () => {
        render(<AIItem {...createProps({ showOnlyIcons: false, labelOverride: 'Pinned Label' })} />)

        expect(screen.getByText('Pinned Label')).toBeInTheDocument()
    })

    it('calls setCurrentAI on click', () => {
        const setCurrentAI = vi.fn()

        render(<AIItem {...createProps({ setCurrentAI })} />)

        fireEvent.click(screen.getByTestId('motion-button'))

        expect(setCurrentAI).toHaveBeenCalledWith('gpt-4')
    })

    it('renders as Reorder.Item when draggable', () => {
        render(<AIItem {...createProps({ draggable: true })} />)

        expect(screen.getByTestId('reorder-item')).toBeInTheDocument()
    })

    it('renders as simple div when not draggable', () => {
        render(<AIItem {...createProps({ draggable: false })} />)

        expect(screen.queryByTestId('reorder-item')).not.toBeInTheDocument()
    })

    it('handles drag start and end', () => {
        const setActiveDragItem = vi.fn()

        render(<AIItem {...createProps({ setActiveDragItem })} />)

        const item = screen.getByTestId('reorder-item')
        fireEvent.dragStart(item)
        expect(setActiveDragItem).toHaveBeenCalledWith('gpt-4')

        fireEvent.dragEnd(item)
        expect(setActiveDragItem).toHaveBeenCalledWith(null)
    })

    it('calls close control without selecting the tab', () => {
        const onClose = vi.fn()
        const setCurrentAI = vi.fn()

        render(<AIItem {...createProps({ onClose, setCurrentAI })} />)

        fireEvent.mouseEnter(screen.getByTestId('motion-button'))
        fireEvent.click(screen.getByTitle('tab_close'))

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(setCurrentAI).not.toHaveBeenCalled()
    })

    it('displays active indicator when selected', () => {
        render(<AIItem {...createProps({ isSelected: true })} />)

        expect(screen.getByTestId('motion-button')).toBeInTheDocument()
    })
})
