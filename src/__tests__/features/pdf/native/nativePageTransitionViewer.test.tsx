/**
 * The page turn, end to end: which page changes get a presentation, in which
 * direction, on which element, and exactly how many times.
 *
 * ## What is under test
 *
 * The state machine that decides "this is a page turn" and "this is a document
 * lifecycle event" — the part that cannot be read off a stylesheet and cannot be
 * checked quickly by a human, because each case takes a specific sequence of page
 * turns, reloads and document switches to reach.
 *
 * The real engine runs here, exactly as in `NativePdfViewer.test.tsx`: only the
 * `pdfjs-dist` boundary is faked, so the page cache, the generation guard and the
 * supersede-cancel in `pageRenderer.ts` are production code. That matters for this
 * file in particular, because most of the contract below is about what happens to a
 * render that arrives *after* the reader has already turned again.
 *
 * ## The recorder, and what it does not claim
 *
 * jsdom implements neither layout nor the Web Animations API, so `Element.animate` is
 * replaced with a recorder. That makes the *arguments* the presentation was created with
 * an asserted contract — direction, timing, target element, supersession — while
 * interpolation and paint stay the browser's business. `nativePageTransition.test.ts`
 * pins the keyframes and timing themselves; `nativePageLayout.test.tsx` already pins the
 * page box's centering and scroll contract, and the one place this file touches it is
 * the guarantee that a turn does not disturb it.
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useNativePdfController } from '@features/pdf/native/useNativePdfController'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  const { FakeAnnotationLayer } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: FakeTextLayer,
    AnnotationLayer: FakeAnnotationLayer,
    RenderingCancelledException: class RenderingCancelledException extends Error {
      constructor(message = 'Rendering cancelled') {
        super(message)
        this.name = 'RenderingCancelledException'
      }
    }
  }
})

vi.mock('@features/pdf/engine/pdfWorker', () => ({
  initializeNativePdfWorker: mocks.initializeNativePdfWorker,
  nativeWorkerUrl: 'pdf.worker.min.test.mjs',
  resetNativePdfWorkerForTests: vi.fn()
}))

interface PresentedTurn {
  /** The element the animation was attached to. */
  element: Element
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions | number | undefined
  cancel: ReturnType<typeof vi.fn>
}

let turns: PresentedTurn[]
let frameCallbacks: FrameRequestCallback[]
let originalAnimate: Element['animate'] | undefined

/**
 * State the reduced-motion preference for every test in the file.
 *
 * The shared `src/__tests__/setup.ts` stub answers `matches: false`, and the global
 * `afterEach` resets mock implementations, so the preference is stated explicitly in
 * `beforeEach` — otherwise a test that asked for reduced motion would leak into every
 * test that runs after it, in this file and in the next one.
 */
function setPrefersReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  turns = []
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  setPrefersReducedMotion(false)

  // One `cancel` per presented turn, so "the previous turn was dropped" is assertable
  // without attributing a shared mock's call count to the wrong animation.
  originalAnimate = Element.prototype.animate
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions | number
  ) {
    const cancel = vi.fn()
    turns.push({ element: this, keyframes, options, cancel })
    return { cancel, finished: Promise.resolve(this) } as unknown as Animation
  } as Element['animate']
})

afterEach(() => {
  if (originalAnimate) {
    Element.prototype.animate = originalAnimate
  } else {
    delete (Element.prototype as { animate?: Element['animate'] }).animate
  }
  vi.unstubAllGlobals()
})

function flushFrames(): void {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
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
    if (frameCallbacks.length > 0) {
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

/** Serve a document the moment the viewer asks for one. */
function serveDocument(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(document)
    return task
  })
}

interface HarnessProps {
  pdfUrl: string
  reloadKey: number
  initialPage?: number
}

interface MountedViewer {
  /** The document the viewer is currently serving. */
  document: FakeDocument
  control: { current: ReturnType<typeof useNativePdfController> | null }
  container: HTMLElement
  rerender: (props: Partial<HarnessProps>) => void
  unmount: () => void
}

interface MountOptions {
  numPages?: number
  /** `false` leaves every render promise to the test, which is how a race is staged. */
  settleRenders?: boolean
  pdfUrl?: string
  reloadKey?: number
  initialPage?: number
  /** Wait for the fit scale's second render too. On by default. */
  waitForFit?: boolean
}

