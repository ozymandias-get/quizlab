import type { AiViewSurfaceState } from '@features/ai/hooks/useAiViewSurfaceState'

import AiViewSurface from '@features/ai/ui/AiViewSurface'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MockAiState {
  tabs: Array<{ id: string; modelId: string; title?: string; pinned?: boolean }>
  activeTabId: string
  isTutorialActive: boolean
  openAiWorkspace: ReturnType<typeof vi.fn>
  stopTutorial: ReturnType<typeof vi.fn>
}

let mockAiState: MockAiState = {
  tabs: [],
  activeTabId: '1',
  isTutorialActive: false,
  openAiWorkspace: vi.fn(),
  stopTutorial: vi.fn()
}

vi.mock('@app/providers/ai-context', () => ({
  useAiTabsSliceState: () => ({
    tabs: mockAiState.tabs,
    activeTabId: mockAiState.activeTabId,
    currentAI: 'gpt-4'
  }),
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
    isActive,
    isSurfaceActive,
    isOverlayActive
  }: {
    tab: { id: string; title?: string }
    isActive: boolean
    isSurfaceActive: boolean
    isOverlayActive: boolean
  }) => (
    <div data-testid={`ai-session-${tab.id}`}>
      {tab.title || tab.id} - {isActive ? 'Active' : 'Inactive'}
      {isSurfaceActive ? ' - Owner' : ' - Passive'}
      {isOverlayActive ? ' - Overlay' : ''}
    </div>
  )
}))

vi.mock('@features/ai/ui/AiTabStrip', () => ({
  default: () => <div data-testid="ai-tab-strip">Tab Strip</div>
}))

vi.mock('@features/tutorial/ui/MagicSelectorTutorial', () => ({
  default: () => <div data-testid="tutorial-overlay">Tutorial Active</div>
}))

function createSurfaceState(overrides: Partial<AiViewSurfaceState> = {}): AiViewSurfaceState {
  return {
    aliveTabIds: ['1'],
    showHome: false,
    showHideHome: { show: vi.fn(), hide: vi.fn() },
    coldTabIds: new Set<string>(),
    recordTabUrl: vi.fn(),
    getRestoredUrl: () => undefined,
    ...overrides
  }
}

const renderSurface = (overrides: Partial<AiViewSurfaceState> = {}, isSurfaceActive = true) =>
  render(
    <AiViewSurface
      isResizing={false}
      isBarHovered={false}
      isSurfaceActive={isSurfaceActive}
      surfaceState={createSurfaceState(overrides)}
    />
  )

describe('AiViewSurface', () => {
  beforeEach(() => {
    mockAiState = {
      tabs: [
        { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
        { id: '2', modelId: 'claude-3', title: 'Claude 3' }
      ],
      activeTabId: '1',
      isTutorialActive: false,
      openAiWorkspace: vi.fn(),
      stopTutorial: vi.fn()
    }
  })

  it('mounts only tabs that are alive', () => {
    mockAiState.tabs = [
      { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
      { id: '2', modelId: 'claude-3', title: 'Claude 3', pinned: true },
      { id: '3', modelId: 'deepseek', title: 'DeepSeek' }
    ]

    renderSurface({ aliveTabIds: ['1'] })

    expect(screen.getByTestId('ai-tab-strip')).toBeInTheDocument()
    expect(screen.getByText('GPT-4 - Active - Owner')).toBeInTheDocument()
    expect(screen.queryByText('Claude 3 - Inactive - Owner')).not.toBeInTheDocument()
    expect(screen.queryByText('DeepSeek - Inactive - Owner')).not.toBeInTheDocument()
  })

  it('keeps a background tab mounted but inactive while it is alive', () => {
    renderSurface({ aliveTabIds: ['1', '2'] })

    expect(screen.getByText('GPT-4 - Active - Owner')).toBeInTheDocument()
    expect(screen.getByText('Claude 3 - Inactive - Owner')).toBeInTheDocument()
  })

  it('marks every session as an overlay when AI Home is open', () => {
    renderSurface({ aliveTabIds: ['1'], showHome: true })
    expect(screen.getByText('GPT-4 - Inactive - Owner - Overlay')).toBeInTheDocument()
  })

  it('marks every session as an overlay while the tutorial is up', async () => {
    mockAiState.isTutorialActive = true
    renderSurface({ aliveTabIds: ['1'] })
    expect(screen.getByText('GPT-4 - Active - Owner - Overlay')).toBeInTheDocument()
    expect(await screen.findByTestId('tutorial-overlay', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('renders a non-owning surface so a stale host cannot move the active view', () => {
    renderSurface({ aliveTabIds: ['1'] }, false)
    expect(screen.getByText('GPT-4 - Active - Passive')).toBeInTheDocument()
  })

  it('applies pointer-events-none when resizing', () => {
    const { container } = render(
      <AiViewSurface
        isResizing
        isBarHovered={false}
        isSurfaceActive
        surfaceState={createSurfaceState()}
      />
    )
    const innerDiv = container.querySelector('.panel-3d-right') as HTMLElement
    expect(innerDiv).toHaveStyle({ pointerEvents: 'none' })
  })
})
