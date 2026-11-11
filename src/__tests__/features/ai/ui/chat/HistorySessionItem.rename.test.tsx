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

function renderEditingItem(
  overrides: {
    onConfirmEdit?: (sessionId: string) => void
    onCancelEdit?: () => void
  } = {}
) {
  const onConfirmEdit = overrides.onConfirmEdit ?? vi.fn()
  const onCancelEdit = overrides.onCancelEdit ?? vi.fn()

  render(
    <TooltipProvider>
      <HistorySessionItem
        session={SESSION}
        isActive={false}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        editingId={SESSION.id}
        editTitle={SESSION.title}
        onStartEdit={vi.fn()}
        onEditTitleChange={vi.fn()}
        onCancelEdit={onCancelEdit}
        onConfirmEdit={onConfirmEdit}
      />
    </TooltipProvider>
  )

  return {
    input: screen.getByDisplayValue(SESSION.title),
    onConfirmEdit,
    onCancelEdit
  }
}

describe('HistorySessionItem rename', () => {
  it('does not save when the blur follows an Escape cancel', () => {
    const { input, onConfirmEdit, onCancelEdit } = renderEditingItem()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancelEdit).toHaveBeenCalledTimes(1)

    // Escape unmounts the input, and the resulting blur used to reach the
    // save handler. The cancellation latch must swallow it.
    fireEvent.blur(input)

    expect(onConfirmEdit).not.toHaveBeenCalled()
  })

  it('saves once when Enter is followed by the input blur', () => {
    const { input, onConfirmEdit } = renderEditingItem()

    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    expect(onConfirmEdit).toHaveBeenCalledTimes(1)
    expect(onConfirmEdit).toHaveBeenCalledWith(SESSION.id)
  })
})
