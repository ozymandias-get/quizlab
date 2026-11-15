import { createRecentAiWorkEntry, recordRecentAiWork } from '@features/ai/lib/recentWork'
import AiHomePage from '@features/ai/ui/AiHomePage'
import { formatLastUsed } from '@features/ai/ui/home/AiHomeRecentWork'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  afterEach(() => {
    vi.useRealTimers()
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

  it('links its toggle to the panel it opens', () => {
    render(<AiHomePage onOpenModel={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: /ai_home.recent_title/ })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).not.toHaveAttribute('aria-controls')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panelId = toggle.getAttribute('aria-controls')
    expect(panelId).not.toBeNull()
    expect(document.getElementById(panelId!)).toBeInTheDocument()
  })

  it('shows one card when several chats were used with the same document', () => {
    const entries = [
      createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/old', 10, '10.Şok.pdf'),
      createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/mid', 20, '10.Şok.pdf'),
      createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/new', 30, '10.Şok.pdf')
    ]
    for (const entry of entries) {
      if (!entry) throw new Error('entry expected')
      recordRecentAiWork(entry)
    }

    const open = vi.fn()
    render(<AiHomePage onOpenModel={open} />)
    const section = recentSection()

    expect(section.getByText('1')).toBeInTheDocument()
    expect(section.getAllByRole('button', { name: /ai_home.recent_open/ })).toHaveLength(1)

    fireEvent.click(section.getByRole('button', { name: /ai_home.recent_open/ }))
    expect(open).toHaveBeenCalledWith('chatgpt', 'https://chatgpt.com/c/new')
  })

  it('keeps the same document under different sites as separate cards', () => {
    const chatgpt = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/1', 10, 'Fizik.pdf')
    const claude = createRecentAiWorkEntry('claude', 'https://claude.ai/chat/2', 20, 'Fizik.pdf')
    if (!chatgpt || !claude) throw new Error('entries expected')
    recordRecentAiWork(chatgpt)
    recordRecentAiWork(claude)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = recentSection()

    expect(section.getByText('2')).toBeInTheDocument()
    expect(section.getAllByRole('button', { name: /ai_home.recent_open/ })).toHaveLength(2)
  })

  it('shows the chat count and updates it when a card is removed', () => {
    const first = createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/1')
    const second = createRecentAiWorkEntry('claude', 'https://claude.ai/chat/2')
    if (!first || !second) throw new Error('entries expected')
    recordRecentAiWork(first)
    recordRecentAiWork(second)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = recentSection()
    expect(section.getByText('2')).toBeInTheDocument()

    fireEvent.click(section.getAllByRole('button', { name: 'ai_home.recent_remove' })[0])

    expect(section.getByText('1')).toBeInTheDocument()
  })

  it('moves focus to the next card when a middle card is removed with the keyboard', async () => {
    const entries = [
      createRecentAiWorkEntry('chatgpt', 'https://chatgpt.com/c/1', 10),
      createRecentAiWorkEntry('claude', 'https://claude.ai/chat/2', 20),
      createRecentAiWorkEntry('gemini', 'https://gemini.google.com/app/3', 30)
    ]
    for (const entry of entries) {
      if (!entry) throw new Error('entry expected')
      recordRecentAiWork(entry)
    }

    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = recentSection()

    section.getAllByRole('button', { name: 'ai_home.recent_remove' })[1].focus()
    fireEvent.click(section.getAllByRole('button', { name: 'ai_home.recent_remove' })[1])

    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(section.getAllByRole('button', { name: 'ai_home.recent_open' })[1]).toHaveFocus()
  })

  it('keeps relative labels fresh while the section stays open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    const entry = createRecentAiWorkEntry(
      'chatgpt',
      'https://chatgpt.com/c/abc',
      Date.now(),
      'Fizik.pdf'
    )
    if (!entry) throw new Error('entry expected')
    recordRecentAiWork(entry)

    render(<AiHomePage onOpenModel={vi.fn()} />)
    const section = recentSection()
    expect(section.getByText('ai_home.recent_just_now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })

    expect(section.getByText('3 minutes ago')).toBeInTheDocument()
  })
})

describe('formatLastUsed', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0)
  const absolute = () => '2026-01-01 12:00'
  const at = (millisecondsAgo: number) => {
    return formatLastUsed(now - millisecondsAgo, now, 'en', 'just now', absolute).relative
  }

  it('keeps the first minute as just now', () => {
    expect(at(0)).toBe('just now')
    expect(at(59_000)).toBe('just now')
  })

  it('counts minutes, hours and days', () => {
    expect(at(5 * 60_000)).toBe('5 minutes ago')
    expect(at(60 * 60_000)).toBe('1 hour ago')
    expect(at(24 * 60 * 60_000)).toBe('yesterday')
    expect(at(3 * 24 * 60 * 60_000)).toBe('3 days ago')
  })

  it('falls back to a short date beyond a week', () => {
    expect(at(8 * 24 * 60 * 60_000)).toMatch(/^Dec \d{1,2}$/)
  })

  it('shows a future timestamp as just now instead of "in 5 minutes"', () => {
    expect(at(-5 * 60_000)).toBe('just now')
  })

  it('does not format a timestamp that is outside the Date range', () => {
    expect(formatLastUsed(Number.MAX_VALUE, now, 'en', 'just now', absolute)).toEqual({
      relative: 'just now',
      absolute: null
    })
  })
})
