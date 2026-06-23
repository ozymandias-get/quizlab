import AiWebview from '@features/ai/ui/AiWebview'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  useAiTabsSliceState: () => ({
    tabs: mockAiState.tabs,
    activeTabId: mockAiState.activeTabId,
    currentAI: 'gpt-4'
  }),
  useAiViewRequestNonce: () => mockAiState.aiViewRequestNonce,
  useAiSessionUiPrefsState: () => ({
    isTutorialActive: mockAiState.isTutorialActive
  }),
  useAiTabActions: () => ({
    openAiWorkspace: mockAiState.openAiWorkspace
  }),
  useAiSessionActions: () => ({
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
      {String((tab as unknown as Record<string, string>).title || tab.id)} -{' '}
      {isActive ? 'Active' : 'Inactive'}
    </div>
  )
}))

vi.mock('@features/ai/ui/AiTabStrip', () => ({
  default: () => <div data-testid="ai-tab-strip">Tab Strip</div>
}))

vi.mock('@features/tutorial/ui/MagicSelectorTutorial', () => ({
  default: () => <div data-testid="tutorial-overlay">Tutorial Active</div>
}))

describe('AiWebview', () => {
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

  it('mounts only the active tab session on initial render (others hibernated)', () => {
    mockAiState.activeTabId = '1'
    mockAiState.tabs = [
      { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
      { id: '2', modelId: 'claude-3', title: 'Claude 3', pinned: true },
      { id: '3', modelId: 'deepseek', title: 'DeepSeek' }
    ]

    render(<AiWebview isResizing={false} isBarHovered={false} />)
    expect(screen.getByTestId('ai-tab-strip')).toBeInTheDocument()

    expect(screen.getByText('GPT-4 - Active')).toBeInTheDocument()

    // Only the active tab mounts until other tab ids enter `aliveTabIds` (e.g. after switching).
    expect(screen.queryByText('Claude 3 - Inactive')).not.toBeInTheDocument()

    expect(screen.queryByText('DeepSeek - Inactive')).not.toBeInTheDocument()
  })

  it('renders tutorial overlay when active', async () => {
    mockAiState.isTutorialActive = true
    render(<AiWebview isResizing={false} isBarHovered={false} />)
    expect(await screen.findByTestId('tutorial-overlay', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('applies pointer-events-none when resizing', () => {
    const { container } = render(<AiWebview isResizing isBarHovered={false} />)
    const innerDiv = container.querySelector('.panel-3d-right') as HTMLElement
    expect(innerDiv).toHaveStyle({ pointerEvents: 'none' })
  })
})
