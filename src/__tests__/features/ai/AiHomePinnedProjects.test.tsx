import { createPinnedAiProject, savePinnedAiProject } from '@features/ai/lib/pinnedProjects'
import AiHomePage from '@features/ai/ui/AiHomePage'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({
    aiSites: WEB_AI_REGISTRY,
    enabledModels: ['chatgpt'],
    favoriteModels: []
  }),
  useAiModelActions: () => ({ setEnabledModels: vi.fn(), setFavoriteModels: vi.fn() }),
  useAiTabsSliceState: () => ({ tabs: [], activeTabId: '' })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

function pinnedSection() {
  const toggle = screen.getByRole('button', { name: /ai_home.pinned_title/ })
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(toggle)
  }
  return within(toggle.closest('section')!)
}

describe('AI Home pinned projects', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.PINNED_AI_PROJECTS)
  })

  it('explains the empty state', () => {
    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(pinnedSection().getByText('ai_home.pinned_empty')).toBeInTheDocument()
  })

  it('shows the custom name with the AI icon and opens the saved URL', () => {
    const project = createPinnedAiProject('chatgpt', 'Biyoloji sunumu', 'https://chatgpt.com/c/abc')
    if (!project) throw new Error('project expected')
    savePinnedAiProject(project)

    const open = vi.fn()
    render(<AiHomePage onOpenModel={vi.fn()} onOpenPinned={open} />)
    const section = pinnedSection()

    expect(section.getByText('Biyoloji sunumu')).toBeInTheDocument()
    expect(section.getByText('ChatGPT')).toBeInTheDocument()
    expect(section.queryByText('chatgpt.com/c/abc')).not.toBeInTheDocument()

    fireEvent.click(section.getByRole('button', { name: /ai_home.pinned_open/ }))
    expect(open).toHaveBeenCalledWith('chatgpt', 'https://chatgpt.com/c/abc')
  })

  it('removes a pin from the card', () => {
    const project = createPinnedAiProject('chatgpt', 'Silinecek', 'https://chatgpt.com/c/abc')
    if (!project) throw new Error('project expected')
    savePinnedAiProject(project)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(pinnedSection().getByText('Silinecek')).toBeInTheDocument()

    fireEvent.click(pinnedSection().getByRole('button', { name: /ai_home.pinned_remove/ }))

    expect(pinnedSection().queryByText('Silinecek')).not.toBeInTheDocument()
    expect(pinnedSection().getByText('ai_home.pinned_empty')).toBeInTheDocument()
  })
})
