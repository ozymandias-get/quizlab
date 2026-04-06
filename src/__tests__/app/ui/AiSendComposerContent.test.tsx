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
      ai_send_image_placeholder: 'Image note'
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
    collapsed: false,
    noteText: '',
    isSubmitting: false,
    accentStrong: '#10b981',
    sectionSurface: 'rgba(0,0,0,0.2)',
    cardSurface: 'rgba(0,0,0,0.2)',
    footerSurface: 'rgba(0,0,0,0.2)',
    textareaInsetShadow: 'rgba(255,255,255,0.04)',
    bodyHeight: 240,
    onRemoveItem: vi.fn(),
    onNoteTextChange: vi.fn(),
    onSubmit: vi.fn(),
    onResizeStart: vi.fn(),
    onResizeMove: vi.fn(),
    onResizeEnd: vi.fn()
  }

  it('shows auto send action when there is extra note text', () => {
    const onSubmit = vi.fn()

    render(
      <AiSendComposerContent
        {...baseProps}
        noteText="Bunu kısa ve maddeli ozetle"
        onSubmit={onSubmit}
      />
    )

    const autoSendButton = screen.getByRole('button', { name: 'auto_send' })
    fireEvent.click(autoSendButton)

    expect(onSubmit).toHaveBeenCalledWith({ forceAutoSend: true })
  })

  it('hides auto send action when note text is empty', () => {
    render(<AiSendComposerContent {...baseProps} noteText="   " />)

    expect(screen.queryByRole('button', { name: 'auto_send' })).not.toBeInTheDocument()
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

    expect(screen.getByText('Send order hint')).toBeInTheDocument()
    expect(screen.getByText('Sayfa 34')).toBeInTheDocument()
    expect(screen.getByText('Sayfa 34 • Bir kisim')).toBeInTheDocument()
    expect(screen.getByText('2 oge')).toBeInTheDocument()
  })
})
