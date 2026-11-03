import HistorySessionItem from '@features/ai/ui/chat/HistorySessionItem'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}))

const SESSION = {
  id: 'session-1',
  title: 'Old title',
  messages: [{ content: 'hello' }],
  createdAt: Date.now()
}

function renderItem(overrides: Partial<React.ComponentProps<typeof HistorySessionItem>> = {}) {
  const props: React.ComponentProps<typeof HistorySessionItem> = {
    session: SESSION,
    isActive: false,
    tabId: 'tab-1',
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    editingId: null,
    editTitle: '',
    onStartEdit: vi.fn(),
    onEditTitleChange: vi.fn(),
    onCancelEdit: vi.fn(),
    onConfirmEdit: vi.fn(),
    ...overrides
  }

  render(
    <TooltipProvider>
      <HistorySessionItem {...props} />
    </TooltipProvider>
  )

  return props
}

describe('HistorySessionItem interaction structure', () => {
  it('keeps rename and delete outside the selection button', () => {
    renderItem()

    const select = screen.getByRole('button', { name: /Old title/ })
    const rename = screen.getByRole('button', { name: 'api_chat_rename_tooltip' })
    const remove = screen.getByRole('button', { name: 'api_chat_delete_tooltip' })

    expect(select).not.toContainElement(rename)
    expect(select).not.toContainElement(remove)
    expect(select.closest('[role="button"]')).toBeNull()
  })

  it('disables the delete control while its deletion is running', () => {
    renderItem({ isDeleting: true })

    const remove = screen.getByRole('button', { name: 'api_chat_delete_tooltip' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAttribute('aria-busy', 'true')
  })

  it('does not let a rename and a delete race for the same session', () => {
    renderItem({ editingId: SESSION.id, editTitle: 'New title', isSavingEdit: true })

    const remove = screen.getByRole('button', { name: 'api_chat_delete_tooltip' })
    expect(remove).toBeDisabled()
  })

  it('blocks an empty rename and explains why it cannot be saved', () => {
    const onConfirmEdit = vi.fn()
    renderItem({ editingId: SESSION.id, editTitle: '   ', onConfirmEdit })

    const input = screen.getByRole('textbox')
    const save = screen.getByRole('button', { name: 'api_chat_save' })

    expect(save).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('api_chat_title_required')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    expect(onConfirmEdit).not.toHaveBeenCalled()
  })

  it('resets the save latch after a failed rename so the draft can be retried', async () => {
    const onConfirmEdit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    renderItem({
      editingId: SESSION.id,
      editTitle: 'New title',
      onConfirmEdit
    })

    const input = screen.getByDisplayValue('New title')
    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => expect(onConfirmEdit).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => expect(onConfirmEdit).toHaveBeenCalledTimes(2))
  })
})
