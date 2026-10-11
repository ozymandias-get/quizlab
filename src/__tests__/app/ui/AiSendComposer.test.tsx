import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AiSendComposer from '@app/ui/AiSendComposer'
import { TooltipProvider } from '@shared/ui/components/primitives'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'ai_draft_badge' && opts?.count !== undefined)
        return `ai_draft_badge · ${opts.count}`
      return key
    },
    i18n: { language: 'en' }
  })
}))

vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  const { useState } = await import('react')
  return {
    ...actual,
    useLocalStorage: <T,>(_key: string, initialValue: T) => useState(initialValue)
  }
})

vi.mock('@features/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai')>()
  return {
    ...actual,
    usePrompts: () => ({
      allPrompts: [],
      activePromptText: null,
      selectedPromptId: null,
      addPrompt: vi.fn(),
      deletePrompt: vi.fn(),
      selectPrompt: vi.fn(),
      clearSelection: vi.fn()
    }),
    useQuickAiPresets: () => ({ presets: [], primaryPresets: [], secondaryPresets: [] })
  }
})

vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    aside: ({ children, ...props }: Record<string, unknown>) => {
      const { children: _c, ...rest } = { children, ...props }
      return (
        <aside {...(rest as React.HTMLAttributes<HTMLElement>)}>
          {children as React.ReactNode}
        </aside>
      )
    },
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { children: _c, ...rest } = { children, ...props }
      return (
        <div {...(rest as React.HTMLAttributes<HTMLElement>)}>{children as React.ReactNode}</div>
      )
    }
  }
}))

function textItem(id: string, text: string) {
  return { id, type: 'text' as const, text }
}

/** Uygulamada `AppProviders` global bir TooltipProvider sağlar; testte de öyle. */
const renderComposer = (ui: React.ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)

describe('AiSendComposer (compact draft)', () => {
  it('always renders the small badge control, even with items', () => {
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
    )
    expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
    // Panel kendiliğinden açılmaz.
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
  })

  it('opens the panel on badge click without clearing the draft', () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    expect(onClearAll).not.toHaveBeenCalled()
  })

  it('keeps the draft when the panel is closed', () => {
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
  })

  it('renders compact rows with page info and per-item remove (no gallery)', () => {
    const onRemoveItem = vi.fn()
    renderComposer(
      <AiSendComposer
        items={[
          {
            id: 't1',
            type: 'text',
            text: 'hello',
            source: {
              docId: 'doc',
              page: 13,
              totalPages: 59,
              captureKind: 'text-selection',
              createdAt: 1
            }
          } as never
        ]}
        onClearAll={vi.fn()}
        onRemoveItem={onRemoveItem}
        onSend={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByTestId('ai-draft-item')).toHaveTextContent('Sayfa 13/59')
    expect(screen.queryByTestId('ai-send-attachment-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-send-attachment-preview')).not.toBeInTheDocument()
  })

  it('sends with the composer note and autoSend flag', async () => {
    const onSend = vi.fn().mockResolvedValue({ success: true })
    renderComposer(
      <AiSendComposer
        items={[textItem('t1', 'hello')]}
        onClearAll={vi.fn()}
        onSend={onSend}
        autoSend={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    const note = screen.getByLabelText('ai_draft_note_label')
    fireEvent.change(note, { target: { value: 'explain' } })
    const sendButtons = screen.getAllByRole('button', { name: 'send_to_ai' })
    await act(async () => {
      fireEvent.click(sendButtons[0])
    })
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ autoSend: false, noteText: 'explain' })
    )
  })

  it('clears the draft in one click, without a confirmation dialog', () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    fireEvent.click(screen.getByRole('button', { name: 'ai_send_clear_all' }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
    // Onay diyaloğu yok: tek tık yeterli, diyalog katmanı bir ekran daha açmıyor.
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('disables the trash button when there is nothing to clear', () => {
    renderComposer(<AiSendComposer items={[]} onClearAll={vi.fn()} onSend={vi.fn()} />)
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByRole('button', { name: 'ai_send_clear_all' })).toBeDisabled()
  })
})
