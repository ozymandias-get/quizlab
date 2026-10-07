/**
 * Regression tests for Ctrl/Meta + wheel zoom over the PDF.
 *
 * Three contracts are load-bearing and easy to lose:
 *
 *  - the listener runs in the capture phase with `passive: false`, so the
 *    browser's own page zoom is suppressed before anything can handle the event;
 *  - the zoom step and the min/max clamps come from `constants/pdfZoom` rather
 *    than from a viewer toolbar step, so they must be re-asserted here;
 *  - the throttle drops redundant wheel events but still swallows them, so the
 *    page cannot scroll while the gesture is being consumed.
 */
import {
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'
import { usePdfCtrlWheelZoom } from '@features/pdf/viewport/usePdfCtrlWheelZoom'

import { act, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const THROTTLE_MS = 40

type ZoomTo = (scale: number) => void

function makeContainer(): { el: HTMLDivElement; ref: RefObject<HTMLElement | null> } {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return { el, ref: { current: el } as RefObject<HTMLElement | null> }
}

function wheel(init: WheelEventInit & { modifiers?: number } = {}) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: init.modifiers !== undefined ? (init.modifiers & 1) === 1 : false,
    metaKey: init.modifiers !== undefined ? (init.modifiers & 2) === 2 : false,
    deltaY: init.deltaY ?? -1
  })
  return event
}

interface Options {
  scaleFactor?: number
  enabled?: boolean
  panMode?: boolean
}

function mount(containerRef: RefObject<HTMLElement | null>, zoomTo: ZoomTo, options: Options = {}) {
  return renderHook(
    ({ panMode, enabled }) =>
      usePdfCtrlWheelZoom(
        containerRef,
        zoomTo,
        options.scaleFactor ?? 1,
        enabled ?? true,
        panMode ?? false
      ),
    { initialProps: { panMode: options.panMode ?? false, enabled: options.enabled ?? true } }
  )
}

