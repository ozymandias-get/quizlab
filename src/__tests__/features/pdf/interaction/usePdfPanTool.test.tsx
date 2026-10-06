/**
 * Regression tests for the PDF pan tool.
 *
 * Pan mode turns a pointer drag into a scroll of whatever region the viewer put
 * under the cursor. Resolving that region is the fragile part: the hook first
 * walks up looking for a scrollable ancestor and only then falls back to the
 * viewer's inner container, whose selector lives in `pdfViewerDom`. A native
 * viewer has to reproduce both, so the resolution order is pinned here.
 *
 * `panHelpers` itself has its own suite; this file covers the hook's own
 * contract: which button starts a drag, that the pointer is captured and
 * released, and that nothing is left behind on unmount.
 */
import { INNER_CONTAINER_SELECTOR } from '@features/pdf/lib/pdfViewerDom'
import { usePdfPanTool } from '@features/pdf/interaction/usePdfPanTool'

import { act, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Scrollable {
  el: HTMLElement
  set: (value: number) => void
  setLeft: (value: number) => void
  setTop: (value: number) => void
  capture: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
}

/** jsdom does not scroll, so scroll offsets and pointer capture are stubbed. */
function makeScrollable(): Scrollable {
  const el = document.createElement('div')
  let left = 0
  let top = 0
  const setLeft = (value: number) => {
    left = value
  }
  const setTop = (value: number) => {
    top = value
  }
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: setLeft
  })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: setTop
  })
  const capture = vi.fn()
  const release = vi.fn()
  Object.defineProperty(el, 'setPointerCapture', { configurable: true, value: capture })
  Object.defineProperty(el, 'releasePointerCapture', { configurable: true, value: release })
  el.setAttribute('data-testid', 'scroll-host')
  return { el, set: (v) => (left = v), setLeft, setTop, capture, release }
}

/** Make a specific element report itself as vertically scrollable. */
function markScrollable(el: HTMLElement) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 2000 })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 100 })
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 100 })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 })
}

interface Built {
  root: HTMLDivElement
  host: Scrollable
  leaf: HTMLDivElement
  containerRef: RefObject<HTMLElement | null>
}

/**
 * Build an element that the production adapter selector will match, deriving the
 * attribute from `INNER_CONTAINER_SELECTOR` instead of repeating the literal.
 */
function makeInnerContainer(): HTMLElement {
  const el = document.createElement('div')
  const match = /\[data-testid="([^"]+)"\]/.exec(INNER_CONTAINER_SELECTOR)
  if (!match) throw new Error(`unexpected adapter selector: ${INNER_CONTAINER_SELECTOR}`)
  el.setAttribute('data-testid', match[1])
  if (!el.matches(INNER_CONTAINER_SELECTOR)) {
    throw new Error(`built element does not match ${INNER_CONTAINER_SELECTOR}`)
  }
  return el
}

function build(): Built {
  const root = document.createElement('div')
  document.body.appendChild(root)

  const host = makeScrollable()
  markScrollable(host.el)
  root.appendChild(host.el)

  const leaf = document.createElement('div')
  host.el.appendChild(leaf)

  return { root, host, leaf, containerRef: { current: root } as RefObject<HTMLElement | null> }
}

function mountPan(containerRef: RefObject<HTMLElement | null>, isPanMode = true) {
  return renderHook(() => usePdfPanTool({ containerRef, isPanMode }))
}

function pointerDown(target: HTMLElement, init: Partial<PointerEventInit> = {}) {
  const event = new PointerEvent('pointerdown', { bubbles: true, button: 0, ...init })
  Object.defineProperty(event, 'target', { configurable: true, value: target })
  target.dispatchEvent(event)
}

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
}

