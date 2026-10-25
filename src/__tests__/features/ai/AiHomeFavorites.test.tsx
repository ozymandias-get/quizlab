import AiHomePage from '@features/ai/ui/AiHomePage'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockFavorites: string[] = []
let mockEnabled = ['chatgpt', 'claude', 'poe']
const mockReorder = vi.fn()
const mockSetEnabled = vi.fn()

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({
    aiSites: WEB_AI_REGISTRY,
    enabledModels: mockEnabled,
    favoriteModels: mockFavorites
  }),
  useAiModelActions: () => ({ setEnabledModels: mockSetEnabled, setFavoriteModels: mockReorder }),
  useAiTabsSliceState: () => ({ tabs: [], activeTabId: '' })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function favoritesSection() {
  const section = screen
    .getByRole('button', { name: /ai_home.favorites_title/ })
    .closest('section')!
  return within(section)
}

describe('AI Home favorites', () => {
  beforeEach(() => {
    mockFavorites = []
    mockEnabled = ['chatgpt', 'claude', 'poe']
    mockReorder.mockClear()
    mockSetEnabled.mockClear()
  })

  it('lists all 50 services even when only three are enabled, with API Chat kept as a separate card', () => {
    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = within(
      screen.getByRole('button', { name: /ai_home.models_title/ }).closest('section')!
    )
    expect(section.getByText('50')).toBeInTheDocument()
    for (const platform of Object.values(WEB_AI_REGISTRY).filter((p) => p.url && !p.isSite)) {
      expect(
        section.getByRole('button', { name: platform.displayName || platform.name })
      ).toBeInTheDocument()
    }
    expect(section.getByText('api_chat_home_card_title')).toBeInTheDocument()
    expect(mockSetEnabled).not.toHaveBeenCalled()
  })

  it('enables only the selected inactive model when opening it from the catalogue', () => {
    const open = vi.fn()
    render(<AiHomePage onOpenModel={open} />)
    const section = within(
      screen.getByRole('button', { name: /ai_home.models_title/ }).closest('section')!
    )
    fireEvent.click(section.getByRole('button', { name: 'Grok' }))
    expect(mockSetEnabled).toHaveBeenCalledExactlyOnceWith(['chatgpt', 'claude', 'poe', 'grok'])
    expect(open).toHaveBeenCalledExactlyOnceWith('grok')
  })

  it('does not enable disabled services while reordering the full catalogue', () => {
    mockEnabled = ['chatgpt', 'claude', 'api-chat', 'youtube']
    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = within(
      screen.getByRole('button', { name: /ai_home.models_title/ }).closest('section')!
    )
    fireEvent.dragStart(section.getByRole('button', { name: 'Poe' }).closest('[draggable]')!)
    const chatgpt = section.getByRole('button', { name: 'ChatGPT' }).closest('[draggable]')!
    fireEvent.dragOver(chatgpt, { dataTransfer: { dropEffect: 'move' } })
    fireEvent.drop(chatgpt)
    expect(mockSetEnabled).toHaveBeenCalledExactlyOnceWith([
      'chatgpt',
      'claude',
      'api-chat',
      'youtube'
    ])
  })

  it('explains how to add favorites when the list is empty', () => {
    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(favoritesSection().getByText('ai_home.favorites_empty')).toBeInTheDocument()
    expect(favoritesSection().queryByText('api_chat_home_card_title')).not.toBeInTheDocument()
  })

  it('opens a favorite and hides disabled or deleted favorites without injecting an API card', () => {
    mockFavorites = ['poe', 'grok', 'removed-service']
    const open = vi.fn()
    render(<AiHomePage onOpenModel={open} />)
    const section = favoritesSection()
    fireEvent.click(section.getByRole('button', { name: 'Poe' }))
    expect(open).toHaveBeenCalledWith('poe')
    expect(section.queryByRole('button', { name: 'Grok' })).not.toBeInTheDocument()
    expect(section.queryByText('api_chat_home_card_title')).not.toBeInTheDocument()
  })

  it('reorders favorites independently of the full model list', () => {
    mockFavorites = ['poe', 'claude', 'grok']
    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = favoritesSection()
    fireEvent.dragStart(section.getByRole('button', { name: 'Poe' }).closest('[draggable]')!)
    const claude = section.getByRole('button', { name: 'Claude' }).closest('[draggable]')!
    fireEvent.dragOver(claude, { dataTransfer: { dropEffect: 'move' } })
    fireEvent.drop(claude)
    expect(mockReorder).toHaveBeenCalledWith(['claude', 'poe', 'grok'])
  })
})
