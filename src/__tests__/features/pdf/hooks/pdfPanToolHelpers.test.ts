import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getInnerContainerFallback,
  getScrollableAncestor,
  isScrollableElement
} from '@features/pdf/ui/hooks/pdfPanToolHelpers'

describe('pdfPanToolHelpers', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  })

  afterEach(() => {
    root.remove()
  })

  it('isScrollableElement is true when overflow auto and content overflows', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 100, configurable: true })
    el.style.overflowY = 'auto'
    root.appendChild(el)
    expect(isScrollableElement(el)).toBe(true)
  })

  it('getScrollableAncestor returns nearest scrollable parent', () => {
    const scroll = document.createElement('div')
    scroll.style.overflowY = 'auto'
    Object.defineProperty(scroll, 'clientHeight', { value: 50, configurable: true })
    Object.defineProperty(scroll, 'scrollHeight', { value: 200, configurable: true })
    Object.defineProperty(scroll, 'clientWidth', { value: 100, configurable: true })
    Object.defineProperty(scroll, 'scrollWidth', { value: 100, configurable: true })

    const inner = document.createElement('div')
    const leaf = document.createElement('span')
    inner.appendChild(leaf)
    scroll.appendChild(inner)
    root.appendChild(scroll)

    expect(getScrollableAncestor(leaf, root)).toBe(scroll)
  })

  it('getInnerContainerFallback finds data-testid', () => {
    const inner = document.createElement('div')
    inner.setAttribute('data-testid', 'core__inner-container')
    root.appendChild(inner)
    expect(getInnerContainerFallback(root)).toBe(inner)
  })
})
