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

  it('returns null when the current page layer is missing', () => {
    const layer1 = makePageLayer(1)
    container.appendChild(layer1)

    expect(findPageCanvas(2)).toBeNull()
  })

  it('returns null when the current page has no canvas', () => {
    const layer1 = makePageLayer(1, false)
    const layer2 = makePageLayer(2)
    container.appendChild(layer1)
    container.appendChild(layer2)

    expect(findPageCanvas(3)).toBeNull()
  })

  it('skips zero-sized canvases', () => {
    const layer = makePageLayer(1, true, 0, 0) // zero-sized canvas
    container.appendChild(layer)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('does not select a nearby page when the exact page is missing', () => {
    const layer1 = makePageLayer(1)
    const layer5 = makePageLayer(5)
    container.appendChild(layer1)
    container.appendChild(layer5)

    expect(findPageCanvas(2)).toBeNull()
  })

  it('does not select an unidentifiable canvas', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    container.appendChild(canvas)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('returns null from fallback if canvas is zero-sized', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 0
    canvas.height = 0
    container.appendChild(canvas)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('does not use an off-screen page as a substitute', () => {
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

    expect(findPageCanvas(5)).toBeNull()
  })

  it('drops a cached canvas once it disconnects from the DOM', () => {
    const layer = makePageLayer(1)
    container.appendChild(layer)
    const canvas = layer.querySelector('canvas') as HTMLCanvasElement
    expect(findPageCanvas(1)).toBe(canvas) // populates the cache

    // The viewer swaps page layers on navigation; the old canvas is detached.
    container.removeChild(layer)

    // The stale cache entry must not be returned for a different page.
    const layer2 = makePageLayer(2)
    container.appendChild(layer2)
    expect(findPageCanvas(2)).toBe(layer2.querySelector('canvas'))
  })
})
