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

vi.mock('@app/providers/ai-context', () => ({
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

let mockMaxAliveTabs = 1

vi.mock('@features/ai/hooks/useAiLifecycleSettings', () => ({
  useAiLifecycleSettings: () => ({
    maxAliveTabs: mockMaxAliveTabs,
    sleepTimeoutMs: 60_000,
    isNeverSleepSite: () => false
  })
}))

vi.mock('@features/tutorial/ui/MagicSelectorTutorial', () => ({
  default: () => <div data-testid="tutorial-overlay">Tutorial Active</div>
}))

describe('AiWebview', () => {
  beforeEach(() => {
    mockMaxAliveTabs = 1
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

describe('AiWebview maxAliveTabs enforcement', () => {
  const threeTabs = [
    { id: '1', modelId: 'gpt-4', title: 'GPT-4' },
    { id: '2', modelId: 'claude-3', title: 'Claude 3' },
    { id: '3', modelId: 'deepseek', title: 'DeepSeek' }
  ]

  const setState = (overrides: Partial<MockAiState>) => {
    mockAiState = {
      tabs: threeTabs,
      activeTabId: '1',
      aiViewRequestNonce: 0,
      isTutorialActive: false,
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      openAiWorkspace: vi.fn(),
      stopTutorial: vi.fn(),
      ...overrides
    }
  }

  const mountedSessions = () =>
    ['1', '2', '3'].filter((id) => screen.queryByTestId(`ai-session-${id}`) !== null)

  /** Switches the active tab; the prop flip also defeats React.memo. */
  const switchTo = (
    rerender: (ui: React.ReactElement) => void,
    view: { isResizing: boolean },
    tabId: string
  ) => {
    setState({ activeTabId: tabId })
    view.isResizing = !view.isResizing
    rerender(<AiWebview isResizing={view.isResizing} isBarHovered={false} />)
  }

  beforeEach(() => {
    mockAiState = {
      tabs: threeTabs,
      activeTabId: '1',
      aiViewRequestNonce: 0,
      isTutorialActive: false,
      setActiveTab: vi.fn(),
      addTab: vi.fn(),
      openAiWorkspace: vi.fn(),
      stopTutorial: vi.fn()
    }
  })

  it('keeps only the active session alive when maxAliveTabs is 1', () => {
    mockMaxAliveTabs = 1
    setState({ activeTabId: '1' })

    const view = { isResizing: false }
    const { rerender } = render(<AiWebview isResizing={false} isBarHovered={false} />)
    expect(mountedSessions()).toEqual(['1'])

    switchTo(rerender, view, '2')
    // The previous session must be unmounted, not merely hidden: an unmounted
    // <webview> releases its WebContents, a hidden one keeps a live renderer.
    expect(mountedSessions()).toEqual(['2'])

    switchTo(rerender, view, '3')
    expect(mountedSessions()).toEqual(['3'])
  })

  it('keeps at most two sessions alive when maxAliveTabs is 2', () => {
    mockMaxAliveTabs = 2
    setState({ activeTabId: '1' })

    const view = { isResizing: false }
    const { rerender } = render(<AiWebview isResizing={false} isBarHovered={false} />)
    expect(mountedSessions()).toEqual(['1'])

    switchTo(rerender, view, '2')
    expect(mountedSessions()).toEqual(['1', '2'])

    // Third tab evicts the least recently used session.
    switchTo(rerender, view, '3')
    expect(mountedSessions().sort()).toEqual(['2', '3'])
  })

  it('never exceeds maxAliveTabs across 50 tab switches', () => {
    mockMaxAliveTabs = 1
    setState({ activeTabId: '1' })

    const view = { isResizing: false }
    const { rerender } = render(<AiWebview isResizing={false} isBarHovered={false} />)

    let lastTabId = '1'
    for (let i = 0; i < 50; i++) {
      lastTabId = threeTabs[i % threeTabs.length].id
      switchTo(rerender, view, lastTabId)
      expect(mountedSessions().length).toBeLessThanOrEqual(1)
    }

    // Exactly one session survives, and it is the one the user is looking at.
    expect(mountedSessions()).toEqual([lastTabId])
  })
})
