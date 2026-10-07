/**
 * Regression tests for the PDF selection lifecycle.
 *
 * Selection is the most fragile part of the PDF surface: it is driven by three
 * document-level listeners plus a scroll lock, all of which exist to stop
 * work being scheduled while the user is scrolling or has selected text
 * elsewhere in the app. During a native-viewer migration the whole listener set
 * has to be rebuilt, so the contract below is pinned behaviourally rather than
 * by snapshotting internals.
 *
 * The real `extractSelectedText` / `extractPageTextFromDom` are used throughout:
 * these tests are about the lifecycle, but they should fail if the pipeline they
 * drive stops producing text.
 */
import { usePdfTextActions } from '@features/pdf/text/usePdfTextActions'

import { act, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SELECTION_ACTIVE_CLASS = 'pdf-selection-active'

/** Distinct page numbers keep the module-level page-layer cache from leaking. */
let nextPage = 100

type FakeSelectionInit = {
  text?: string
  isCollapsed?: boolean
  rangeCount?: number
  anchorNode?: Node | null
  focusNode?: Node | null
  commonAncestor?: Node | null
  rect?: DOMRect
  clientRects?: DOMRect[]
}

function makeRect(partial: Partial<DOMRect>): DOMRect {
  const rect = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }
  Object.assign(rect, partial)
  return rect as DOMRect
}

function makeSelection(init: FakeSelectionInit) {
  const anchor = init.anchorNode ?? null
  const focus = init.focusNode ?? anchor
  const commonAncestor = init.commonAncestor ?? anchor
  const rect = init.rect ?? makeRect({})
  const clientRects = init.clientRects ?? []
  const range = {
    commonAncestorContainer: commonAncestor,
    startContainer: anchor,
    endContainer: focus,
    getBoundingClientRect: () => rect,
    getClientRects: () => clientRects
  } as unknown as Range

  const text = init.text ?? ''
  return {
    toString: () => text,
    isCollapsed: init.isCollapsed ?? text.length === 0,
    rangeCount: init.rangeCount ?? 1,
    anchorNode: anchor,
    focusNode: focus,
    getRangeAt: () => range
  } as unknown as Selection
}

let pendingFrames: Map<number, FrameRequestCallback>
let nextFrameId: number
let cancelFrame: ReturnType<typeof vi.fn>

function flushFrames(): void {
  const frames = [...pendingFrames.entries()]
  pendingFrames.clear()
  for (const [, cb] of frames) cb(0)
}

/**
 * A mounted native page: the page box, its text layer, and one run per word.
 *
 * This is the markup `NativePdfViewer` produces and PDF.js's `TextLayer` fills.
 * The fixtures used to build `rpv-core__page-layer` / `rpv-core__text-layer`
 * markup; every expectation below is about the hook's behaviour — the rAF
 * coalescing, the 150 ms scroll freeze, the `pdf-selection-active` toggle, the
 * enablement gates — none of which ever depended on the viewer's class names.
 */
function makePageBox(pageNumber: number, words: string[]): HTMLElement {
  const box = document.createElement('div')
  box.setAttribute('data-native-pdf-page', String(pageNumber))
  const textLayer = document.createElement('div')
  textLayer.setAttribute('data-native-pdf-text-layer', '')
  textLayer.setAttribute('data-native-pdf-text-page', String(pageNumber))
  for (const word of words) {
    const span = document.createElement('span')
    span.setAttribute('role', 'presentation')
    span.textContent = word
    textLayer.appendChild(span)
  }
  box.appendChild(textLayer)
  return box
}

function buildContainer(withTextLayer = true): {
  panel: HTMLDivElement
  container: HTMLDivElement
} {
  // The panel is a distinct parent so the "pointerup anywhere in the panel"
  // fallback in handlePointerUp has a real boundary to test against.
  const panel = document.createElement('div')
  document.body.appendChild(panel)
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '0px'
  container.style.top = '0px'
  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => makeRect({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 })
  })
  panel.appendChild(container)
  if (withTextLayer) {
    container.appendChild(makePageBox(1, ['the', 'quick', 'brown', 'fox']))
  }
  return { panel, container }
}

