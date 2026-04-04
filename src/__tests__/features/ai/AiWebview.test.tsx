import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AiWebview from '@features/ai/ui/AiWebview'

interface MockAiState {
  tabs: Array<{ id: string; modelId: string; title?: string; pinned?: boolean }>
  activeTabId: string
  aiViewRequestNonce: number
  isTutorialActive: boolean
  setActiveTab: any
  addTab: any
  openAiWorkspace: any
  stopTutorial: any
}

let mockAiState: MockAiState = {
  tabs: [
    { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
    { id: '2', modelId: 'claude-3', title: 'Claude 3' }
  ],
  activeTabId: '1',
  aiViewRequestNonce: 0,
  isTutorialActive: false,
  setActiveTab: vi.fn(),
  addTab: vi.fn(),
  openAiWorkspace: vi.fn(),
  stopTutorial: vi.fn()
}

vi.mock('@app/providers/AiContext', () => ({
  useAi: () => mockAiState,
  useAiState: () => ({
    tabs: mockAiState.tabs,
    activeTabId: mockAiState.activeTabId,
    aiViewRequestNonce: mockAiState.aiViewRequestNonce,
    isTutorialActive: mockAiState.isTutorialActive
  }),
  useAiActions: () => ({
    setActiveTab: mockAiState.setActiveTab,
    addTab: mockAiState.addTab,
    openAiWorkspace: mockAiState.openAiWorkspace,
    stopTutorial: mockAiState.stopTutorial
  })
}))

vi.mock('@features/ai/ui/AiSession', () => ({
  default: ({
    tab,
    isActive
  }: {
    tab: import('@shared-core/types').AiPlatform
    isActive: boolean
  }) => (
    <div data-testid={`ai-session-${tab.id}`}>
      {String((tab as any).title || tab.id)} - {isActive ? 'Active' : 'Inactive'}
    </div>
  )
}))

vi.mock('@features/ai/ui/AiTabStrip', () => ({
  default: () => <div data-testid="ai-tab-strip">Tab Strip</div>
}))

vi.mock('@features/tutorial/ui/MagicSelectorTutorial', () => ({
  default: () => <div data-testid="tutorial-overlay">Tutorial Active</div>
}))

describe('AiWebview Component', () => {
  beforeEach(() => {
    mockAiState = {
      tabs: [
        { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
        { id: '2', modelId: 'claude-3', title: 'Claude 3' }
      ],
      activeTabId: '1',
      aiViewRequestNonce: 0,
      isTutorialActive: false,
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      openAiWorkspace: vi.fn(),
      stopTutorial: vi.fn()
    }
  })

  it('hibernates completely inactive/unpinned tabs to save RAM', () => {
    mockAiState.activeTabId = '1'
    mockAiState.tabs = [
      { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
      { id: '2', modelId: 'claude-3', title: 'Claude 3', pinned: true },
      { id: '3', modelId: 'deepseek', title: 'DeepSeek' }
    ]

    render(<AiWebview isResizing={false} isBarHovered={false} />)
    expect(screen.getByTestId('ai-tab-strip')).toBeInTheDocument()

    expect(screen.getByText('GPT-4 - Active')).toBeInTheDocument()

    expect(screen.getByText('Claude 3 - Inactive')).toBeInTheDocument()

    expect(screen.queryByText('DeepSeek - Inactive')).not.toBeInTheDocument()
  })

  it('renders tutorial overlay when active', async () => {
    mockAiState.isTutorialActive = true
    render(<AiWebview isResizing={false} isBarHovered={false} />)
    await waitFor(() => {
      expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument()
    })
  })

  it('applies pointer-events-none when resizing', () => {
    const { container } = render(<AiWebview isResizing={true} isBarHovered={false} />)
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv).toHaveStyle({ pointerEvents: 'none' })
  })

  it('applies clip-path style', () => {
    const { container } = render(<AiWebview isResizing={false} isBarHovered={false} />)
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv.style.clipPath).toContain('inset(0 round 1.5rem)')
  })
})
