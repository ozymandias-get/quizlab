import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiWebview from '@src/features/ai/components/AiWebview'

// Setup a mock store to control returned values
let mockAiState = {
    tabs: [
        { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
        { id: '2', modelId: 'claude-3', title: 'Claude 3' },
    ],
    activeTabId: '1',
    isTutorialActive: false,
    stopTutorial: vi.fn(),
}

// Mock useAi to return the mutable state
vi.mock('@src/app/providers', () => ({
    useAi: () => mockAiState,
    useToast: () => ({ showWarning: vi.fn() }),
    useLanguage: () => ({ t: (key: string) => key }),
}))

// Mock Subcomponents
vi.mock('@src/features/ai/components/AiSession', () => ({
    default: ({ tab, isActive }: { tab: any, isActive: boolean }) => (
        <div data-testid={`ai-session-${tab.id}`}>
            {tab.title} - {isActive ? 'Active' : 'Inactive'}
        </div>
    ),
}))

vi.mock('@src/features/tutorial/components/MagicSelectorTutorial', () => ({
    default: () => <div data-testid="tutorial-overlay">Tutorial Active</div>,
}))

describe('AiWebview Component', () => {
    beforeEach(() => {
        // Reset state before each test
        mockAiState = {
            tabs: [
                { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
                { id: '2', modelId: 'claude-3', title: 'Claude 3' },
            ],
            activeTabId: '1',
            isTutorialActive: false,
            stopTutorial: vi.fn(),
        }
    })

    it('renders all AI tabs', () => {
        render(<AiWebview isResizing={false} isBarHovered={false} />)
        expect(screen.getByText('GPT-4 - Active')).toBeInTheDocument()
        expect(screen.getByText('Claude 3 - Inactive')).toBeInTheDocument()
    })

    it('renders tutorial overlay when active', () => {
        mockAiState.isTutorialActive = true
        render(<AiWebview isResizing={false} isBarHovered={false} />)
        expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument()
    })

    it('applies pointer-events-none when resizing', () => {
        const { container } = render(<AiWebview isResizing={true} isBarHovered={false} />)
        // The outer div should have pointer-events: none
        // It's the first child of the fragment/container usually
        const outerDiv = container.firstChild as HTMLElement
        expect(outerDiv).toHaveStyle({ pointerEvents: 'none' })
    })

    it('applies clip-path style', () => {
        const { container } = render(<AiWebview isResizing={false} isBarHovered={false} />)
        const outerDiv = container.firstChild as HTMLElement
        // Check for the clip-path style which is important for rounded corners on webviews
        expect(outerDiv.style.clipPath).toContain('inset(0 round 1.5rem)')
    })
})
