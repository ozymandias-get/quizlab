/**
 * Text selection on the native viewer's PDF.js text layer.
 *
 * Everything under test here is production code: the real `usePdfTextActions`, the
 * real `extractSelectedText` and the real `collectTextItems` / `orderTextItems`,
 * driven against the markup the native viewer actually produces. Only PDF.js is
 * faked, so "the spans PDF.js writes are the spans QuizLab reads" is the claim
 * under test rather than an assumption.
 *
 * The behaviours pinned here are the ones a renderer swap silently breaks, and the
 * ones the hook cannot be tested for on its own:
 *
 *  - a selection inside the viewer that is not on the text layer is rejected — the
 *    container-level guard cannot catch it, so the text layer has to be addressable
 *  - pan mode / blocked interaction suppress the whole listener set
 *  - reading order for two columns comes from geometry, not DOM order
 *  - extraction reports the characters the range actually covers, not whole runs
 *
 * The generic selection lifecycle — coalescing, the scroll freeze, the
 * `pdf-selection-active` toggle, the detached-anchor guard, listener teardown — is
 * not repeated here. It is hook behaviour, independent of which renderer mounts the
 * layer, and `text/usePdfTextActions.test.tsx` exercises it directly against the
 * hook without a viewer harness. Only the native-specific cases above belong in this
 * file.
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'

import { extractSelectedText } from '@features/pdf/text/extractSelectedText'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  const { createPdfJsDistMock } = await import('./pdfJsMockFactories')
  return createPdfJsDistMock(mocks)
})

vi.mock('@features/pdf/engine/pdfWorker', async () => {
  const { createPdfWorkerMock } = await import('./pdfJsMockFactories')
  return createPdfWorkerMock(mocks)
})

const SELECTION_ACTIVE_CLASS = 'pdf-selection-active'

/* ------------------------------------------------------------ rAF plumbing */

let pendingFrames: Map<number, FrameRequestCallback>
let nextFrameId: number
let cancelRaf: ReturnType<typeof vi.fn>

