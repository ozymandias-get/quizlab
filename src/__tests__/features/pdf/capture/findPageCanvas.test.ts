/**
 * `findPageCanvas` — "which on-screen canvas belongs to page N".
 *
 * Critical for the screenshot capture flow, and the answer has to be exact: the
 * viewer mounts exactly **one** canvas, so nothing else in the app can catch a
 * wrong-page capture. It takes two markers agreeing, because they answer different
 * questions: the page box names the page the viewer is *asking for*, and
 * `data-native-pdf-canvas-page` names the page the canvas is *holding* — and between
 * a page change and the render that answers it those two disagree on purpose, so the
 * canvas is still showing the previous page. Returning `null` is therefore a
 * legitimate, load-bearing outcome — the direct render path then renders the page
 * from the document instead.
 *
 * The cases below are the ones that keep a capture from silently coming back with
 * the wrong page, or from coming back empty-handed when a canvas is right there.
 */
import { findPageCanvas } from '@features/pdf/capture/findPageCanvas'
import { NATIVE_CANVAS_PAGE_ATTRIBUTE } from '@features/pdf/native/nativePdfDom'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * A page box, as `NativePdfViewer` mounts it.
 *
 * `holdingPage` is what the canvas declares it is holding, which is the page whose
 * render committed. It defaults to the box's own page because that is the settled
 * state; pass it explicitly to model a page turn or a zoom mid-flight.
 */
function makeNativePage(
  pageNumber: number,
  withCanvas = true,
  width = 120,
  height = 180,
  holdingPage: number | null = pageNumber
): HTMLElement {
  const box = document.createElement('div')
  box.setAttribute('data-native-pdf-page', String(pageNumber))
  if (withCanvas) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-native-pdf-canvas', '')
    if (holdingPage !== null) {
      canvas.setAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE, String(holdingPage))
    }
    canvas.width = width
    canvas.height = height
    box.appendChild(canvas)
  }
  return box
}

describe('findPageCanvas', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.className = 'pdf-viewer-container'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when nothing is mounted', () => {
    expect(findPageCanvas(1)).toBeNull()
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

  it('returns null when the page box has no canvas yet', () => {
    container.appendChild(makeNativePage(1, false))

    expect(findPageCanvas(1)).toBeNull()
  })

  it('returns null for a canvas the GPU cleanup already released', () => {
    // `useCanvasGpuCleanup` releases a canvas by zeroing it, and a released canvas
    // is not capturable — a zero-sized one would produce a blank image.
    container.appendChild(makeNativePage(1, true, 0, 0))

    expect(findPageCanvas(1)).toBeNull()
  })

  it('does not select an unidentifiable canvas', () => {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-native-pdf-canvas', '')
    canvas.width = 100
    canvas.height = 100
    container.appendChild(canvas)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('does not select a canvas that has not committed a render yet', () => {
    // A freshly mounted page: the box knows the page, the canvas has painted nothing.
    container.appendChild(makeNativePage(2, true, 120, 180, null))

    expect(findPageCanvas(2)).toBeNull()
  })

  it('does not treat a zero-based page number as page 1', () => {
    container.appendChild(makeNativePage(1))

    // The attribute is 1-based; asking for "page 0" must not match it.
    expect(findPageCanvas(0)).toBeNull()
  })

  it('re-discovers a canvas after the page box was replaced', () => {
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

  it('does not serve a cached canvas once the page number moved on', () => {
    const box = makeNativePage(3)
    container.appendChild(box)
    expect(findPageCanvas(3)).toBe(box.querySelector('canvas'))

    // Same canvas, asked for as a different page: the page attribute says no.
    expect(findPageCanvas(4)).toBeNull()
  })

  it('refuses the previous page once its connected canvas is reused for a turn', () => {
    // The page box has already flipped to page 2, but the page-2 render has not
    // committed, so the canvas is still showing page 1. Capturing it would send
    // page 1's image labelled page 2, so neither page can be served from it.
    const box = makeNativePage(1)
    container.appendChild(box)
    const canvas = box.querySelector('canvas')
    expect(findPageCanvas(1)).toBe(canvas)

    box.setAttribute('data-native-pdf-page', '2')
    canvas!.removeAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE)

    expect(findPageCanvas(1)).toBeNull()
    expect(findPageCanvas(2)).toBeNull()

    // Once the render commits, the same element becomes capturable — as page 2.
    canvas!.setAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE, '2')
    expect(findPageCanvas(2)).toBe(canvas)
    expect(findPageCanvas(1)).toBeNull()
  })

  it('rejects a cached canvas whose backing store was released', () => {
    const box = makeNativePage(1)
    container.appendChild(box)
    const canvas = box.querySelector('canvas')!
    expect(findPageCanvas(1)).toBe(canvas)
    canvas.width = 0
    expect(findPageCanvas(1)).toBeNull()
  })

  it('drops a cached canvas once it disconnects from the DOM', () => {
    const box = makeNativePage(1)
    container.appendChild(box)
    const canvas = box.querySelector('canvas')
    expect(findPageCanvas(1)).toBe(canvas)

    container.removeChild(box)

    expect(findPageCanvas(1)).toBeNull()
  })

  it('reuses the cache for repeated lookups of the same page', () => {
    const box = makeNativePage(6)
    container.appendChild(box)

    expect(findPageCanvas(6)).toBe(findPageCanvas(6))
  })
})
