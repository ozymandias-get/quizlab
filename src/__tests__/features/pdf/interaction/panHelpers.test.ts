/**
 * Tests for panHelpers — DOM helpers for PDF pan tool.
 * Verifies scroll-detection logic used to find the right scroll container.
 */
import {
  getInnerContainerFallback,
  getScrollableAncestor,
  isScrollableElement
} from '@features/pdf/interaction/panHelpers'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('panHelpers', () => {
  describe('isScrollableElement', () => {
    function makeEl(
      overflow: { x?: string; y?: string },
      scroll: { width?: number; height?: number },
      client: { width?: number; height?: number } = {}
    ): HTMLElement {
      const el = document.createElement('div')
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        overflowX: overflow.x ?? 'visible',
        overflowY: overflow.y ?? 'visible'
      } as any)
      Object.defineProperty(el, 'scrollWidth', { value: scroll.width ?? 0, configurable: true })
      Object.defineProperty(el, 'scrollHeight', { value: scroll.height ?? 0, configurable: true })
      Object.defineProperty(el, 'clientWidth', { value: client.width ?? 0, configurable: true })
      Object.defineProperty(el, 'clientHeight', { value: client.height ?? 0, configurable: true })
      return el
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns false for a div with default overflow:visible and no overflow content', () => {
      const el = makeEl(
        { x: 'visible', y: 'visible' },
        { width: 100, height: 100 },
        { width: 100, height: 100 }
      )
      expect(isScrollableElement(el)).toBe(false)
    })

    it('returns true for vertical overflow: auto when scrollHeight > clientHeight + 1', () => {
      const el = makeEl({ y: 'auto' }, { height: 1000 }, { height: 100 })
      expect(isScrollableElement(el)).toBe(true)
    })

    it('returns false for vertical overflow: auto when scrollHeight == clientHeight (no overflow)', () => {
      const el = makeEl({ y: 'auto' }, { height: 100 }, { height: 100 })
      expect(isScrollableElement(el)).toBe(false)
    })

    it('returns false for vertical overflow: auto when scrollHeight === clientHeight + 1 (boundary)', () => {
      const el = makeEl({ y: 'auto' }, { height: 101 }, { height: 100 })
      expect(isScrollableElement(el)).toBe(false)
    })

    it('returns true for vertical overflow: scroll even with tiny overflow', () => {
      const el = makeEl({ y: 'scroll' }, { height: 110 }, { height: 100 })
      expect(isScrollableElement(el)).toBe(true)
    })

    it('returns true for vertical overflow: overlay', () => {
      const el = makeEl({ y: 'overlay' }, { height: 200 }, { height: 100 })
      expect(isScrollableElement(el)).toBe(true)
    })

    it('returns true for horizontal overflow when scrollWidth > clientWidth + 1', () => {
      const el = makeEl({ x: 'auto' }, { width: 1000 }, { width: 100 })
      expect(isScrollableElement(el)).toBe(true)
    })

    it('returns false for overflow:hidden', () => {
      const el = makeEl(
        { x: 'hidden', y: 'hidden' },
        { width: 200, height: 200 },
        { width: 100, height: 100 }
      )
      expect(isScrollableElement(el)).toBe(false)
    })
  })

  describe('getScrollableAncestor', () => {
    let root: HTMLElement
    let inner: HTMLElement
    let leaf: HTMLElement

    beforeEach(() => {
      root = document.createElement('div')
      inner = document.createElement('div')
      leaf = document.createElement('div')

      // Mock getComputedStyle: only `inner` is scrollable (vertical auto + overflow)
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        if (el === inner) {
          return { overflowX: 'hidden', overflowY: 'auto' } as any
        }
        return { overflowX: 'visible', overflowY: 'visible' } as any
      })

      Object.defineProperty(inner, 'scrollHeight', { value: 2000, configurable: true })
      Object.defineProperty(inner, 'clientHeight', { value: 100, configurable: true })
      Object.defineProperty(leaf, 'scrollHeight', { value: 0, configurable: true })
      Object.defineProperty(leaf, 'clientHeight', { value: 0, configurable: true })

      root.appendChild(inner)
      inner.appendChild(leaf)
      document.body.appendChild(root)
    })

    afterEach(() => {
      vi.restoreAllMocks()
      document.body.removeChild(root)
    })

    it('returns the inner scrollable container when starting from a leaf', () => {
      expect(getScrollableAncestor(leaf, root)).toBe(inner)
    })

    it('returns the inner scrollable container when starting from the inner itself', () => {
      expect(getScrollableAncestor(inner, root)).toBe(inner)
    })

    it('returns null when no ancestor is scrollable', () => {
      // Use a separate root with no scrollable descendants
      const r2 = document.createElement('div')
      const c2 = document.createElement('div')
      r2.appendChild(c2)
      document.body.appendChild(r2)
      expect(getScrollableAncestor(c2, r2)).toBeNull()
      document.body.removeChild(r2)
    })

    it('returns null when start is null', () => {
      expect(getScrollableAncestor(null, root)).toBeNull()
    })

    it('returns null when start is outside the root boundary', () => {
      const outside = document.createElement('div')
      document.body.appendChild(outside)
      expect(getScrollableAncestor(outside, root)).toBeNull()
      document.body.removeChild(outside)
    })
  })

  describe('getInnerContainerFallback', () => {
    afterEach(() => {
      document.body.innerHTML = ''
    })

    it('returns the element with data-testid=core__inner-container', () => {
      const root = document.createElement('div')
      const inner = document.createElement('div')
      inner.setAttribute('data-testid', 'core__inner-container')
      root.appendChild(inner)
      document.body.appendChild(root)

      expect(getInnerContainerFallback(root)).toBe(inner)
    })

    it('returns null when no matching element exists', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      expect(getInnerContainerFallback(root)).toBeNull()
    })
  })
})
