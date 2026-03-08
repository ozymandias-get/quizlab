import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AiWebview from '@features/ai/ui/AiWebview'

interface MockAiState {
    tabs: Array<{ id: string; modelId: string; title?: string; pinned?: boolean }>;
    activeTabId: string;
    isTutorialActive: boolean;
    setActiveTab: any;
    addTab: any;
    stopTutorial: any;
}

// Setup a mock store to control returned values
let mockAiState: MockAiState = {
    tabs: [
        { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
        { id: '2', modelId: 'claude-3', title: 'Claude 3' },
    ],
    activeTabId: '1',
    isTutorialActive: false,
    setActiveTab: vi.fn(),
    addTab: vi.fn(),
    stopTutorial: vi.fn(),
}

// Mock Ai context hooks to return the mutable state
vi.mock('@app/providers/AiContext', () => ({
    useAi: () => mockAiState,
    useAiState: () => ({
        tabs: mockAiState.tabs,
        activeTabId: mockAiState.activeTabId,
        isTutorialActive: mockAiState.isTutorialActive,
    }),
    useAiActions: () => ({
        setActiveTab: mockAiState.setActiveTab,
        addTab: mockAiState.addTab,
        stopTutorial: mockAiState.stopTutorial,
    }),
}))

// Mock Subcomponents
vi.mock('@features/ai/ui/AiSession', () => ({
    default: ({ tab, isActive }: { tab: import('@shared-core/types').AiPlatform, isActive: boolean }) => (
        <div data-testid={`ai-session-${tab.id}`}>
            {String((tab as any).title || tab.id)} - {isActive ? 'Active' : 'Inactive'}
        </div>
    ),
}))

vi.mock('@features/ai/ui/AiTabStrip', () => ({
    default: () => <div data-testid="ai-tab-strip">Tab Strip</div>
}))

vi.mock('@features/tutorial/ui/MagicSelectorTutorial', () => ({
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
            setActiveTab: vi.fn(),
            addTab: vi.fn(),
            stopTutorial: vi.fn(),
        }
    })

    it('hibernates completely inactive/unpinned tabs to save RAM', () => {
        // Mock a pinned tab, an active tab, and an inactive unpinned tab
        mockAiState.activeTabId = '1'
        mockAiState.tabs = [
            { id: '1', modelId: 'gpt-4', title: 'GPT-4' }, // active
            { id: '2', modelId: 'claude-3', title: 'Claude 3', pinned: true }, // pinned, inactive
            { id: '3', modelId: 'deepseek', title: 'DeepSeek' }, // unpinned, inactive
        ]

        render(<AiWebview isResizing={false} isBarHovered={false} />)
        expect(screen.getByTestId('ai-tab-strip')).toBeInTheDocument()

        // Active tab must render
        expect(screen.getByText('GPT-4 - Active')).toBeInTheDocument()

        // Pinned tab must render
        expect(screen.getByText('Claude 3 - Inactive')).toBeInTheDocument()

        // Untouched, unpinned inactive tab must be hibernated (unmounted)
        expect(screen.queryByText('DeepSeek - Inactive')).not.toBeInTheDocument()
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