async function mountViewer(options: MountOptions = {}): Promise<MountedViewer> {
  const document = createFakeDocument({
    numPages: options.numPages ?? 12,
    settleRenders: options.settleRenders ?? true
  })
  serveDocument(document)

  const props: HarnessProps = {
    pdfUrl: options.pdfUrl ?? 'local-pdf://a',
    reloadKey: options.reloadKey ?? 0,
    initialPage: options.initialPage
  }
  const control: { current: ReturnType<typeof useNativePdfController> | null } = { current: null }
  const element = (extra: Partial<HarnessProps>) => (
    <NativeViewerHarness
      {...props}
      {...extra}
      onController={(c) => {
        control.current = c
      }}
    />
  )

  const view = render(element({}))
  await waitForFrames(() => expect(view.container.querySelector('canvas')).toBeTruthy())

  if (options.waitForFit ?? true) {
    // A 400×600 page in the harness's 800×1000 container fits at 1.67, so the scale
    // moving off 1 is proof that the placeholder render and the fit render are both done.
    // Several tests count renders, and a fit render landing mid-count would blur them.
    await waitForFrames(() => expect(control.current?.scale).toBeGreaterThan(1))
    flushFrames()
    await settle()
  }

  return {
    document,
    control,
    container: view.container,
    rerender: (extra) => view.rerender(element(extra)),
    unmount: view.unmount
  }
}

function pageBoxOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-native-pdf-page]')
}

/** The first keyframe's transform — which direction the turn entered from. */
function enteredFrom(turn: PresentedTurn): string {
  return String(turn.keyframes[0]?.transform)
}

/* ------------------------------------------------------------------ a turn */

