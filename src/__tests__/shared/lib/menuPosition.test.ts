import { fitMenuToViewport } from '@shared/lib/menuPosition'

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
