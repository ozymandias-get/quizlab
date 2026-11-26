import { fitMenuElementToViewport, fitMenuToViewport } from '@shared/lib/menuPosition'

import { afterEach, describe, expect, it } from 'vitest'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

afterEach(() => {
  setViewport(originalWidth, originalHeight)
})

describe('fitMenuToViewport', () => {
  it('keeps a menu that already fits in place', () => {
    setViewport(1000, 800)
    expect(fitMenuToViewport(100, 120, 180, 120)).toEqual({ left: 100, top: 120 })
  })

  it('pulls an overflowing menu past the right/bottom edge back inside', () => {
    setViewport(1000, 800)
    expect(fitMenuToViewport(980, 790, 200, 150)).toEqual({ left: 788, top: 638 })
  })

  it('keeps a small margin when the menu is larger than the viewport', () => {
    setViewport(200, 150)
    expect(fitMenuToViewport(10, 10, 400, 300)).toEqual({ left: 12, top: 12 })
  })

  it('never places a menu above/left of the margin', () => {
    setViewport(1000, 800)
    expect(fitMenuToViewport(-50, -20, 180, 120)).toEqual({ left: 12, top: 12 })
  })
})

describe('fitMenuElementToViewport', () => {
  function menuElement(layout: { width: number; height: number }, scaled: number) {
    const element = document.createElement('div')
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: layout.width })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: layout.height })
    // What getBoundingClientRect() returns while the entrance scale is running.
    element.getBoundingClientRect = () =>
      ({
        width: layout.width * scaled,
        height: layout.height * scaled,
        top: 0,
        left: 0,
        right: layout.width * scaled,
        bottom: layout.height * scaled
      }) as DOMRect
    return element
  }

  it('uses the layout box, so an entrance scale does not under-measure the menu', () => {
    setViewport(400, 300)
    const element = menuElement({ width: 200, height: 150 }, 0.95)

    // The final (unscaled) box is clamped, not its 95% mid-animation size.
    expect(fitMenuElementToViewport(element, 390, 290)).toEqual({ left: 188, top: 138 })
  })

  it('leaves an in-viewport menu at its anchor', () => {
    setViewport(1000, 800)
    const element = menuElement({ width: 180, height: 120 }, 1)

    expect(fitMenuElementToViewport(element, 100, 120)).toEqual({ left: 100, top: 120 })
  })
})