describe('native page transition — one turn, in its own direction', () => {
  it('presents nothing when the document first opens', async () => {
    const { container } = await mountViewer()

    // Opening a PDF is not a page turn. A first-load "you are now on page 1"
    // presentation is exactly the noise this phase exists to remove.
    await waitForFrames(() =>
      expect(pageBoxOf(container)).toHaveAttribute('data-native-pdf-page', '1')
    )
    expect(turns).toHaveLength(0)
  })

  it('presents a forward turn for the next page', async () => {
    const { container, control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // Forward enters from below, which is the way a downward wheel gesture turns.
    expect(enteredFrom(turns[0])).toContain('translateY(8px)')
    expect(pageBoxOf(container)).toHaveAttribute('data-native-pdf-page', '2')
  })

  it('presents a backward turn for the previous page', async () => {
    const { control } = await mountViewer({ initialPage: 9 })

    await waitForFrames(() => expect(control.current?.currentPage).toBe(9))

    act(() => control.current?.goToPreviousPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // The exact mirror of the forward turn, so the motion always agrees with the
    // navigation the reader asked for.
    expect(enteredFrom(turns[0])).toContain('translateY(-8px)')
    expect(control.current?.currentPage).toBe(8)
  })

  it('presents one forward turn for a jump of any size', async () => {
    // The shape an internal PDF link takes. Comparing page numbers is the whole rule, so
    // a jump is one presentation rather than a twenty-seven-step sequence.
    const { control } = await mountViewer({ numPages: 40, initialPage: 5 })

    await waitForFrames(() => expect(control.current?.currentPage).toBe(5))

    act(() => control.current?.jumpToPage(32))
    await waitForFrames(() => expect(turns).toHaveLength(1))

    expect(enteredFrom(turns[0])).toContain('translateY(8px)')
    expect(control.current?.currentPage).toBe(32)
  })

  it('presents nothing when the requested page is the page already shown', async () => {
    const { control } = await mountViewer({ initialPage: 4 })

    await waitForFrames(() => expect(control.current?.currentPage).toBe(4))

    act(() => control.current?.jumpToPage(4))
    await waitForFrames(() => expect(control.current?.currentPage).toBe(4))
    await settle()

    // Every navigation in this viewer is clamped, so "already there" is an ordinary
    // request rather than an error, and it must not replay a turn.
    expect(turns).toHaveLength(0)
  })
})

/* ---------------------------------------------------------- what moves */

describe('native page transition — the whole page stack moves as one', () => {
  it('presents on the page box, never on the canvas alone', async () => {
    const { container, control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // The canvas is the element a canvas-only animation would target, and it is the one
    // element that must not be: it knows nothing about where the text runs, the link
    // hitboxes or the search highlights are.
    const page = pageBoxOf(container)
    expect(turns[0].element).toBe(page)
    expect(turns[0].element).not.toBe(container.querySelector('[data-native-pdf-canvas]'))
  })

  it('presents on a box that owns all four layers', async () => {
    const { container, control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    const page = pageBoxOf(container)
    for (const selector of [
      '[data-native-pdf-canvas]',
      '[data-native-pdf-text-layer]',
      '[data-native-pdf-annotation-layer]',
      '[data-native-pdf-search-layer]'
    ]) {
      // One transform on one box is what keeps a selected span, a search highlight and a
      // link's hitbox on the same coordinate system as the glyphs under them.
      expect(page?.querySelector(selector), selector).not.toBe(null)
    }
  })

  it('leaves the centering and scroll contract exactly as it was', async () => {
    const { container, control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    const scroll = container.querySelector('[data-native-pdf-scroll]')
    const page = pageBoxOf(container)

    // `m-auto` is what centers a short page and keeps a tall page's top edge scrollable.
    // A transform cannot change it, and the transition must not have moved it onto the
    // canvas or onto a new wrapper to make room for itself.
    expect([...(page?.classList ?? [])]).toContain('m-auto')
    expect(page?.parentElement).toBe(scroll)
    expect(scroll?.children.length).toBe(1)
    // And the timing it asked for is the project's own, not a private number.
    expect(turns[0].options).toEqual({
      duration: 140,
      easing: 'cubic-bezier(0.2, 0.9, 0.22, 1)',
      fill: 'none'
    })
  })

  it('moves every layer, not just the one that has finished painting', async () => {
    const { container, control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // One transform on the page box is the whole synchronisation story: the canvas, the text
    // runs, the link hitboxes and the highlight rectangles are all descendants of it, so
    // they cannot drift apart no matter what order their own async renders complete in.
    const page = pageBoxOf(container)
    expect(turns[0].element).toBe(page)
    const layers = page?.children ?? []
    expect(layers).toHaveLength(4)
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index]
      expect(layer.parentElement, layer.getAttribute('class') ?? layer.tagName).toBe(page)
    }
  })

  it('presents a shallow opacity ramp, so a layer that arrives late is not a flicker', async () => {
    const { control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // The canvas commits before the text layer and the annotation layer, so for a moment the
    // page box holds a canvas with no words on it. A deep ramp turns that interim state into
    // a visible blink; a shallow one makes it imperceptible. The travel carries the direction
    // instead, which is why 8px still matters.
    const [first] = turns[0].keyframes
    expect(first.opacity).toBeGreaterThan(0.9)
    expect(first.opacity).toBeLessThan(1)
  })
})

/* ------------------------------------------- presentation vs the render path */

describe('native page transition — the render never waits for the presentation', () => {
  it('starts the render immediately and presents only once it commits', async () => {
    const { document, container, control } = await mountViewer({ settleRenders: false })

    // Nothing has been painted yet, so there is no baseline to turn from.
    expect(turns).toHaveLength(0)

    await act(async () => {
      document.page(1).settleLastRender()
      await settle()
    })
    expect(turns).toHaveLength(0)

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(document.page(2).renderCalls.length).toBeGreaterThan(0))

    // The new page's render has already been requested and no presentation exists yet,
    // because the presentation waits for pixels rather than the other way round. Had the
    // transition been awaited anywhere, this is the assertion that would fail.
    expect(turns).toHaveLength(0)

    await act(async () => {
      document.page(2).settleLastRender()
      await settle()
    })

    expect(turns).toHaveLength(1)
    expect(pageBoxOf(container)).toHaveAttribute('data-native-pdf-page', '2')
  })

  it('never presents a turn for a render that was already superseded', async () => {
    const { document, control } = await mountViewer({ settleRenders: false })

    await act(async () => {
      document.page(1).settleLastRender()
      await settle()
    })

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(document.page(2).renderCalls.length).toBeGreaterThan(0))
    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(document.page(3).renderCalls.length).toBeGreaterThan(0))

    // Page 2's render was abandoned mid-flight and is only now settling. It must not put
    // a turn on screen for a page the reader has already turned past.
    await act(async () => {
      document.page(2).settleLastRender()
      await settle()
    })
    expect(turns).toHaveLength(0)

    await act(async () => {
      document.page(3).settleLastRender()
      await settle()
    })
    expect(turns).toHaveLength(1)
    expect(control.current?.currentPage).toBe(3)
  })

  it('does not replay a turn when a zoom re-renders the same page', async () => {
    const { control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // A zoom re-renders the page already on screen. That is a commit, and a commit that
    // replayed the last turn would make zooming feel like a page turn that never happened.
    act(() => control.current?.zoomTo(1.5))
    flushFrames()
    await waitForFrames(() => expect(control.current?.scale).toBe(1.5))

    expect(turns).toHaveLength(1)
  })

  it('costs exactly one canvas render per turn and no extra page work', async () => {
    const { document, control } = await mountViewer()

    const outgoingRenders = document.page(1).renderCalls.length

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    // One render of the new page, and no re-render of the page being replaced. A
    // presentation that painted, or a snapshot of the outgoing canvas, would show up here
    // as more than one render.
    expect(document.page(2).renderCalls).toHaveLength(1)
    expect(document.page(1).renderCalls).toHaveLength(outgoingRenders)
    expect(document.renderCallsForAllPages).toHaveLength(outgoingRenders + 1)
  })

  it('does not blank the canvas between the navigation and the new page', async () => {
    // The regression this pins is invisible to jsdom's pixels but not to jsdom's canvas:
    // sizing the canvas resets its backing store, so an unguarded assignment emptied it at
    // navigation time, before the new page had painted anything, and the gap was white
    // because PDF.js fills the page background before it draws. Counting the assignments is
    // how a jsdom test can see it.
    const { document: pdf, container, control } = await mountViewer({ settleRenders: false })

    const canvas = container.querySelector<HTMLCanvasElement>('[data-native-pdf-canvas]')!
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!
    let resets = 0
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: () => descriptor.get!.call(canvas),
      set: (value: number) => {
        resets += 1
        descriptor.set!.call(canvas, value)
      }
    })

    await act(async () => {
      pdf.page(1).settleLastRender()
      await settle()
    })

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(pdf.page(2).renderCalls.length).toBeGreaterThan(0))

    // The canvas was not emptied between the two renders. Same document, same scale, so
    // the new page needs the same box and there was nothing to reset.
    expect(resets).toBe(0)

    await act(async () => {
      pdf.page(2).settleLastRender()
      await settle()
    })
    expect(turns).toHaveLength(1)
  })

  it('does resize the canvas when a zoom needs a different box', async () => {
    // The other half of the guard: skipping a *redundant* resize is not the same as
    // skipping resizes. A zoom genuinely changes the page box, and the layout - the
    // centering `m-auto` and the scrollable overflow - follows from it.
    const { container, control } = await mountViewer()

    const canvas = container.querySelector<HTMLCanvasElement>('[data-native-pdf-canvas]')!
    // The harness's fit scale lands at 1.67, so 1 is a different box - and it is inside the
    // product's zoom range, so nothing clamps it back to the fit scale.
    expect(canvas.width).toBeGreaterThan(400)

    act(() => control.current?.zoomTo(1))
    await waitForFrames(() => expect(control.current?.scale).toBe(1))
    await waitForFrames(() => expect(canvas.width).toBe(400))

    // The canvas followed the zoom rather than keeping a stale box.
    expect(canvas.width).toBe(400)
  })
})