describe('usePdfCtrlWheelZoom', () => {
  let zoomTo: ReturnType<typeof vi.fn<ZoomTo>>
  let harness: ReturnType<typeof makeContainer>

  beforeEach(() => {
    vi.clearAllMocks()
    zoomTo = vi.fn<ZoomTo>()
    harness = makeContainer()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('registration', () => {
    it('registers the listener in the capture phase and as non-passive', () => {
      const addSpy = vi.spyOn(harness.el, 'addEventListener')

      mount(harness.ref, zoomTo)

      const call = addSpy.mock.calls.find(([type]) => type === 'wheel')
      expect(call?.[2]).toEqual({ passive: false, capture: true })
    })

    it('removes the listener with the same options on unmount', () => {
      const removeSpy = vi.spyOn(harness.el, 'removeEventListener')
      const { unmount } = mount(harness.ref, zoomTo)

      unmount()

      const call = removeSpy.mock.calls.find(([type]) => type === 'wheel')
      expect(call?.[2]).toEqual({ passive: false, capture: true })
    })

    it('does not register anything while disabled', () => {
      const addSpy = vi.spyOn(harness.el, 'addEventListener')

      mount(harness.ref, zoomTo, { enabled: false })

      expect(addSpy.mock.calls.map(([type]) => type)).not.toContain('wheel')
    })

    it('registers once the hook becomes enabled', () => {
      const { rerender } = mount(harness.ref, zoomTo, { enabled: false })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1 }))
      })
      expect(zoomTo).not.toHaveBeenCalled()

      rerender({ panMode: false, enabled: true })
      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1 }))
      })
      expect(zoomTo).toHaveBeenCalledTimes(1)
    })
  })

  describe('zooming', () => {
    it('zooms in when the wheel scrolls up', () => {
      mount(harness.ref, zoomTo, { scaleFactor: 1 })

      const event = wheel({ modifiers: 1, deltaY: -1 })
      act(() => {
        harness.el.dispatchEvent(event)
      })

      expect(zoomTo).toHaveBeenCalledWith(1 + PDF_ZOOM_STEP)
      expect(event.defaultPrevented).toBe(true)
    })

    it('zooms out when the wheel scrolls down', () => {
      mount(harness.ref, zoomTo, { scaleFactor: 1 })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: 1 }))
      })

      expect(zoomTo).toHaveBeenCalledWith(1 - PDF_ZOOM_STEP)
    })

    it('treats Meta as the zoom modifier too, for macOS', () => {
      mount(harness.ref, zoomTo, { scaleFactor: 2 })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 2, deltaY: -1 }))
      })

      expect(zoomTo).toHaveBeenCalledWith(2 + PDF_ZOOM_STEP)
    })

    it('clamps at the maximum scale', () => {
      mount(harness.ref, zoomTo, { scaleFactor: PDF_ZOOM_MAX_SCALE })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
      })

      expect(zoomTo).toHaveBeenCalledWith(PDF_ZOOM_MAX_SCALE)
    })

    it('clamps at the minimum scale', () => {
      mount(harness.ref, zoomTo, { scaleFactor: PDF_ZOOM_MIN_SCALE })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: 1 }))
      })

      expect(zoomTo).toHaveBeenCalledWith(PDF_ZOOM_MIN_SCALE)
    })
  })

  describe('no zoom without a modifier', () => {
    it('leaves a bare wheel alone so it can page-turn instead', () => {
      mount(harness.ref, zoomTo)

      const event = wheel({ deltaY: -1 })
      act(() => {
        harness.el.dispatchEvent(event)
      })

      expect(zoomTo).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('pan mode', () => {
    it('does not zoom while pan mode is active', () => {
      mount(harness.ref, zoomTo, { panMode: true, scaleFactor: 1 })

      const event = wheel({ modifiers: 1, deltaY: -1 })
      act(() => {
        harness.el.dispatchEvent(event)
      })

      expect(zoomTo).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })

    it('resumes zooming as soon as pan mode is turned off', () => {
      const { rerender } = mount(harness.ref, zoomTo, { panMode: true, scaleFactor: 1 })

      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
      })
      expect(zoomTo).not.toHaveBeenCalled()

      rerender({ panMode: false, enabled: true })
      act(() => {
        harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
      })
      expect(zoomTo).toHaveBeenCalledTimes(1)
    })
  })

  describe('throttle', () => {
    it('applies one zoom per throttle window and swallows the rest', () => {
      vi.useFakeTimers()
      try {
        mount(harness.ref, zoomTo, { scaleFactor: 1 })

        act(() => {
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
        })
        expect(zoomTo).toHaveBeenCalledTimes(1)

        // Suppressed events are still consumed, so the panel cannot scroll.
        const suppressed = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -1
        })
        act(() => {
          vi.advanceTimersByTime(THROTTLE_MS - 1)
          harness.el.dispatchEvent(suppressed)
        })
        expect(zoomTo).toHaveBeenCalledTimes(1)
        expect(suppressed.defaultPrevented).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('accepts a new zoom once the throttle window has elapsed', () => {
      vi.useFakeTimers()
      try {
        mount(harness.ref, zoomTo, { scaleFactor: 1 })

        act(() => {
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
        })
        expect(zoomTo).toHaveBeenCalledTimes(1)

        act(() => {
          vi.advanceTimersByTime(THROTTLE_MS)
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
        })

        expect(zoomTo).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('measures the throttle window with the current scale each time', () => {
      vi.useFakeTimers()
      try {
        mount(harness.ref, zoomTo, { scaleFactor: 1 })

        act(() => {
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: -1 }))
          vi.advanceTimersByTime(THROTTLE_MS)
          harness.el.dispatchEvent(wheel({ modifiers: 1, deltaY: 1 }))
        })

        // The hook is driven by the scale the viewer reports back, so the second
        // call still reads the scale it was mounted with unless it changes.
        expect(zoomTo).toHaveBeenNthCalledWith(1, 1 + PDF_ZOOM_STEP)
        expect(zoomTo).toHaveBeenNthCalledWith(2, 1 - PDF_ZOOM_STEP)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
