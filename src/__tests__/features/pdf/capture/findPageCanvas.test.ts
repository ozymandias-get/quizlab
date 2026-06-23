/**
 * Tests for findPageCanvas — finds the best canvas for a given PDF page.
 * Critical for the screenshot capture flow.
 */
import { findPageCanvas } from '@features/pdf/capture/findPageCanvas'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function makePageLayer(
  pageNumber: number,
  withCanvas = true,
  width = 100,
  height = 100
): HTMLElement {
  const layer = document.createElement('div')
  layer.className = 'rpv-core__page-layer'
  layer.setAttribute('data-page-number', String(pageNumber))
  if (withCanvas) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    // Mock getBoundingClientRect to be visible
    canvas.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 200,
        left: 100,
        right: 200,
        width: 100,
        height: 100,
        x: 100,
        y: 100,
        toJSON: () => ({})
      }) as DOMRect
    layer.appendChild(canvas)
  }
  return layer
}

describe('findPageCanvas', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.className = 'pdf-viewer-container'
    document.body.appendChild(container)
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('returns null when no pages exist', () => {
    expect(findPageCanvas(1)).toBeNull()
  })

  it('returns canvas from current page layer when present', () => {
    const layer1 = makePageLayer(1)
    const layer2 = makePageLayer(2)
    container.appendChild(layer1)
    container.appendChild(layer2)

    const result = findPageCanvas(1)
    expect(result).toBe(layer1.querySelector('canvas'))
  })

  it('falls back to previous page when current page has no layer', () => {
    const layer1 = makePageLayer(1)
    container.appendChild(layer1)

    const result = findPageCanvas(2)
    expect(result).toBe(layer1.querySelector('canvas'))
  })

  it('skips current page when layer has no canvas', () => {
    const layer1 = makePageLayer(1, false) // no canvas
    const layer2 = makePageLayer(2)
    container.appendChild(layer1)
    container.appendChild(layer2)

    // page 3 is the current page, page 2 is the fallback
    const result = findPageCanvas(3)
    expect(result).toBe(layer2.querySelector('canvas'))
  })

  it('skips zero-sized canvases', () => {
    const layer = makePageLayer(1, true, 0, 0) // zero-sized canvas
    container.appendChild(layer)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('picks the closest visible page when no exact match', () => {
    const layer1 = makePageLayer(1)
    const layer5 = makePageLayer(5)
    container.appendChild(layer1)
    container.appendChild(layer5)

    // Asking for page 2 — layer 1 is closer than layer 5
    const result = findPageCanvas(2)
    expect(result).toBe(layer1.querySelector('canvas'))
  })

  it('falls back to .pdf-viewer-container canvas when no page layer has canvases', () => {
    // A stray canvas inside .pdf-viewer-container with no page layer
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    container.appendChild(canvas)

    expect(findPageCanvas(1)).toBe(canvas)
  })

  it('returns null from fallback if canvas is zero-sized', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 0
    canvas.height = 0
    container.appendChild(canvas)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('skips off-screen canvases when no exact page match exists (uses viewport scoring)', () => {
    // Page 5 doesn't exist as a layer, so we fall into the "all canvases" scoring branch
    const layer1 = makePageLayer(1)
    const canvas = layer1.querySelector('canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () =>
      ({
        top: 2000,
        bottom: 2100,
        left: 100,
        right: 200,
        width: 100,
        height: 100,
        x: 100,
        y: 2000,
        toJSON: () => ({})
      }) as DOMRect
    container.appendChild(layer1)
    // container has class .pdf-viewer-container but the fallback in the source
    // also returns a zero-visibility canvas if its width > 0 (no viewport check).
    // So the canvas with no visible area is NOT picked as best candidate (no candidate at all)
    // — but the fallback selector WILL return it. This test verifies that the
    // best-candidate scoring does not pick off-screen canvases when there are
    // multiple ones. We add a visible canvas to confirm the off-screen one is ignored.
    const layer2 = makePageLayer(2)
    container.appendChild(layer2)
    const result = findPageCanvas(5) // no exact match for 5
    expect(result).toBe(layer2.querySelector('canvas'))
  })
})