/* -------------------------------------------------------- rapid navigation */

describe('native page transition — a burst of turns', () => {
  it('presents one turn for the page that landed, not one per tick', async () => {
    const { document, control } = await mountViewer({ numPages: 40, settleRenders: false })

    await act(async () => {
      document.page(1).settleLastRender()
      await settle()
    })

    // Four turns, faster than any 140 ms presentation could finish.
    act(() => {
      control.current?.goToNextPage()
      control.current?.goToNextPage()
      control.current?.goToNextPage()
      control.current?.goToNextPage()
    })
    await waitForFrames(() => expect(control.current?.currentPage).toBe(5))
    expect(turns).toHaveLength(0)

    await act(async () => {
      document.page(5).settleLastRender()
      await settle()
    })

    // One presentation, one direction. The queue the reader would have felt if each tick
    // had been awaited is exactly what this asserts is absent.
    expect(turns).toHaveLength(1)
    expect(enteredFrom(turns[0])).toContain('translateY(8px)')
  })

  it('supersedes the turn still on screen rather than stacking a second one', async () => {
    const { control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(2))

    // The first presentation is dropped instead of being left to finish underneath the
    // second. Two overlapping ramps are what reads as a stutter.
    expect(turns[0].cancel).toHaveBeenCalledTimes(1)
    expect(turns[1].cancel).not.toHaveBeenCalled()
  })

  it('drops the presentation still running when the viewer unmounts', async () => {
    const { control, unmount } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(turns).toHaveLength(1))

    unmount()

    // A presentation outliving its viewer would keep a composited layer alive on a
    // detached node for the rest of the session.
    expect(turns[0].cancel).toHaveBeenCalledTimes(1)
  })
})

