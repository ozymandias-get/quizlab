import { extractSelectedText } from '@features/pdf/text/extractSelectedText'
import {
  computeSelectionMenuAnchor,
  resolveSelectionPageRange
} from '@features/pdf/text/selectionPage'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A native text layer, which is the only PDF text markup there is now.
 *
 * The scope check is unconditional: a selection is PDF text only if it lands
 * inside the layer, so a bare text node under the viewer container is correctly
 * rejected. The fixtures below therefore put their text where the viewer puts it.
 */
function mountTextLayer(container: HTMLElement): HTMLElement {
  const page = document.createElement('div')
  page.setAttribute('data-native-pdf-page', '1')
  const layer = document.createElement('div')
  layer.setAttribute('data-native-pdf-text-layer', '')
  layer.setAttribute('data-native-pdf-text-page', '1')
  page.appendChild(layer)
  container.appendChild(page)
  return layer
}

/** A text node inside the native text layer, as a rendered PDF.js run. */
function textRunIn(layer: HTMLElement, text: string): Text {
  const span = document.createElement('span')
  span.setAttribute('role', 'presentation')
  const node = document.createTextNode(text)
  span.appendChild(node)
  layer.appendChild(span)
  return node
}

function createSelection(initial: { text: string; range: Range }) {
  return {
    toString: () => initial.text,
    isCollapsed: initial.text.length === 0,
    rangeCount: 1,
    getRangeAt: () => initial.range,
    anchorNode: initial.range.startContainer,
    focusNode: initial.range.endContainer
  } as unknown as Selection
}

function createMockRange(opts: { startContainer: Node; endContainer: Node; rect: DOMRect }) {
  const range = {
    startContainer: opts.startContainer,
    endContainer: opts.endContainer,
    commonAncestorContainer: opts.startContainer,
    getBoundingClientRect: () => opts.rect
  } as unknown as Range
  return range
}

