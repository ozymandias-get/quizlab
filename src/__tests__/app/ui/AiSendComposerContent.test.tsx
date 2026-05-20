import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AiSendComposerContent from '@app/ui/aiSendComposer/AiSendComposerContent'

vi.mock('@app/providers', () => {
  const t = (key: string, params?: Record<string, string>) => {
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
  }
  return {
    useLanguage: () => ({ t }),
    useLanguageStrings: () => ({ t, language: 'en' })
  }
})

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
    autoSend: false,
    onAutoSendChange: vi.fn(),
    onRemoveItem: vi.fn(),
    onNoteTextChange: vi.fn(),
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    onResizeStart: vi.fn(),
    getResizeCursor: vi.fn(() => 'default'),
    resizeHandlers: { onResizeMove: vi.fn(), onResizeEnd: vi.fn() },
    edgeThickness: 6
  }

  it('shows send mode bar with auto-send option', () => {
    render(<AiSendComposerContent {...baseProps} autoSend={false} />)

    expect(screen.getByText('Send now')).toBeInTheDocument()
    expect(screen.getByText('Auto-send')).toBeInTheDocument()
  })

  it('calls onAutoSendChange when auto-send mode is clicked', () => {
    const onAutoSendChange = vi.fn()
    render(<AiSendComposerContent {...baseProps} onAutoSendChange={onAutoSendChange} />)

    fireEvent.click(screen.getByText('Auto-send'))
    expect(onAutoSendChange).toHaveBeenCalledTimes(1)
  })

  it('calls onSubmit with forceAutoSend on Enter from note textarea', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText="hello"
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ forceAutoSend: true })
  })

  it('calls onSubmit without auto send on Shift+Enter from note textarea', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText="hello"
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith()
  })

  it('calls onSubmit without auto send on Enter when note is empty', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText=""
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith()
  })

  it('calls onSubmit with forceAutoSend on Shift+Enter when note is empty', () => {
    const onSubmit = vi.fn()
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[{ id: 't1', type: 'text', text: 'quoted' }]}
        noteText=""
        onSubmit={onSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ forceAutoSend: true })
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

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows page-based labels for full-page and selection images in queue order', () => {
    render(
      <AiSendComposerContent
        {...baseProps}
        items={[
          {
            id: 'full',
            type: 'image',
            dataUrl: 'data:image/png;base64,full',
            page: 34,
            captureKind: 'full-page'
          },
          {
            id: 'selection',
            type: 'image',
            dataUrl: 'data:image/png;base64,selection',
            page: 34,
            captureKind: 'selection'
          }
        ]}
        totalItems={2}
      />
    )

    expect(screen.getAllByText(/Sayfa 34/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Sayfa 34 • Bir kisim/)).toBeInTheDocument()
    expect(screen.getAllByText(/Ready to send/).length).toBeGreaterThanOrEqual(2)
  })
})
