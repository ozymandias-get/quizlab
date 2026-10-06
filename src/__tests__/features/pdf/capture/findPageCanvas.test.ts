/**
 * Tests for findPageCanvas — finds the best canvas for a given PDF page.
 * Critical for the screenshot capture flow.
 */
import { findPageCanvas } from '@features/pdf/capture/findPageCanvas'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Builds a page layer the way @react-pdf-viewer/core@3.12.0 actually does.
 *
 * The viewer declares `VIRTUAL_INDEX_ATTR = 'data-virtual-index'` (0-based) and
 * `'data-testid': 'core__page-layer-' + index`, and renders the
 * `rpv-core__page-layer` class. It does NOT emit `data-page-number` and has no
 * `.pdf-page-wrapper` class, so a fixture using those could only ever pass by
 * accident.
 */
function makePageLayer(
  pageNumber: number,
  withCanvas = true,
  width = 100,
  height = 100
): HTMLElement {
  const layer = document.createElement('div')
  layer.className = 'rpv-core__page-layer'
  layer.setAttribute('data-virtual-index', String(pageNumber - 1))
  layer.setAttribute('data-testid', `core__page-layer-${pageNumber - 1}`)
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

  it('resolves a page layer that only carries the viewer testid', () => {
    // Both selectors in pageLayerSelectors() are emitted by the viewer, so
    // either one alone must be enough to identify the page.
    const layer = makePageLayer(3)
    layer.removeAttribute('data-virtual-index')
    container.appendChild(layer)

    expect(findPageCanvas(3)).toBe(layer.querySelector('canvas'))
  })

  it('resolves a page layer that only carries data-virtual-index', () => {
    const layer = makePageLayer(4)
    layer.removeAttribute('data-testid')
    container.appendChild(layer)

    expect(findPageCanvas(4)).toBe(layer.querySelector('canvas'))
  })

  it('uses the 0-based virtual index the viewer emits, not a 1-based guess', () => {
    const layer = makePageLayer(1)
    container.appendChild(layer)

    // Page 1 is virtual index 0; asking for "page 0" must not match it.
    expect(findPageCanvas(0)).toBeNull()
  })
})

/**
 * The native viewer's half.
 *
 * The native viewer mounts exactly **one** canvas, so the page attribute on the
 * page box is the only thing that can confirm the pixels on it belong to the page
 * being asked for. These are the cases that keep a capture from silently
 * returning the wrong page.
 */
function makeNativePage(pageNumber: number, withCanvas = true, width = 120, height = 180) {
  const box = document.createElement('div')
  box.setAttribute('data-native-pdf-page', String(pageNumber))
  if (withCanvas) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-native-pdf-canvas', '')
    canvas.width = width
    canvas.height = height
    box.appendChild(canvas)
  }
  return box
}

describe('findPageCanvas — native renderer', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.className = 'pdf-viewer-container'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('returns the mounted canvas for the page on screen', () => {
    const box = makeNativePage(4)
    container.appendChild(box)

    expect(findPageCanvas(4)).toBe(box.querySelector('canvas'))
  })

  it('does not return the current page canvas for a different page', () => {
    // The single-canvas viewer means there is exactly one candidate; the page
    // attribute is what makes answering `null` possible instead of capturing the
    // wrong page under the right label.
    container.appendChild(makeNativePage(4))

    expect(findPageCanvas(5)).toBeNull()
  })

  it('returns null when the native page has no canvas yet', () => {
    container.appendChild(makeNativePage(1, false))

    expect(findPageCanvas(1)).toBeNull()
  })

  it('returns null for a native canvas the GPU cleanup already released', () => {
    container.appendChild(makeNativePage(1, true, 0, 0))

    expect(findPageCanvas(1)).toBeNull()
  })

  it('prefers the native canvas, and still falls back to a legacy page layer', () => {
    // Both markups can exist in one document only in tests, but the resolver has
    // to tolerate it: a capture must never come back empty-handed when a page
    // layer is present.
    const legacy = makePageLayer(7)
    const native = makeNativePage(7)
    container.appendChild(legacy)
    container.appendChild(native)

    expect(findPageCanvas(7)).toBe(native.querySelector('canvas'))

    container.removeChild(native)
    expect(findPageCanvas(7)).toBe(legacy.querySelector('canvas'))
  })

  it('re-discovers a native canvas after the page box was replaced', () => {
    const first = makeNativePage(2, true, 100, 100)
    container.appendChild(first)
    expect(findPageCanvas(2)).toBe(first.querySelector('canvas'))

    // A page turn replaces the page box; the cached canvas is detached, so the
    // next lookup has to find the new one rather than serve the old element.
    container.removeChild(first)
    const second = makeNativePage(2, true, 140, 210)
    container.appendChild(second)

    expect(findPageCanvas(2)).toBe(second.querySelector('canvas'))
  })

  it('does not serve a cached native canvas once the page number moved on', () => {
    const box = makeNativePage(3)
    container.appendChild(box)
    expect(findPageCanvas(3)).toBe(box.querySelector('canvas'))

    // Same canvas, asked for as a different page: the page attribute says no.
    expect(findPageCanvas(4)).toBeNull()
  })
})
