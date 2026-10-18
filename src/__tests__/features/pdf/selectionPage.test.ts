import { describe, expect, it } from 'vitest'

import {
  computeSelectionMenuAnchor,
  DEFAULT_SELECTION_MENU_SIZE,
  hasUsableRect,
  viewportFallbackAnchor
} from '../../../features/pdf/text/selectionPage'

/**
 * Yakalama menüsü gerçek bir hedef bulamadığında (sayfa DOM'da yok, kırpma rect'i
 * ölçülemedi) eski kod sabit `top: 120, left: 120` noktasına düşüyordu. Menü,
 * PDF nereede olursa olsun ekranın sol üst köşesine yapışıyordu.
 */
describe('viewportFallbackAnchor', () => {
  it('derives the position from the measured viewport instead of a magic constant', () => {
    const anchor = viewportFallbackAnchor(DEFAULT_SELECTION_MENU_SIZE)

    expect(anchor.left).toBe(
      Math.round((window.innerWidth - DEFAULT_SELECTION_MENU_SIZE.width) / 2)
    )
    expect(anchor.top).toBe(window.innerHeight - DEFAULT_SELECTION_MENU_SIZE.height - 8)
    // Sabit bir sol-üst köşe noktası değil.
    expect(anchor).not.toEqual({ top: 120, left: 120 })
  })

  it('keeps the whole menu inside the viewport', () => {
    const anchor = viewportFallbackAnchor(DEFAULT_SELECTION_MENU_SIZE)
    expect(anchor.left).toBeGreaterThanOrEqual(8)
    expect(anchor.left + DEFAULT_SELECTION_MENU_SIZE.width).toBeLessThanOrEqual(window.innerWidth)
    expect(anchor.top).toBeGreaterThanOrEqual(8)
    expect(anchor.top + DEFAULT_SELECTION_MENU_SIZE.height).toBeLessThanOrEqual(window.innerHeight)
  })
})

describe('rect helpers', () => {
  it('treats a 0x0 rect as unusable', () => {
    expect(hasUsableRect({ width: 0, height: 0 })).toBe(false)
    expect(hasUsableRect(null)).toBe(false)
    expect(hasUsableRect(undefined)).toBe(false)
  })

  it('accepts a measured rect', () => {
    expect(hasUsableRect({ width: 100, height: 40 })).toBe(true)
    // A width/height taşımayan düz nesne (yalnız dört kenar) de ölçümdür.
    expect(hasUsableRect({ width: undefined, height: undefined })).toBe(true)
  })
})

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

    // Rotation sonrası PDF.js farklı bir rect döndürebilir; yine de menü
    // seçimin altında ve sınırların içinde konumlanmalı.
    it.each([
      [
        'a single-line selection near the right edge',
        () => ({
          top: 200,
          bottom: 220,
          left: window.innerWidth - 60,
          right: window.innerWidth - 20
        })
      ],
      [
        'a selection near the viewport bottom',
        () => ({
          top: window.innerHeight - 60,
          bottom: window.innerHeight - 20,
          left: 300,
          right: 500
        })
      ],
      [
        'a rotated page whose end rect comes back sideways',
        () => ({ top: 400, bottom: 700, left: 300, right: 420 })
      ]
    ])('keeps the menu inside the viewport for %s', (_label, rect) => {
      assertInsideViewport(computeSelectionMenuAnchor(rect()))
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
  })
})
