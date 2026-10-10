import { describe, expect, it } from 'vitest'

import {
  computeSelectionMenuAnchor,
  DEFAULT_SELECTION_MENU_SIZE
} from '../../../features/pdf/text/selectionPage'

describe('computeSelectionMenuAnchor', () => {
  it('places the menu below the selection end by default', () => {
    const anchor = computeSelectionMenuAnchor({ top: 100, bottom: 120, left: 200, right: 300 })
    expect(anchor.top).toBeGreaterThanOrEqual(128)
    expect(anchor.left).toBeGreaterThanOrEqual(0)
  })

  it('flips above when there is no room below', () => {
    const viewportH = window.innerHeight
    const anchor = computeSelectionMenuAnchor({
      top: viewportH - 30,
      bottom: viewportH - 10,
      left: 200,
      right: 300
    })
    expect(anchor.top).toBeLessThan(viewportH - 30)
  })

  it('clamps to the left edge', () => {
    const anchor = computeSelectionMenuAnchor({ top: 100, bottom: 120, left: 0, right: 10 })
    expect(anchor.left).toBeGreaterThanOrEqual(8)
  })

  it('clamps to the right edge', () => {
    const viewportW = window.innerWidth
    const anchor = computeSelectionMenuAnchor({
      top: 100,
      bottom: 120,
      left: viewportW - 10,
      right: viewportW
    })
    // Kelepçeleme GERÇEK menü genişliğiyle yapılır (PdfSelectionMenu sabit ölçülü).
    expect(anchor.left + DEFAULT_SELECTION_MENU_SIZE.width).toBeLessThanOrEqual(viewportW)
  })

  it('clamps against the measured menu size, not a guess', () => {
    const viewportW = window.innerWidth
    const anchor = computeSelectionMenuAnchor(
      { top: 100, bottom: 120, left: viewportW - 10, right: viewportW },
      null,
      { width: 300, height: 44 }
    )
    expect(anchor.left + 300).toBeLessThanOrEqual(viewportW)
  })

  it('stays inside the PDF container when provided', () => {
    const anchor = computeSelectionMenuAnchor(
      { top: 100, bottom: 120, left: 200, right: 300 },
      { top: 0, bottom: 400, left: 0, right: 500 }
    )
    expect(anchor.top).toBeGreaterThanOrEqual(8)
    expect(anchor.top).toBeLessThanOrEqual(400)
    expect(anchor.left).toBeGreaterThanOrEqual(8)
  })

  it('is deterministic for the same input (no reposition churn)', () => {
    const rect = { top: 150, bottom: 170, left: 250, right: 350 }
    expect(computeSelectionMenuAnchor(rect)).toEqual(computeSelectionMenuAnchor(rect))
  })

  // Aşama 3 test matrisi: aynı geometri farklı seçim yönleri/kenarları/ölçekleri
  // için de "anlamsız" konum üretmemeli. Zoom ve rotation yalnızca rect'in
  // sayısal değerlerini değiştirir; karar mantığı ölçekten bağımsızdır.
  describe('scenario matrix', () => {
    const MENU = DEFAULT_SELECTION_MENU_SIZE

    function assertInsideViewport(anchor: { top: number; left: number }) {
      expect(anchor.left).toBeGreaterThanOrEqual(0)
      expect(anchor.top).toBeGreaterThanOrEqual(0)
      expect(anchor.left + MENU.width).toBeLessThanOrEqual(window.innerWidth)
      expect(anchor.top + MENU.height).toBeLessThanOrEqual(window.innerHeight)
    }

    it('handles a single-line selection near the right edge', () => {
      const anchor = computeSelectionMenuAnchor({
        top: 200,
        bottom: 220,
        left: window.innerWidth - 60,
        right: window.innerWidth - 20
      })
      assertInsideViewport(anchor)
    })

    it('handles an upward (bottom-to-top) multi-line selection', () => {
      // Yukarıdan aşağı seçimde bitiş rect'i son satırın ALTINDA; aşağıdan
      // yukarıda üstte. Karar bitiş rect'ine göre verilir.
      const downward = computeSelectionMenuAnchor({ top: 200, bottom: 320, left: 300, right: 500 })
      assertInsideViewport(downward)
      expect(downward.top).toBe(328)
    })

    it('flips above the selection at the end of a page', () => {
      const anchor = computeSelectionMenuAnchor(
        { top: 600, bottom: 660, left: 300, right: 500 },
        { top: 100, bottom: 700, left: 0, right: 800 }
      )
      // Alt'ta panel sınırına sığmadığı için seçimin ÜSTÜNE alınır.
      expect(anchor.top).toBe(600 - MENU.height - 8)
      expect(anchor.top + MENU.height).toBeLessThanOrEqual(700)
    })

    it('clamps horizontally inside a narrow-but-sufficient PDF panel', () => {
      // Menünün sığdığı en dar panel (296px menü + 8px iki yana boşluk).
      const panelWidth = MENU.width + 16
      const anchor = computeSelectionMenuAnchor(
        { top: 300, bottom: 320, left: 10, right: 90 },
        { top: 0, bottom: 700, left: 0, right: panelWidth }
      )
      expect(anchor.left).toBeGreaterThanOrEqual(8)
      expect(anchor.left + MENU.width).toBeLessThanOrEqual(panelWidth)
    })

    it('keeps the menu on screen when the panel is narrower than the menu', () => {
      // Panel menüden dar: içeriye sığdırmak imkânsız. Menü VIEWPORT'ta kalır
      // ve sola yaslanır — asla ekran dışına ya da NaN konuma düşmez.
      const anchor = computeSelectionMenuAnchor(
        { top: 300, bottom: 320, left: 10, right: 90 },
        { top: 0, bottom: 700, left: 0, right: 120 }
      )
      expect(Number.isFinite(anchor.left)).toBe(true)
      expect(anchor.left).toBeGreaterThanOrEqual(8)
      expect(anchor.left + MENU.width).toBeLessThanOrEqual(window.innerWidth)
    })

    it('is scale-agnostic: zoom only changes the input rect, never the decision', () => {
      // %50 ve %200 zoom altındaki bitiş rect'leri aynı kararı üretir:
      // yeterli yer varsa menü seçimin altına, yoksa üstüne gider.
      const container = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }
      const normal = computeSelectionMenuAnchor(
        { top: 300, bottom: 320, left: 300, right: 500 },
        container
      )
      const zoomed = computeSelectionMenuAnchor(
        { top: 300, bottom: 320, left: 600, right: 800 },
        container
      )
      expect(normal.top).toBe(328)
      expect(zoomed.top).toBe(328)
      assertInsideViewport(normal)
      assertInsideViewport(zoomed)
    })

    it('keeps the menu on screen when the selection sits near the viewport bottom', () => {
      const nearBottom = computeSelectionMenuAnchor({
        top: window.innerHeight - 60,
        bottom: window.innerHeight - 20,
        left: 300,
        right: 500
      })
      assertInsideViewport(nearBottom)
    })

    it('handles a rotated page whose end rect comes back sideways', () => {
      // Rotation sonrası PDF.js farklı bir rect döndürebilir; menü yine de
      // seçimin altında ve sınırların içinde konumlanır.
      const anchor = computeSelectionMenuAnchor({ top: 400, bottom: 700, left: 300, right: 420 })
      assertInsideViewport(anchor)
    })
  })
})
