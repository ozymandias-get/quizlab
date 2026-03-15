import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AiSendComposerContent from '@app/ui/aiSendComposer/AiSendComposerContent'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        auto_send: 'auto_send',
        ai_send_page_item: `Sayfa ${params?.page ?? ''}`.trim(),
        ai_send_page_selection_item: `Sayfa ${params?.page ?? ''} • Bir kisim`.trim(),
        ai_send_image_item: `Gorsel ${params?.index ?? ''}`.trim(),
        ai_send_item_count: `${params?.count ?? ''} oge`.trim()
      }

      return translations[key] ?? key
    }
  })
}))

describe('AiSendComposerContent', () => {
  const baseProps = {
    textItems: [],
    imageItems: [],
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

    expect(onSubmit).toHaveBeenCalledWith({ autoSend: true })
  })

  it('hides auto send action when note text is empty', () => {
    render(<AiSendComposerContent {...baseProps} noteText="   " />)

    expect(screen.queryByRole('button', { name: 'auto_send' })).not.toBeInTheDocument()
  })

  it('shows page-based labels for full-page and selection images', () => {
    render(
      <AiSendComposerContent
        {...baseProps}
        imageItems={[
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

    expect(screen.getByText('Sayfa 34')).toBeInTheDocument()
    expect(screen.getByText('Sayfa 34 • Bir kisim')).toBeInTheDocument()
    expect(screen.getByText('2 oge')).toBeInTheDocument()
  })
})