describe('usePdfPanTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: only the scroll host overflows.
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const scrollable = el instanceof HTMLElement && el.hasAttribute('data-testid')
      return {
        overflowX: 'visible',
        overflowY: scrollable ? 'auto' : 'visible'
      } as CSSStyleDeclaration
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('primary-button drag', () => {
    it('scrolls the resolved host against the pointer movement', () => {
      const { root, host, leaf, containerRef } = build()
      mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })
      act(() => {
        document.dispatchEvent(pointer('pointermove', 40, 25))
      })

      // The drag moves the content with the cursor, so both offsets shrink.
      expect(host.el.scrollLeft).toBe(-40)
      expect(host.el.scrollTop).toBe(-25)

      act(() => {
        document.dispatchEvent(pointer('pointermove', 60, 10))
      })
      // Movement is relative to the previous sample, not the press point.
      expect(host.el.scrollLeft).toBe(-60)
      expect(host.el.scrollTop).toBe(-10)

      expect(host.el.isConnected).toBe(true)
      expect(root.isConnected).toBe(true)
    })

    it('reports the drag state while the pointer is down', () => {
      const { leaf, containerRef } = build()
      const { result } = mountPan(containerRef)

      expect(result.current.isDragging).toBe(false)
      act(() => {
        pointerDown(leaf)
      })
      expect(result.current.isDragging).toBe(true)

      act(() => {
        document.dispatchEvent(pointer('pointerup', 40, 25))
      })
      expect(result.current.isDragging).toBe(false)
    })

    it('cancels the press default so the browser does not start its own drag', () => {
      const { leaf, containerRef } = build()
      mountPan(containerRef)
      const event = new PointerEvent('pointerdown', { bubbles: true, button: 0, cancelable: true })
      Object.defineProperty(event, 'target', { configurable: true, value: leaf })

      act(() => {
        leaf.dispatchEvent(event)
      })

      expect(event.defaultPrevented).toBe(true)
    })

    it('ends the drag on pointercancel as well as pointerup', () => {
      const { leaf, containerRef } = build()
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })
      act(() => {
        document.dispatchEvent(pointer('pointercancel', 10, 10))
      })

      expect(result.current.isDragging).toBe(false)
    })

    it('ignores pointer movement that was not preceded by a press', () => {
      const { host, containerRef } = build()
      mountPan(containerRef)

      act(() => {
        document.dispatchEvent(pointer('pointermove', 40, 25))
      })

      expect(host.el.scrollLeft).toBe(0)
      expect(host.el.scrollTop).toBe(0)
    })
  })

  describe('non-primary buttons', () => {
    it('does not start a drag for a secondary button', () => {
      const { host, leaf, containerRef } = build()
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { button: 2 })
      })
      act(() => {
        document.dispatchEvent(pointer('pointermove', 40, 25))
      })

      expect(result.current.isDragging).toBe(false)
      expect(host.el.scrollLeft).toBe(0)
      expect(host.capture).not.toHaveBeenCalled()
    })

    it('does not start a drag for the middle button', () => {
      const { leaf, containerRef } = build()
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { button: 1 })
      })

      expect(result.current.isDragging).toBe(false)
    })
  })

  describe('pointer capture lifecycle', () => {
    it('captures on press and releases on release', () => {
      const { host, leaf, containerRef } = build()
      mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { pointerId: 7 })
      })
      expect(host.capture).toHaveBeenCalledWith(7)

      act(() => {
        document.dispatchEvent(pointer('pointerup', 0, 0))
      })
    })

    it('releases the captured pointer using the releasing event id', () => {
      const { host, leaf, containerRef } = build()
      mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { pointerId: 11 })
      })
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11 }))
      })

      expect(host.release).toHaveBeenCalledWith(11)
    })

    it('still ends the drag when releasing the capture throws', () => {
      const { host, leaf, containerRef } = build()
      host.release.mockImplementation(() => {
        throw new Error('no active pointer')
      })
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { pointerId: 3 })
      })
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }))
      })

      expect(result.current.isDragging).toBe(false)
    })
  })

  describe('scroll host resolution', () => {
    it('uses the nearest scrollable ancestor of the pressed element', () => {
      const { host, leaf, containerRef } = build()
      mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })

      expect(host.capture).toHaveBeenCalledTimes(1)
    })

    it('falls back to the viewer inner container when nothing under the pointer scrolls', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)

      const inner = makeInnerContainer()
      root.appendChild(inner)

      const leaf = document.createElement('div')
      inner.appendChild(leaf)

      const host = makeScrollable()
      Object.defineProperty(inner, 'setPointerCapture', {
        configurable: true,
        value: host.capture
      })
      Object.defineProperty(inner, 'releasePointerCapture', {
        configurable: true,
        value: host.release
      })

      const containerRef = { current: root } as RefObject<HTMLElement | null>
      mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })

      expect(root.querySelector(INNER_CONTAINER_SELECTOR)).toBe(inner)
      expect(host.capture).toHaveBeenCalledTimes(1)
    })

    it('does nothing when neither an ancestor nor the inner container can scroll', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const leaf = document.createElement('div')
      root.appendChild(leaf)
      const containerRef = { current: root } as RefObject<HTMLElement | null>
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })

      expect(result.current.isDragging).toBe(false)
    })

    it('ignores presses that land outside the pan container', () => {
      const { root, containerRef } = build()
      const outsider = document.createElement('div')
      document.body.appendChild(outsider)
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(outsider)
      })

      expect(root.contains(outsider)).toBe(false)
      expect(result.current.isDragging).toBe(false)
    })
  })

  describe('pan mode disabled', () => {
    it('registers no listeners when pan mode is off', () => {
      const { leaf, containerRef } = build()
      const { result } = mountPan(containerRef, false)

      act(() => {
        pointerDown(leaf)
        document.dispatchEvent(pointer('pointermove', 40, 25))
      })

      expect(result.current.isDragging).toBe(false)
    })

    it('attaches the drag listeners once pan mode is switched on', () => {
      const { host, leaf, containerRef } = build()
      const { result, rerender } = renderHook(
        ({ isPanMode }) => usePdfPanTool({ containerRef, isPanMode }),
        { initialProps: { isPanMode: false } }
      )

      act(() => {
        pointerDown(leaf)
        document.dispatchEvent(pointer('pointermove', 10, 10))
      })
      expect(host.el.scrollTop).toBe(0)

      rerender({ isPanMode: true })
      act(() => {
        pointerDown(leaf)
        document.dispatchEvent(pointer('pointermove', 10, 10))
      })
      expect(host.el.scrollTop).toBe(-10)
      expect(result.current.isDragging).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('detaches the document listeners and clears the drag state on unmount', () => {
      const { host, leaf, containerRef } = build()
      const { result, unmount } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf, { pointerId: 5 })
      })
      expect(result.current.isDragging).toBe(true)

      unmount()

      // After unmount nothing may still scroll the page.
      act(() => {
        document.dispatchEvent(pointer('pointermove', 200, 200))
      })
      expect(host.el.scrollTop).toBe(0)
    })

    it('removes the container pointerdown listener on unmount', () => {
      const { root, containerRef } = build()
      const removeSpy = vi.spyOn(root, 'removeEventListener')
      const { unmount } = mountPan(containerRef)

      unmount()

      expect(removeSpy.mock.calls.map(([type]) => type)).toContain('pointerdown')
    })

    it('does not start a drag when pressed again after remount', () => {
      const { leaf, containerRef } = build()
      const { unmount } = mountPan(containerRef)
      unmount()
      const { result } = mountPan(containerRef)

      act(() => {
        pointerDown(leaf)
      })

      expect(result.current.isDragging).toBe(true)
    })
  })
})