describe('extractSelectedText', () => {
  let container: HTMLDivElement
  let layer: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '0px'
    container.style.top = '0px'
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        right: 800,
        top: 0,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    })
    document.body.appendChild(container)
    layer = mountTextLayer(container)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
  })

  afterEach(() => {
    container.remove()
    vi.restoreAllMocks()
  })

  it('returns empty result when selection is null', () => {
    const result = extractSelectedText(null, container)
    expect(result).toEqual({ text: '', position: null })
  })

  it('returns empty result when selection is collapsed', () => {
    const text = textRunIn(layer, 'hello')
    const range = createMockRange({
      startContainer: text,
      endContainer: text,
      rect: { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 } as DOMRect
    })
    const selection = createSelection({ text: '', range })
    const result = extractSelectedText(selection, container)
    expect(result).toEqual({ text: '', position: null })
  })

  it('returns null when selection range is outside container', () => {
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const range = createMockRange({
      startContainer: outside,
      endContainer: outside,
      rect: { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 } as DOMRect
    })
    const selection = createSelection({ text: 'hello world', range })
    const result = extractSelectedText(selection, container)
    expect(result).toBeNull()
    outside.remove()
  })

  it('returns null for a selection inside the viewer that is not the text layer', () => {
    // The canvas and the page chrome are inside the viewer container too. Only the
    // text layer is PDF text.
    const chrome = document.createElement('div')
    chrome.textContent = 'page chrome'
    container.appendChild(chrome)
    const range = createMockRange({
      startContainer: chrome.firstChild as Node,
      endContainer: chrome.firstChild as Node,
      rect: { width: 100, height: 20, left: 200, top: 150, right: 300, bottom: 170 } as DOMRect
    })
    const selection = createSelection({ text: 'page chrome', range })

    expect(extractSelectedText(selection, container)).toBeNull()
  })

  it('returns text and position when selection is inside container', () => {
    const text = textRunIn(layer, 'hello world')
    const rect = {
      width: 100,
      height: 20,
      left: 200,
      top: 150,
      right: 300,
      bottom: 170
    } as DOMRect
    const range = createMockRange({ startContainer: text, endContainer: text, rect })
    const selection = createSelection({ text: 'hello world', range })
    const result = extractSelectedText(selection, container)
    expect(result?.text).toBe('hello world')
    expect(result?.position).not.toBeNull()
    expect(result?.position?.left).toBeCloseTo(250, 0) // rect.left + rect.width / 2
  })

  it('flips position below the selection when there is no room above', () => {
    const text = textRunIn(layer, 'top of page')
    const rect = {
      width: 100,
      height: 20,
      left: 200,
      top: 5,
      right: 300,
      bottom: 25
    } as DOMRect
    const range = createMockRange({ startContainer: text, endContainer: text, rect })
    const selection = createSelection({ text: 'top', range })
    const result = extractSelectedText(selection, container)
    expect(result?.position).not.toBeNull()
    // When top is too small, position.top should be rect.bottom + margin
    expect((result?.position?.top ?? 0) > 5).toBe(true)
  })

  it('does not clamp horizontally on its own (that is the anchor job)', () => {
    const text = textRunIn(layer, 'edge text')
    const rect = {
      width: 100,
      height: 20,
      left: 10,
      top: 300,
      right: 110,
      bottom: 320
    } as DOMRect
    const range = createMockRange({ startContainer: text, endContainer: text, rect })
    const selection = createSelection({ text: 'edge', range })
    const result = extractSelectedText(selection, container)
    // Bu fonksiyon artık genişlik varsayımıyla (280px "pill") sola itmiyor.
    // Ekranda kalma garantisi `computeSelectionMenuAnchor`'ın işidir ve
    // `selectionPage.test.ts` içinde gerçek menü ölçüsüyle sınanır.
    expect(result?.position?.left).toBe(60)
    const anchor = computeSelectionMenuAnchor(
      { top: 300, bottom: 320, left: 10, right: 110 },
      container.getBoundingClientRect()
    )
    expect(anchor.left).toBeGreaterThanOrEqual(8)
  })

  /**
   * `position.top/left` bir **konum kararı** değil, seçimin bittiği noktadır.
   *
   * Burada kendi kırpmasını uygulayan ikinci bir yerleştirme kuralı vardı
   * (`pillWidth` 280, `bottomBarHeight` 80) ve bu, menünün tek konumlandırıcısı
   * olan `computeSelectionMenuAnchor`'ın kuralıyla yarışıyordu. Sınırlara
   * kelepçeleme tek yerde olmalı; burada yalnızca bitiş noktası bildirilir.
   */
  it('reports the selection end point without its own placement policy', () => {
    const text = textRunIn(layer, 'near the bottom edge')
    const rect = {
      width: 100,
      height: 20,
      left: 200,
      top: 690,
      right: 300,
      bottom: 710
    } as DOMRect
    const range = createMockRange({ startContainer: text, endContainer: text, rect })
    const selection = createSelection({ text: 'bottom', range })
    const result = extractSelectedText(selection, container)

    // Pencereye göre 80px'lik alt çubuk payı tutulmuyor: 710 + 8.
    expect(result?.position?.top).toBe(718)
    // Yatayda da genişlik varsayımına göre itilmiyor: bitişin ortası.
    expect(result?.position?.left).toBe(250)
  })

  it('reports the end point of a multi-line selection, not the whole selection', () => {
    const text = textRunIn(layer, 'two lines')
    // `getBoundingClientRect` tüm seçimi sarar; `getClientRects` son satırı verir.
    const rect = {
      width: 500,
      height: 40,
      left: 100,
      top: 300,
      right: 600,
      bottom: 340
    } as DOMRect
    const endRect = { top: 320, bottom: 340, left: 100, right: 250 }
    const range = {
      startContainer: text,
      endContainer: text,
      commonAncestorContainer: text,
      getBoundingClientRect: () => rect,
      getClientRects: () => [endRect]
    } as unknown as Range
    const selection = createSelection({ text: 'two lines', range })
    const result = extractSelectedText(selection, container)

    expect(result?.position?.top).toBe(endRect.bottom + 8)
    expect(result?.position?.left).toBe((endRect.left + endRect.right) / 2)
  })

  it('keeps the real page range and page boundary of a multi-page selection', () => {
    const firstPage = document.createElement('div')
    firstPage.setAttribute('data-native-pdf-page', '3')
    const firstRun = textRunIn(layer, 'page three')
    firstPage.appendChild(layer)
    container.appendChild(firstPage)

    const secondLayer = document.createElement('div')
    secondLayer.setAttribute('data-native-pdf-text-layer', '')
    secondLayer.setAttribute('data-native-pdf-text-page', '5')
    const secondPage = document.createElement('div')
    secondPage.setAttribute('data-native-pdf-page', '5')
    secondPage.appendChild(secondLayer)
    const secondRun = textRunIn(secondLayer, 'page five')
    container.appendChild(secondPage)

    // Both pages use the same local coordinates: a page boundary must come from
    // the page marker, not from the measured `top`.
    const rectFor = (top: number, width: number) => ({
      left: 50,
      top,
      right: 50 + width,
      bottom: top + 12,
      width,
      height: 12,
      x: 50,
      y: top,
      toJSON: () => ({})
    })
    const firstSpan = firstRun.parentElement
    const secondSpan = secondRun.parentElement
    if (!firstSpan || !secondSpan) throw new Error('missing text run spans')
    Object.defineProperty(firstSpan, 'getBoundingClientRect', {
      configurable: true,
      value: () => rectFor(100, 70)
    })
    Object.defineProperty(secondSpan, 'getBoundingClientRect', {
      configurable: true,
      value: () => rectFor(100, 60)
    })

    const range = document.createRange()
    range.setStart(firstRun, 0)
    range.setEnd(secondRun, secondRun.length)
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => rectFor(100, 400)
    })
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => [rectFor(100, 70), rectFor(100, 60)]
    })

    const selection = {
      toString: () => 'page three page five',
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: firstRun,
      focusNode: secondRun,
      getRangeAt: () => range
    } as unknown as Selection

    expect(resolveSelectionPageRange(selection, 3)).toEqual({ page: 3, pageEnd: 5 })
    expect(extractSelectedText(selection, container)?.text).toBe('page three\n\npage five')
  })
})
