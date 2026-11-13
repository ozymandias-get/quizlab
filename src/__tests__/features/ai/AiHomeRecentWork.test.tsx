import { createRecentAiWorkEntry, recordRecentAiWork } from '@features/ai/lib/recentWork'
import AiHomePage from '@features/ai/ui/AiHomePage'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@app/providers/ai-context', () => ({
  useAiModelsCatalog: () => ({
    aiSites: WEB_AI_REGISTRY,
    enabledModels: ['chatgpt', 'claude'],
    favoriteModels: []
  }),
  useAiModelActions: () => ({ setEnabledModels: vi.fn(), setFavoriteModels: vi.fn() }),
  useAiTabsSliceState: () => ({ tabs: [], activeTabId: '' })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function recentSection() {
  const toggle = screen.getByRole('button', { name: /ai_home.recent_title/ })
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(toggle)
  }
  return within(toggle.closest('section')!)
}

describe('AI Home recent work', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.RECENT_AI_WORK)
  })

  it('explains the empty state before anything has been sent', () => {
    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(recentSection().getByText('ai_home.recent_empty')).toBeInTheDocument()
  })

  it('shows the AI site and the PDF used, and resumes that exact chat URL', () => {
    const entry = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/abc',
      Date.now(),
      'Biyoloji Notları.pdf'
    )
    if (!entry) throw new Error('entry expected')
    recordRecentAiWork(entry)

    const open = vi.fn()
    render(<AiHomePage onOpenModel={open} />)
    const section = recentSection()

    expect(section.getByText('ChatGPT')).toBeInTheDocument()
    expect(section.getByText('Biyoloji Notları.pdf')).toBeInTheDocument()
    expect(section.getByText('ai_home.recent_just_now')).toBeInTheDocument()
    expect(section.queryByText('chatgpt.com/c/abc')).not.toBeInTheDocument()

    fireEvent.click(section.getByRole('button', { name: /ai_home.recent_open/ }))
    expect(open).toHaveBeenCalledWith('chatgpt', 'https://chatgpt.com/c/abc')
  })

  it('labels sends that did not come from a PDF', () => {
    const entry = createRecentAiWorkEntry('claude', 'https://claude.ai/chat/1')
    if (!entry) throw new Error('entry expected')
    recordRecentAiWork(entry)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(recentSection().getByText('ai_home.recent_no_document')).toBeInTheDocument()
  })

  it('removes a history entry from the card itself', async () => {
    const entry = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/abc',
      Date.now(),
      'Fizik.pdf'
    )
    if (!entry) throw new Error('entry expected')
    recordRecentAiWork(entry)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    expect(recentSection().getByText('Fizik.pdf')).toBeInTheDocument()

    fireEvent.click(recentSection().getByRole('button', { name: /ai_home.recent_remove/ }))

    expect(recentSection().queryByText('Fizik.pdf')).not.toBeInTheDocument()
    expect(recentSection().getByText('ai_home.recent_empty')).toBeInTheDocument()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByRole('button', { name: /ai_home.recent_title/ })).toHaveFocus()
  })
})
