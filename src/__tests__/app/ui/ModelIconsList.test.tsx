import { ModelIconsList } from '@app/ui/BottomBar/FloatingDockToolButtons'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockEnabled = Object.keys(WEB_AI_REGISTRY)
let mockLimit = 5
let mockFavorites: string[] = []
const mockOpenWorkspace = vi.fn()

vi.mock('@features/pdf', () => ({ usePdfTabStore: vi.fn() }))
vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: vi.fn(),
  hasEnabledSiteSession: vi.fn(),
  hasSiteSessionNeedingAttention: vi.fn()
}))
vi.mock('@app/providers', () => ({
  useAppearance: (select: (state: { bottomBarMaxIcons: number }) => unknown) =>
    select({ bottomBarMaxIcons: mockLimit }),
  useAppToolActions: vi.fn(),
  useAppToolPickerState: vi.fn()
}))
vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({
    enabledModels: mockEnabled,
    favoriteModels: mockFavorites,
    aiSites: WEB_AI_REGISTRY
  }),
  useAiTabActions: () => ({ openAiWorkspace: mockOpenWorkspace }),
  useAiTabsSliceState: () => ({ tabs: [], activeTabId: '' })
}))
vi.mock('@app/ui/BottomBar/FloatingDockIcon', () => ({
  FloatingDockIcon: ({
    title,
    children,
    onClick
  }: {
    title: string
    children: ReactNode
    onClick: () => void
  }) => (
    <button aria-label={title} onClick={onClick}>
      {children}
    </button>
  )
}))

describe('catalogue dock shortcuts', () => {
  beforeEach(() => {
    mockEnabled = Object.keys(WEB_AI_REGISTRY)
    mockLimit = 5
    mockFavorites = []
    mockOpenWorkspace.mockClear()
  })

  it('shows only five shortcuts even when all 50 web chats are enabled', () => {
    render(<ModelIconsList visibleModels={{}} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Poe' })).not.toBeInTheDocument()
  })

  it('shows a new service only after separate shortcut selection', () => {
    mockEnabled = ['chatgpt', 'poe', 'you']
    const { unmount } = render(<ModelIconsList visibleModels={{}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    unmount()
    render(<ModelIconsList visibleModels={{ poe: true }} />)
    expect(screen.getByRole('button', { name: 'Poe' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'You.com' })).not.toBeInTheDocument()
  })

  it('prioritizes favorites and keeps every favorite reachable past the visible icon limit', () => {
    mockFavorites = ['poe', 'you', 'lumo', 'venice', 'pi', 'character']
    const { container } = render(<ModelIconsList visibleModels={{}} />)
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Poe', 'You.com', 'Lumo', 'Venice', 'Pi', 'Character.AI'])
    expect(container.firstElementChild).toHaveClass('overflow-y-auto')
    // The height cap follows the icon limit (5 * 36 + 8), not the longer
    // favorites list; the viewport clamp comes second so the dock can never
    // exceed the window.
    expect((container.firstElementChild as HTMLElement).style.maxHeight).toContain('188px')
    fireEvent.click(screen.getByRole('button', { name: 'Character.AI' }))
    expect(mockOpenWorkspace).toHaveBeenCalledWith('character')
  })
})