function flushFrames(): void {
  const frames = [...pendingFrames.entries()]
  pendingFrames.clear()
  act(() => {
    for (const [, cb] of frames) cb(0)
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function waitForFrames(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await settle()
    if (pendingFrames.size > 0) {
      flushFrames()
      continue
    }
    try {
      check()
      return
    } catch (error) {
      lastError = error
    }
    if (Date.now() > deadline) throw lastError
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

/* ------------------------------------------------------- selection doubles */

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

interface FakeSelectionInit {
  text?: string
  isCollapsed?: boolean
  rangeCount?: number
  anchorNode?: Node | null
  focusNode?: Node | null
  commonAncestor?: Node | null
  rect?: DOMRect
  clientRects?: DOMRect[]
}

function makeSelection(init: FakeSelectionInit): Selection {
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

/** Give a rendered text run a real box, so geometry-based extraction can run. */
function stampSpanGeometry(
  container: HTMLElement,
  boxes: { left: number; top: number; width: number; height: number }[]
): void {
  const spans = container.querySelectorAll<HTMLElement>('span[role="presentation"]')
  spans.forEach((span, index) => {
    const box = boxes[index] ?? boxes.at(-1) ?? { left: 0, top: 0, width: 10, height: 10 }
    Object.defineProperty(span, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        makeRect({
          left: box.left,
          top: box.top,
          right: box.left + box.width,
          bottom: box.top + box.height,
          width: box.width,
          height: box.height
        })
    })
  })
}

/** The panel wrapper, so the "released inside the panel" boundary is testable. */
function panelOf(): HTMLElement {
  return screen.getByTestId('native-container')
}

/** Drive a full press-drag-release over the viewer, as the browser would. */
function selectInside(container: HTMLElement, selection: Selection): void {
  vi.spyOn(window, 'getSelection').mockReturnValue(selection)
  act(() => {
    container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
  })
  act(flushFrames)
}

function serveDocument(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(document)
    return task
  })
}

interface SelectionHarnessOptions {
  textItems?: Record<number, string[]>
  textSelectionEnabled?: boolean
  isPanMode?: boolean
  enabled?: boolean
  onTextSelection?: (text: string, position: unknown) => void
}

async function mountSelection(options: SelectionHarnessOptions = {}) {
  const onTextSelection = vi.fn()
  const document = createFakeDocument({
    numPages: 12,
    textItems: options.textItems ?? { 1: ['the', 'quick', 'brown', 'fox'] }
  })
  serveDocument(document)

  const view = render(
    <NativeViewerHarness
      enabled={options.enabled ?? true}
      isPanMode={options.isPanMode ?? false}
      textActions={{
        enabled: options.textSelectionEnabled ?? true,
        onTextSelection: options.onTextSelection ?? onTextSelection
      }}
    />
  )

  const container = panelOf()
  if (options.enabled !== false) {
    await waitForFrames(() =>
      expect(container.querySelectorAll('span[role="presentation"]').length).toBeGreaterThan(0)
    )
  }
  return { ...view, container, onTextSelection, document }
}

/* ------------------------------------------------------------------ tests */

beforeEach(() => {
  vi.clearAllMocks()
  pendingFrames = new Map()
  nextFrameId = 1
  cancelRaf = vi.fn((id: number) => {
    pendingFrames.delete(id)
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextFrameId++
    pendingFrames.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', cancelRaf)
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('native text layer — selection scope', () => {
  it('ignores a selection inside the viewer that is not the text layer', async () => {
    // The canvas is inside the panel, so the container-level guard cannot reject
    // it. On the native path the text layer is addressable, so the selection has
    // to touch *that* — otherwise "select the page chrome" would be reported as
    // PDF text.
    const { container, onTextSelection } = await mountSelection()
    const pageBox = container.querySelector('[data-native-pdf-page]') as HTMLElement

    selectInside(
      container,
      makeSelection({
        text: 'canvas chrome',
        anchorNode: pageBox,
        focusNode: pageBox,
        commonAncestor: pageBox,
        rect: makeRect({ left: 40, top: 40, right: 90, bottom: 60, width: 50, height: 20 })
      })
    )

    expect(onTextSelection).toHaveBeenCalledWith('', null)
    expect(onTextSelection).not.toHaveBeenCalledWith('canvas chrome', expect.anything())
    expect(container.classList.contains(SELECTION_ACTIVE_CLASS)).toBe(false)
  })
})

/* ------------------------------------------------------ enablement guards */

describe('native text layer — selection enablement', () => {
  it('registers no listeners at all when selection is disabled', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const { container } = await mountSelection({ textSelectionEnabled: false })
    addSpy.mockClear()

    act(() => {
      container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
      document.dispatchEvent(new Event('selectionchange'))
    })
    act(flushFrames)

    const types = addSpy.mock.calls.map(([type]) => type)
    expect(types).not.toContain('selectionchange')
    expect(pendingFrames.size).toBe(0)
  })

  it('suppresses selection while pan mode holds the viewer', async () => {
    // `usePdfTextActions` is mounted by the shared state with the same
    // `!isPanMode` condition the legacy path uses, so the listener set must be
    // gone while the drag tool owns the panel.
    const { container } = await mountSelection({
      isPanMode: true,
      textSelectionEnabled: false
    })
    const addSpy = vi.spyOn(document, 'addEventListener')

    fireEvent.pointerDown(container, { button: 0 })
    fireEvent.pointerUp(document, { button: 0 })
    act(flushFrames)

    expect(addSpy.mock.calls.map(([type]) => type)).not.toContain('selectionchange')
  })
})

/* ------------------------------------------------------------ reading order */

describe('native text layer — reading order', () => {
  it('rebuilds two-column text in column order from the run geometry', async () => {
    // PDF.js emits runs in content-stream order, so on a two-column page the DOM
    // order is top-left block, top-right block. Reading order has to come from
    // the geometry, exactly as it does on the legacy path.
    const { container } = await mountSelection({
      textItems: { 1: ['left one', 'right one', 'left two', 'right two'] }
    })

    stampSpanGeometry(container, [
      { left: 20, top: 100, width: 60, height: 12 },
      { left: 300, top: 100, width: 60, height: 12 },
      { left: 20, top: 116, width: 60, height: 12 },
      { left: 300, top: 116, width: 60, height: 12 }
    ])

    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    const runs = layer.querySelectorAll('span[role="presentation"]')
    const anchor = runs[0].firstChild as Text
    const focus = runs[3].firstChild as Text

    // A *real* `Range` spanning all four runs, with only the geometry stubbed.
    //
    // This has to be a real Range rather than an object literal: extraction asks the
    // range which part of each run it covers, because a run's box says where the run
    // is and not how much of it was dragged over. A hand-rolled double cannot answer
    // that, and one that quietly answered "all of it" would assert the very bug the
    // real Range rules out.
    const range = document.createRange()
    range.setStart(anchor, 0)
    range.setEnd(focus, focus.data.length)
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => makeRect({ left: 20, top: 100, right: 360, bottom: 128, width: 340, height: 28 })
    })
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => [
        makeRect({ left: 20, top: 100, right: 80, bottom: 112, width: 60, height: 12 }),
        makeRect({ left: 300, top: 100, right: 360, bottom: 112, width: 60, height: 12 }),
        makeRect({ left: 20, top: 116, right: 80, bottom: 128, width: 60, height: 12 }),
        makeRect({ left: 300, top: 116, right: 360, bottom: 128, width: 60, height: 12 })
      ]
    })

    const text = extractSelectedText(
      {
        toString: () => 'left one right one left two right two',
        isCollapsed: false,
        rangeCount: 1,
        anchorNode: anchor,
        focusNode: focus,
        getRangeAt: () => range
      } as unknown as Selection,
      container
    )

    // Column order, not DOM order: the left column top-to-bottom, then the right.
    expect(text?.text).toBe('left one\nleft two\nright one\nright two')
  })
})

/* ------------------------------------------------------- selection extent */

/**
 * A selection reports what was selected, not the runs it touched.
 *
 * Extraction used to keep every run whose *box* intersected any of the range's
 * client rects and then emit that run's whole text. A run's box says where the run
 * is, not how much of it the reader dragged over — and PDF.js emits one run per PDF
 * text item, which is very often a whole line. So a drag that selected one
 * character reported the whole line, and that over-reported text is what reached
 * `onTextSelection`, the quick action and the AI queue.
 *
 * Measured in the app's current Chromium over PDF.js 6.4.299's real text layer, on
 * a drag that moved 6px: the browser held 1 character and `extractSelectedText`
 * returned 72.
 * Across a 35-scenario sweep, extraction reported more text than the browser in 32.
 *
 * jsdom has no layout, so each run is stamped with a box and the range is a real
 * `Range` — the geometry is then genuinely only used for reading order.
 */
describe('native text layer — selection extent', () => {
  /** A real `Range` between two text positions, with only geometry stubbed. */
  function rangeBetween(
    startNode: Text,
    startOffset: number,
    endNode: Text,
    endOffset: number,
    rects: DOMRect[]
  ): Range {
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const union = makeRect({
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
      width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
      height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))
    })
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => union
    })
    Object.defineProperty(range, 'getClientRects', { configurable: true, value: () => rects })
    return range
  }

  function selectionOver(range: Range, anchorNode: Node, focusNode: Node): Selection {
    return {
      toString: () => range.toString(),
      isCollapsed: false,
      rangeCount: 1,
      anchorNode,
      focusNode,
      getRangeAt: () => range
    } as unknown as Selection
  }

  it('reports only the characters covered inside a single run', async () => {
    const { container } = await mountSelection({
      textItems: { 1: ['Antihypertensive agents are the drugs used'] }
    })

    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    stampSpanGeometry(container, [{ left: 20, top: 100, width: 280, height: 12 }])

    const node = layer.querySelector('span[role="presentation"]')!.firstChild as Text
    const range = rangeBetween(node, 0, node, 'Antihypertensive agents'.length, [
      makeRect({ left: 20, top: 100, right: 180, bottom: 112, width: 160, height: 12 })
    ])

    // The 25 characters past the selection must not be reported.
    expect(extractSelectedText(selectionOver(range, node, node), container)?.text).toBe(
      'Antihypertensive agents'
    )
  })

  it('reports only the covered tail of the first run and head of the second', async () => {
    const { container } = await mountSelection({
      textItems: {
        1: ['Antihypertensive agents are the drugs used', 'to treat high blood pressure']
      }
    })

    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    stampSpanGeometry(container, [
      { left: 20, top: 100, width: 280, height: 12 },
      { left: 20, top: 114, width: 280, height: 12 }
    ])

    const runs = layer.querySelectorAll('span[role="presentation"]')
    const first = runs[0].firstChild as Text
    const second = runs[1].firstChild as Text
    // From "agents" on the first line into "to treat" on the second.
    const range = rangeBetween(first, first.data.indexOf('agents'), second, 'to treat'.length, [
      makeRect({ left: 120, top: 100, right: 300, bottom: 112, width: 180, height: 12 }),
      makeRect({ left: 20, top: 114, right: 160, bottom: 126, width: 140, height: 12 })
    ])

    expect(extractSelectedText(selectionOver(range, first, second), container)?.text).toBe(
      'agents are the drugs used\nto treat'
    )
  })

  it('ignores a run the selection only passes beside', async () => {
    // The old box-intersection test pulled in any run sharing a pixel with the
    // selection's rects. The range has to decide that, not the geometry.
    const { container } = await mountSelection({
      textItems: { 1: ['left column line', 'right column line'] }
    })

    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    stampSpanGeometry(container, [
      { left: 20, top: 100, width: 200, height: 12 },
      { left: 260, top: 100, width: 200, height: 12 }
    ])

    const node = layer.querySelector('span[role="presentation"]')!.firstChild as Text
    const range = rangeBetween(node, 0, node, 'left column'.length, [
      makeRect({ left: 20, top: 100, right: 220, bottom: 112, width: 200, height: 12 })
    ])

    expect(extractSelectedText(selectionOver(range, node, node), container)?.text).toBe(
      'left column'
    )
  })

  it('still reports a whole page when the whole page was selected', async () => {
    // The change is proportionality, not a cap: a reader who really does drag down
    // the page must still get the page.
    const longPage = Array.from({ length: 8 }, (_, i) => `line number ${i} of the page`)
    const { container } = await mountSelection({ textItems: { 1: longPage } })

    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    const runs = [...layer.querySelectorAll('span[role="presentation"]')]
    stampSpanGeometry(
      container,
      longPage.map((_, i) => ({ left: 20, top: 100 + i * 14, width: 200, height: 12 }))
    )

    const first = runs[0].firstChild as Text
    const last = runs.at(-1)!.firstChild as Text
    const range = rangeBetween(
      first,
      0,
      last,
      (last as Text).data.length,
      longPage.map((_, i) =>
        makeRect({
          left: 20,
          top: 100 + i * 14,
          right: 220,
          bottom: 112 + i * 14,
          width: 200,
          height: 12
        })
      )
    )

    expect(extractSelectedText(selectionOver(range, first, last), container)?.text).toBe(
      longPage.join('\n')
    )
  })

  it('falls back to the browser string when the layer has no geometry', async () => {
    // No boxes at all — the layer is present but not laid out. Nothing can be
    // measured, so extraction must hand back exactly what the browser holds rather
    // than nothing, which is what a hard dependency on geometry would produce.
    const { container } = await mountSelection({ textItems: { 1: ['plain fallback text'] } })
    const layer = container.querySelector('[data-native-pdf-text-layer]') as HTMLElement
    const node = layer.querySelector('span[role="presentation"]')!.firstChild as Text

    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 'plain'.length)
    const selection = {
      toString: () => 'plain',
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: node,
      focusNode: node,
      getRangeAt: () => range
    } as unknown as Selection
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => makeRect({ left: 20, top: 100, right: 90, bottom: 112, width: 70, height: 12 })
    })

    expect(extractSelectedText(selection, container)?.text).toBe('plain')
  })
})