/* ------------------------------------------------- lifecycle, not a turn */

describe('native page transition — document lifecycle events are not turns', () => {
  it('presents nothing for the resume page the document opens on', async () => {
    const { control } = await mountViewer({ initialPage: 9 })

    await waitForFrames(() => expect(control.current?.currentPage).toBe(9))
    expect(turns).toHaveLength(0)
  })

  it('presents nothing when the resume page is clamped to a shorter document', async () => {
    // The load sequence's awkward case: the resume page is applied while the page count is
    // still unknown, a render of that out-of-range page can commit, and the clamp then
    // moves the viewer backwards through a file it never turned a page of.
    const { control } = await mountViewer({ initialPage: 99 })

    await waitForFrames(() => expect(control.current?.currentPage).toBe(12))
    expect(turns).toHaveLength(0)
  })

  it('presents nothing for a reload of the same file', async () => {
    const { control, rerender } = await mountViewer()

    act(() => control.current?.jumpToPage(5))
    await waitForFrames(() => expect(control.current?.currentPage).toBe(5))
    const presentedBeforeReload = turns.length

    // Same URL, new document generation, and with no resume page the fresh copy opens at
    // page 1. Going 5 → 1 is the strongest version of the case: four pages backwards, and
    // still a lifecycle change rather than a turn.
    const reloaded = createFakeDocument({ numPages: 40 })
    serveDocument(reloaded)
    rerender({ reloadKey: 1 })

    await waitForFrames(() => expect(reloaded.page(1).renderCalls.length).toBeGreaterThan(0))
    await waitForFrames(() => expect(control.current?.currentPage).toBe(1))

    expect(turns).toHaveLength(presentedBeforeReload)
  })

  it('presents nothing when the document is switched for a different file', async () => {
    const { control, rerender } = await mountViewer({ pdfUrl: 'local-pdf://a' })

    act(() => control.current?.jumpToPage(5))
    await waitForFrames(() => expect(control.current?.currentPage).toBe(5))
    const presentedBeforeSwitch = turns.length

    const other = createFakeDocument({ numPages: 12 })
    serveDocument(other)
    rerender({ pdfUrl: 'local-pdf://b' })

    await waitForFrames(() => expect(other.page(1).renderCalls.length).toBeGreaterThan(0))
    await waitForFrames(() => expect(control.current?.currentPage).toBe(1))

    // Page 5 to page 1 across two documents is a document swap, not navigation, however
    // far apart the page numbers are.
    expect(turns).toHaveLength(presentedBeforeSwitch)
  })
})

/* ------------------------------------------------------------ reduced motion */

describe('native page transition — reduced motion', () => {
  it('navigates without presenting anything when the reader asked for reduced motion', async () => {
    setPrefersReducedMotion(true)

    const { control } = await mountViewer()

    act(() => control.current?.goToNextPage())
    await waitForFrames(() => expect(control.current?.currentPage).toBe(2))
    await settle()

    // Navigation is the product feature and it is untouched: the page moved, and no
    // presentation was created — not a zero-length one, none.
    expect(turns).toHaveLength(0)
  })
})
