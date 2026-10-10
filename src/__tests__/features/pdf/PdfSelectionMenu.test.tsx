import PdfSelectionMenu from '@features/pdf/ui/components/PdfSelectionMenu'
import { DEFAULT_SELECTION_MENU_SIZE } from '@features/pdf/text/selectionPage'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('PdfSelectionMenu', () => {
  it('renders both actions at once with no extra AI icon step', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-draft')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-menu')).toBeInTheDocument()
  })

  /**
   * Aşama 4: "Metinler kesilmeden okunmalı."
   *
   * Gerçek Electron ölçümünde 252px yüzeyde "AI'ye Gönder" ve "Taslağa Ekle"
   * üç nokta ile kırpılıyordu ("AI'ye Gö…"). Yüzey genişliği iki etiketi de
   * ikon + dolgu ile birlikte taşıyacak kadar olmalı ve render edilen genişlik
   * konumlandırmada kullanılan sabitle AYNI olmalı (kelepçeleme birebir).
   */
  it('is wide enough for the longest shipped labels (no truncation)', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    const menu = screen.getByTestId('pdf-selection-menu')

    // Yüzey genişliği konumlandırma sabitiyle birebir aynı.
    expect(menu.style.width).toBe(`${DEFAULT_SELECTION_MENU_SIZE.width}px`)

    // "Taslağa Ekle" (TR, en uzun gönderilen etiket) 12px semibold ≈ 82px;
    // düğme = 20 yatay dolgu + 20 ikon + 8 boşluk + metin.
    const longestLabelPx = 82
    const buttonPx = 20 + 20 + 8 + longestLabelPx
    const dividerAndPaddingPx = 1 + 8
    expect(DEFAULT_SELECTION_MENU_SIZE.width).toBeGreaterThanOrEqual(
      buttonPx * 2 + dividerAndPaddingPx
    )
  })

  it('keeps the actions as real buttons with keyboard focus', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send').tagName).toBe('BUTTON')
    expect(screen.getByTestId('pdf-selection-draft').tagName).toBe('BUTTON')
    expect(screen.getByTestId('pdf-selection-menu')).toHaveAttribute('role', 'menu')
  })

  it('does not swallow the click that keeps the text selection alive', () => {
    // Menüde mousedown preventDefault: seçim kaybolmaz, yeni selectionchange
    // menüyü kapatmaz.
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    screen.getByTestId('pdf-selection-menu').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('fires direct send without touching the draft', () => {
    const onSendToAi = vi.fn()
    const onAddToDraft = vi.fn()
    render(
      <PdfSelectionMenu top={100} left={100} onSendToAi={onSendToAi} onAddToDraft={onAddToDraft} />
    )
    fireEvent.click(screen.getByTestId('pdf-selection-send'))
    expect(onSendToAi).toHaveBeenCalledTimes(1)
    expect(onAddToDraft).not.toHaveBeenCalled()
  })

  it('fires draft add without sending', () => {
    const onSendToAi = vi.fn()
    const onAddToDraft = vi.fn()
    render(
      <PdfSelectionMenu top={100} left={100} onSendToAi={onSendToAi} onAddToDraft={onAddToDraft} />
    )
    fireEvent.click(screen.getByTestId('pdf-selection-draft'))
    expect(onAddToDraft).toHaveBeenCalledTimes(1)
    expect(onSendToAi).not.toHaveBeenCalled()
  })

  it('shows inline added feedback with count and no gallery', () => {
    render(
      <PdfSelectionMenu
        top={100}
        left={100}
        feedback="added"
        addedCount={3}
        onSendToAi={vi.fn()}
        onAddToDraft={vi.fn()}
      />
    )
    expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-send-attachment-strip')).not.toBeInTheDocument()
  })

  it('is keyboard accessible (buttons focusable)', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send').tagName).toBe('BUTTON')
    expect(screen.getByTestId('pdf-selection-draft').tagName).toBe('BUTTON')
  })
})