function mountHook(
  options: {
    withTextLayer?: boolean
    currentPage?: number
    textSelectionEnabled?: boolean
  } = {}
) {
  const page = options.currentPage ?? nextPage++
  const { panel, container } = buildContainer(options.withTextLayer ?? true)
  if (page > 0) {
    container
      .querySelector('[data-native-pdf-page]')
      ?.setAttribute('data-native-pdf-page', String(page))
  }
  const containerRef = { current: container } as RefObject<HTMLElement | null>
  const onTextSelection = vi.fn()
  const rendered = renderHook(() =>
    usePdfTextActions({
      containerRef,
      currentPage: page,
      onTextSelection,
      textSelectionEnabled: options.textSelectionEnabled ?? true
    })
  )
  return { container, panel, containerRef, onTextSelection, page, ...rendered }
}

describe('usePdfTextActions', () => {
  beforeEach(() => {
    nextPage = 100
    vi.clearAllMocks()
    pendingFrames = new Map()
    nextFrameId = 1
    cancelFrame = vi.fn((id: number) => {
      pendingFrames.delete(id)
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++
      pendingFrames.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  describe('listener registration', () => {
    it('registers pointer listeners in the capture phase so an inner handler cannot swallow them', () => {
      const addSpy = vi.spyOn(document, 'addEventListener')
      mountHook()

      const pointerDown = addSpy.mock.calls.find(([type]) => type === 'pointerdown')
      const pointerUp = addSpy.mock.calls.find(([type]) => type === 'pointerup')

      expect(pointerDown?.[2]).toBe(true)
      expect(pointerUp?.[2]).toBe(true)
      // selectionchange is only delivered at the document, so it needs no phase.
      const selectionChangeCalls = addSpy.mock.calls.filter(([type]) => type === 'selectionchange')
      expect(selectionChangeCalls.length).toBeGreaterThan(0)
      // No selectionchange listener is registered in the capture phase.
      expect(selectionChangeCalls.some((call) => call[2] === true)).toBe(false)
    })

    it('registers the scroll lock on the container as a passive listener', () => {
      const { panel, container } = buildContainer()
      const addSpy = vi.spyOn(container, 'addEventListener')
      const containerRef = { current: container } as RefObject<HTMLElement | null>
      renderHook(() =>
        usePdfTextActions({
          containerRef,
          currentPage: nextPage++,
          onTextSelection: vi.fn()
        })
      )

      const scrollCall = addSpy.mock.calls.find(([type]) => type === 'scroll')
      expect(scrollCall?.[2]).toEqual({ passive: true })
      expect(panel.contains(container)).toBe(true)
    })

    it('picks up a selection established inside the container on pointerup', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!

      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)

      expect(harness.onTextSelection).toHaveBeenCalledTimes(1)
      expect(harness.onTextSelection.mock.calls[0][0]).toBe('quick')
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)
    })

    it('treats a pointerup elsewhere in the panel as an in-panel release', () => {
      // handlePointerUp falls back to "is the target inside the container or its
      // parent", so releasing over the panel chrome still resolves the pill.
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )
      const chrome = document.createElement('div')
      harness.panel.appendChild(chrome)

      const pointerUp = new PointerEvent('pointerup', { bubbles: true, button: 0 })
      Object.defineProperty(pointerUp, 'target', { configurable: true, value: chrome })
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
        document.dispatchEvent(pointerUp)
      })
      act(flushFrames)

      expect(harness.onTextSelection).toHaveBeenCalledTimes(1)
    })

    it('ignores a pointerup that landed entirely outside the panel', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )
      const elsewhere = document.createElement('div')
      document.body.appendChild(elsewhere)

      const pointerUp = new PointerEvent('pointerup', { bubbles: true, button: 0 })
      Object.defineProperty(pointerUp, 'target', { configurable: true, value: elsewhere })
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
        document.dispatchEvent(pointerUp)
      })
      act(flushFrames)

      expect(harness.onTextSelection).not.toHaveBeenCalled()
      expect(pendingFrames.size).toBe(0)
    })
  })

  /**
   * A press that never gets its `pointerup`.
   *
   * `handlePointerDown` latches `pointerStartedInsideContainer` so the drag's own
   * `selectionchange`s do not fight the pointerup that will resolve the pill, and
   * `handleSelectionChange` bails out entirely while that latch stands. Nothing in
   * the old listener set ever cleared it except the `pointerup` that a cancelled
   * gesture never sends — so a `pointercancel`, or a mouse released outside the
   * Electron window, left the latch stuck and every later `selectionchange` was
   * ignored: the pill could neither update nor clear until the next press.
   */
  describe('a pointer lifecycle that never completes', () => {
    /**
     * Establish a live pill, then leave the latch set the way a gesture that is
     * cancelled — or a mouse released outside the window — leaves it.
     */
    function stallTheLatch(
      harness: ReturnType<typeof mountHook>,
      onTextNode: Node
    ): ReturnType<typeof vi.spyOn> {
      const getSelection = vi.spyOn(window, 'getSelection')
      getSelection.mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: onTextNode,
          focusNode: onTextNode,
          commonAncestor: onTextNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )
      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)

      // The next press inside the PDF panel, and then no `pointerup` — ever.
      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
      })
      return getSelection
    }

    /** The reader then selects something elsewhere in the app. */
    function selectElsewhere(getSelection: ReturnType<typeof vi.spyOn>): void {
      const other = document.createElement('div')
      other.textContent = 'unrelated AI panel text'
      document.body.appendChild(other)
      getSelection.mockReturnValue(
        makeSelection({
          text: 'unrelated AI panel text',
          anchorNode: other.firstChild,
          focusNode: other.firstChild,
          commonAncestor: other.firstChild,
          rect: makeRect({ left: 900, top: 500, right: 1000, bottom: 520, width: 100, height: 20 })
        })
      )
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })
      act(flushFrames)
    }

    it('clears a stale pill after a pointercancel', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      const getSelection = stallTheLatch(harness, textNode)

      // The gesture is cancelled: a touch or pen taken over by the browser, a system
      // gesture, a focus change. No `pointerup` is ever delivered.
      act(() => {
        document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, button: 0 }))
      })
      selectElsewhere(getSelection)

      // The latch no longer swallows the change, so the pill is cleared and no
      // unrelated text is ever reported as PDF text.
      expect(harness.onTextSelection).toHaveBeenLastCalledWith('', null)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
      expect(harness.onTextSelection).not.toHaveBeenCalledWith(
        'unrelated AI panel text',
        expect.anything()
      )
    })

    it('clears a stale pill when the window loses focus', () => {
      // A mouse released outside the Electron window produces a `blur` rather than
      // an event we can wait for, and that is the one case `pointercancel` misses.
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      const getSelection = stallTheLatch(harness, textNode)

      act(() => {
        window.dispatchEvent(new Event('blur'))
      })
      selectElsewhere(getSelection)

      expect(harness.onTextSelection).toHaveBeenLastCalledWith('', null)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
    })

    it('removes both release listeners on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const windowSpy = vi.spyOn(window, 'removeEventListener')

      const harness = mountHook()
      harness.unmount()

      const cancelled = removeSpy.mock.calls.filter(([type]) => type === 'pointercancel')
      expect(cancelled.length).toBe(1)
      // Same capture phase it was added with, or the listener outlives the hook.
      expect(cancelled[0][2]).toBe(true)

      expect(windowSpy.mock.calls.map(([type]) => type)).toContain('blur')
    })
  })

  describe('selection outside the PDF container', () => {
    it('clears the pill and never extracts text for a selection anchored elsewhere', () => {
      const harness = mountHook()
      const inside = harness.container.querySelector('span')!.firstChild!
      const other = document.createElement('div')
      other.textContent = 'unrelated'
      document.body.appendChild(other)

      // First establish a real selection inside the PDF panel.
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: inside,
          focusNode: inside,
          commonAncestor: inside,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )
      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)

      // Now the user selects text in the AI panel instead.
      const outsideSelection = makeSelection({
        text: 'unrelated',
        anchorNode: other.firstChild,
        focusNode: other.firstChild,
        commonAncestor: other.firstChild,
        rect: makeRect({ left: 900, top: 500, right: 1000, bottom: 520, width: 100, height: 20 })
      })
      ;(window.getSelection as ReturnType<typeof vi.fn>).mockReturnValue(outsideSelection)
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })
      act(flushFrames)

      // The pill is explicitly cleared and no further text is produced.
      expect(harness.onTextSelection).toHaveBeenLastCalledWith('', null)
      expect(harness.onTextSelection).not.toHaveBeenCalledWith('unrelated', expect.anything())
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
    })

    it('clears without scheduling a frame when there is no selection at all', () => {
      const harness = mountHook()
      vi.spyOn(window, 'getSelection').mockReturnValue(null)

      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(harness.onTextSelection).toHaveBeenCalledWith('', null)
      // A bail-out must not queue a frame: there is nothing to compute.
      expect(pendingFrames.size).toBe(0)
    })
  })

  describe('detached anchor node', () => {
    it('skips processing without throwing when the page is torn down mid-selection', () => {
      const harness = mountHook()
      const span = harness.container.querySelector('span')!
      const textNode = span.firstChild!

      const selection = makeSelection({
        text: 'quick',
        anchorNode: textNode,
        focusNode: textNode,
        commonAncestor: textNode,
        rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
      })
      vi.spyOn(window, 'getSelection').mockReturnValue(selection)

      // Detach the whole panel, as a page transition or document close would.
      harness.container.remove()

      expect(() => {
        act(() => {
          document.dispatchEvent(new Event('selectionchange'))
        })
      }).not.toThrow()

      // Unlike an out-of-container selection, a detached anchor is skipped
      // silently: the previous state is left untouched.
      expect(harness.onTextSelection).not.toHaveBeenCalled()
      expect(pendingFrames.size).toBe(0)
    })

    it('leaves the previous pill untouched for an emptied selection on a detached anchor', async () => {
      vi.useFakeTimers()
      try {
        const harness = mountHook()
        const textNode = harness.container.querySelector('span')!.firstChild!

        // Establish a live selection first, so there is state to protect.
        vi.spyOn(window, 'getSelection').mockReturnValue(
          makeSelection({
            text: 'quick',
            anchorNode: textNode,
            focusNode: textNode,
            commonAncestor: textNode,
            rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
          })
        )
        act(() => {
          harness.container.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0 })
          )
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        })
        // Fake timers provide their own requestAnimationFrame, so the frame is
        // driven by the clock rather than by flushFrames().
        await act(async () => {
          vi.advanceTimersByTime(32)
        })
        expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)

        // The page is now swapped out and the browser collapses the selection.
        harness.container.remove()
        ;(window.getSelection as ReturnType<typeof vi.fn>).mockReturnValue(
          makeSelection({
            text: '',
            // A collapsed selection is caught by the earlier bail-out, so the
            // anchor guard is only observable for a non-collapsed range whose
            // text is empty — exactly what a detach leaves behind.
            isCollapsed: false,
            anchorNode: textNode,
            focusNode: textNode,
            commonAncestor: textNode
          })
        )

        act(() => {
          document.dispatchEvent(new Event('selectionchange'))
        })
        await act(async () => {
          vi.advanceTimersByTime(200)
        })

        // Stale state is kept rather than cleared from a torn-down page.
        expect(harness.onTextSelection).toHaveBeenCalledTimes(1)
        expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('scroll lock', () => {
    it('suppresses selection work while the container is scrolling, then resumes', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(new Event('scroll'))
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        document.dispatchEvent(new Event('selectionchange'))
      })

      // Nothing is scheduled and nothing is cleared while the lock is held.
      expect(pendingFrames.size).toBe(0)
      expect(harness.onTextSelection).not.toHaveBeenCalled()
    })

    it('restores normal behaviour once the lock expires', async () => {
      vi.useFakeTimers()
      try {
        const harness = mountHook()
        const textNode = harness.container.querySelector('span')!.firstChild!
        vi.spyOn(window, 'getSelection').mockReturnValue(
          makeSelection({
            text: 'quick',
            anchorNode: textNode,
            focusNode: textNode,
            commonAncestor: textNode,
            rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
          })
        )

        act(() => {
          harness.container.dispatchEvent(new Event('scroll'))
        })
        act(() => {
          vi.advanceTimersByTime(149)
          harness.container.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0 })
          )
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        })
        expect(pendingFrames.size).toBe(0)

        act(() => {
          vi.advanceTimersByTime(1)
        })
        act(() => {
          harness.container.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0 })
          )
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        })
        // vi.useFakeTimers() installs its own requestAnimationFrame, so the
        // scheduled frame is driven by the clock rather than by flushFrames().
        await act(async () => {
          vi.advanceTimersByTime(32)
        })

        expect(harness.onTextSelection).toHaveBeenCalledWith('quick', expect.anything())
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not lock for a scroll that happened outside the container', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )
      const other = document.createElement('div')
      document.body.appendChild(other)

      act(() => {
        other.dispatchEvent(new Event('scroll'))
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)

      expect(harness.onTextSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('frame coalescing', () => {
    it('collapses several events in one frame into a single update', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick brown',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 300, bottom: 120, width: 200, height: 20 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })

      // Only the most recent frame survives.
      expect(pendingFrames.size).toBe(1)
      expect(cancelFrame).toHaveBeenCalledTimes(1)

      act(flushFrames)
      expect(harness.onTextSelection).toHaveBeenCalledTimes(1)
      expect(harness.onTextSelection).toHaveBeenCalledWith('quick brown', expect.anything())
    })

    it('cancels a pending frame on unmount so it cannot mutate state afterwards', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      expect(pendingFrames.size).toBe(1)

      harness.unmount()

      // The scheduled frame was cancelled, so flushing the queue is a no-op.
      expect(cancelFrame).toHaveBeenCalled()
      expect(pendingFrames.size).toBe(0)
      act(flushFrames)
      expect(harness.onTextSelection).not.toHaveBeenCalled()
    })

    it('removes every document listener on unmount', () => {
      const harness = mountHook()
      const removeSpy = vi.spyOn(document, 'removeEventListener')

      harness.unmount()

      const removed = removeSpy.mock.calls.map(([type]) => type)
      expect(removed).toContain('pointerdown')
      expect(removed).toContain('pointerup')
      expect(removed).toContain('selectionchange')
    })
  })

  describe('selection-active class', () => {
    it('is added only when both text and a pill position were produced', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      // A zero-area range yields no pill position, so the class must stay off.
      vi.spyOn(window, 'getSelection').mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ width: 0, height: 0 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)

      expect(harness.onTextSelection).toHaveBeenCalledWith('', null)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
    })

    it('is removed again once the selection is cleared', () => {
      const harness = mountHook()
      const textNode = harness.container.querySelector('span')!.firstChild!
      const getSelection = vi.spyOn(window, 'getSelection')
      getSelection.mockReturnValue(
        makeSelection({
          text: 'quick',
          anchorNode: textNode,
          focusNode: textNode,
          commonAncestor: textNode,
          rect: makeRect({ left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 })
        })
      )

      act(() => {
        harness.container.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0 })
        )
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      })
      act(flushFrames)
      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(true)

      getSelection.mockReturnValue(
        makeSelection({ text: '', isCollapsed: true, anchorNode: null, rangeCount: 0 })
      )
      act(() => {
        document.dispatchEvent(new Event('selectionchange'))
      })

      expect(harness.container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
    })
  })

  describe('page text extraction scheduling', () => {
    function mountExtraction(overrides: { requestIdle?: boolean } = {}) {
      const page = nextPage++
      const { container } = buildContainer(true)
      container
        .querySelector('[data-native-pdf-page]')
        ?.setAttribute('data-native-pdf-page', String(page))
      const containerRef = { current: container } as RefObject<HTMLElement | null>
      const onTextExtracted = vi.fn()
      const onNoTextFound = vi.fn()
      const onTextSelection = vi.fn()
      const rendered = renderHook(() =>
        usePdfTextActions({
          containerRef,
          currentPage: page,
          onTextSelection,
          onTextExtracted,
          onNoTextFound
        })
      )
      void overrides
      return { ...rendered, onTextExtracted, onNoTextFound, container, page }
    }

    it('uses requestIdleCallback when the browser provides it', async () => {
      vi.useFakeTimers()
      const idleCallbacks: { cb: IdleRequestCallback; options?: IdleRequestOptions }[] = []
      const cancelIdle = vi.fn()
      vi.stubGlobal(
        'requestIdleCallback',
        (cb: IdleRequestCallback, options?: IdleRequestOptions) => {
          idleCallbacks.push({ cb, options })
          return idleCallbacks.length
        }
      )
      vi.stubGlobal('cancelIdleCallback', cancelIdle)
      try {
        const harness = mountExtraction()

        act(() => {
          harness.result.current.extractCurrentPageText()
        })

        expect(idleCallbacks).toHaveLength(1)
        // A forced timeout is required: without one the callback can be starved
        // indefinitely and the selected text never reaches the AI.
        expect(idleCallbacks[0].options).toEqual({ timeout: 2000 })

        await act(async () => {
          idleCallbacks[0].cb({ didTimeout: false, timeRemaining: () => 10 } as IdleDeadline)
        })

        expect(harness.onTextExtracted).toHaveBeenCalledTimes(1)
        expect(harness.onTextExtracted.mock.calls[0][0]).toContain('quick')
        expect(harness.onNoTextFound).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('cancels a previously scheduled extraction instead of running both', () => {
      const idleCallbacks: { cb: IdleRequestCallback; options?: IdleRequestOptions }[] = []
      const cancelIdle = vi.fn()
      vi.stubGlobal(
        'requestIdleCallback',
        (cb: IdleRequestCallback, options?: IdleRequestOptions) => {
          idleCallbacks.push({ cb, options })
          return idleCallbacks.length
        }
      )
      vi.stubGlobal('cancelIdleCallback', cancelIdle)
      const harness = mountExtraction()

      act(() => {
        harness.result.current.extractCurrentPageText()
        harness.result.current.extractCurrentPageText()
      })

      expect(cancelIdle).toHaveBeenCalledWith(1)
      expect(idleCallbacks).toHaveLength(2)
    })

    it('falls back to a timeout when requestIdleCallback is unavailable', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('requestIdleCallback', undefined)
      vi.stubGlobal('cancelIdleCallback', undefined)
      try {
        const harness = mountExtraction()

        act(() => {
          harness.result.current.extractCurrentPageText()
        })
        // Nothing runs immediately; the delay lets the page render settle.
        expect(harness.onTextExtracted).not.toHaveBeenCalled()

        await act(async () => {
          vi.advanceTimersByTime(499)
        })
        expect(harness.onTextExtracted).not.toHaveBeenCalled()

        await act(async () => {
          vi.advanceTimersByTime(1)
        })

        expect(harness.onTextExtracted).toHaveBeenCalledTimes(1)
        expect(harness.onTextExtracted.mock.calls[0][0]).toContain('quick')
      } finally {
        vi.useRealTimers()
      }
    })

    it('reports "no text" when the page layer carries nothing', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('requestIdleCallback', undefined)
      vi.stubGlobal('cancelIdleCallback', undefined)
      try {
        const page = nextPage++
        const { container } = buildContainer(false)
        const containerRef = { current: container } as RefObject<HTMLElement | null>
        const onTextExtracted = vi.fn()
        const onNoTextFound = vi.fn()
        const { result } = renderHook(() =>
          usePdfTextActions({
            containerRef,
            currentPage: page,
            onTextSelection: vi.fn(),
            onTextExtracted,
            onNoTextFound
          })
        )

        act(() => {
          result.current.extractCurrentPageText()
        })
        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(onTextExtracted).not.toHaveBeenCalled()
        expect(onNoTextFound).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('cancels a pending extraction on unmount', () => {
      const cancelIdle = vi.fn()
      vi.stubGlobal('requestIdleCallback', () => 42)
      vi.stubGlobal('cancelIdleCallback', cancelIdle)
      const harness = mountExtraction()

      act(() => {
        harness.result.current.extractCurrentPageText()
      })
      harness.unmount()

      expect(cancelIdle).toHaveBeenCalledWith(42)
    })
  })
})
