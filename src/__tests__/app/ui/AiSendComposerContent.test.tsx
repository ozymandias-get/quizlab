import AiSendComposerContent from '@app/ui/aiSendComposer/AiSendComposerContent'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        auto_send: 'auto_send',
        ai_send_send_order_hint: 'Send order hint',
        ai_send_page_item: `Sayfa ${params?.page ?? ''}`.trim(),
        ai_send_page_selection_item: `Sayfa ${params?.page ?? ''} • Bir kisim`.trim(),
        ai_send_image_item: `Gorsel ${params?.index ?? ''}`.trim(),
        ai_send_selection_item: `Alinti ${params?.index ?? ''}`.trim(),
        ai_send_item_count: `${params?.count ?? ''} oge`.trim(),
        ai_send_note_label: 'Note',
        ai_send_text_placeholder: 'Type note',
        ai_send_image_placeholder: 'Image note',
        ai_send_presets: 'Presets',
        ai_send_mode_send_now: 'Send now',
        ai_send_mode_auto: 'Auto-send',
        ai_send_image_ready: 'Ready to send',
        ai_send_ready: 'Ready',
        ai_send_error: 'Send error',
        close: 'Close'
      }

      return translations[key] ?? key
    },
    i18n: { language: 'en' }
  })
}))

describe('AiSendComposerContent', () => {
  const baseProps = {
    items: [] as { id: string; type: 'text'; text: string }[],
    totalItems: 1,
    noteText: '',
    isSubmitting: false,
    sendFeedback: 'idle' as const,
    lastError: null,
    accentStrong: '#10b981',
    bodyHeight: 240,
    onRemoveItem: vi.fn(),
    onNoteTextChange: vi.fn(),
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    onResizeStart: vi.fn(),
    getResizeCursor: vi.fn(() => 'default'),
    resizeHandlers: { onResizeMove: vi.fn(), onResizeEnd: vi.fn(), onResizeLostCapture: vi.fn() },
    edgeThickness: 6
  }

  // Regression: Enter used to submit with `forceAutoSend`, which bypassed a
  // disabled auto-send preference. Enter now defers to the global setting so the
  // note field agrees with the Send button.
  it.each([
    { label: 'Enter with text', noteText: 'hello' },
    { label: 'Enter with empty note', noteText: '' }
  ])('defers to the auto-send preference on $label', ({ noteText }) => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText={noteText}
        onSubmit={onSubmit}
      />
    )

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    // No argument at all: the global preference decides, nothing overrides it.
    expect(onSubmit).toHaveBeenCalledWith()
  })

  // Shift+Enter is the newline shortcut in every chat composer; Enter is
  // reserved for submitting. It used to submit, which both surprised users and
  // removed the only way to write a multi-line prompt while auto-send is on.
  it.each([
    { label: 'Shift+Enter', init: { shiftKey: true } },
    { label: 'Ctrl+Enter', init: { ctrlKey: true } },
    { label: 'Cmd+Enter', init: { metaKey: true } }
  ])('inserts a newline on $label instead of submitting', ({ init }) => {
    const onSubmit = vi.fn()
    const onNoteTextChange = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText="hello"
        onNoteTextChange={onNoteTextChange}
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.value = 'hello'
    fireEvent.keyDown(textarea, { key: 'Enter', ...init })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onNoteTextChange).toHaveBeenCalledTimes(1)
    expect(onNoteTextChange.mock.calls[0][0]).toContain('\n')
  })

  it('keeps newlines working when the queue is empty', () => {
    const onSubmit = vi.fn()
    const onNoteTextChange = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[]}
        totalItems={0}
        noteText=""
        onNoteTextChange={onNoteTextChange}
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.value = ''
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onNoteTextChange).toHaveBeenCalledWith('\n')
  })

  it('does not submit on Enter when queue is empty', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[]}
        totalItems={0}
        noteText="hello"
        onSubmit={onSubmit}
      />
    )

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit while a send is already in flight', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        isSubmitting
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText="hello"
        onSubmit={onSubmit}
      />
    )

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
