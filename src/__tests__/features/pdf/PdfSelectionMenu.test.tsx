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

  it('shows inline error feedback and no gallery', () => {
    render(
      <PdfSelectionMenu
        top={100}
        left={100}
        feedback="error"
        onSendToAi={vi.fn()}
        onAddToDraft={vi.fn()}
      />
    )
    expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-send-attachment-strip')).not.toBeInTheDocument()
  })

  // Success is silent: no added/sent/staged state exists, so the menu can only
  // ever show the two actions or an error. A confirmation row here would restate
  // what the draft badge and the AI site already show.
  it('never renders a success confirmation row', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.queryByTestId('pdf-selection-menu-feedback')).not.toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-send')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-draft')).toBeInTheDocument()
  })

  it('is keyboard accessible (buttons focusable)', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send').tagName).toBe('BUTTON')
    expect(screen.getByTestId('pdf-selection-draft').tagName).toBe('BUTTON')
  })

  /**
   * Kenar düzeltmesi gerçekten uygulanmalı.
   *
   * `useLayoutEffect` menüyü ölçüp taşmayı düzeltiyor, ama düzeltme `transform`
   * olarak yazılıyordu. Aynı özellik `motion.div`'in sahipliğinde olduğu için
   * motion her karede üstüne yazıyor, animasyon bitince de `transform: none`
   * basıyordu: düzeltme hiç görünmüyordu. Ölçüm taşmayı gösterdiğinde yüzeyin
   * `transform`'ında gerçekten kayma bulunmalı.
   */
  it('nudges itself back inside the viewport after measuring the real surface', () => {
    // Menü sağ kenarı 1196px'ye taşıyor; jsdom viewport'u 1024px.
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 144,
      left: 900,
      right: 1196,
      width: 296,
      height: 44,
      x: 900,
      y: 100,
      toJSON: () => ({})
    } as DOMRect)

    try {
      render(<PdfSelectionMenu top={100} left={900} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)

      expect(screen.getByTestId('pdf-selection-menu').style.transform).toBe(
        'translate(-180px, 0px)'
      )
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('leaves the surface untransformed when it already fits', () => {
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 144,
      left: 300,
      right: 596,
      width: 296,
      height: 44,
      x: 300,
      y: 100,
      toJSON: () => ({})
    } as DOMRect)

    try {
      render(<PdfSelectionMenu top={100} left={300} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)

      expect(screen.getByTestId('pdf-selection-menu').style.transform).toBe('')
    } finally {
      rectSpy.mockRestore()
    }
  })

  /**
   * Karar menüsü geçici bir yüzen yüzeydir: AI taslak dock'u `z-modal` (300),
   * odak katmanı da 300'de. `z-dropdown` (100) altında kalınca menü panelin
   * altına boyanır ve düğmeleri görünmez olur.
   */
  it('stacks above the draft dock and focus overlay', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)

    expect(screen.getByTestId('pdf-selection-menu').className).toContain('z-tooltip')
    expect(screen.getByTestId('pdf-selection-menu').className).not.toContain('z-dropdown')
  })
})
