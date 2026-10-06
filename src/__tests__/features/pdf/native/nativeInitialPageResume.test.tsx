/**
 * Reading-progress resume, on the native viewer.
 *
 * `initialPage` mirrors persisted reading progress, so it changes on every page
 * turn. The rule that keeps that from being a bug — *consume it once per file,
 * never again while reading that file* — used to be covered by tests that drove
 * the legacy viewer element. Those tests go with RPV, and the behaviour itself is a
 * user-visible product contract: without it, turning to page 7 would snap the
 * viewer back to the saved page.
 *
 * The native owner of that rule is `useNativePdfPageState`'s `consumedIdentityRef`,
 * keyed on `(pdfUrl, reloadKey)`. These tests drive the **real** controller and
 * assert on the page the viewer actually renders, not on an internal setter, so
 * the whole chain — `initialPage` into the controller, into the page state, into
 * the page box — is what is covered.
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render, waitFor } from '@testing-library/react'
import type { NativePdfController } from '@features/pdf/native/useNativePdfController'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-6', async () => {
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

/** Fit scale for a 400×600 page in an 800×1000 container: min(2, 1.666…) → 1.67. */
const FIT_SCALE = 1.67

let frameCallbacks: FrameRequestCallback[]

beforeEach(() => {
  vi.clearAllMocks()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function flushFrames(): void {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
}

function serve(numPages: number): FakeDocument {
  const document = createFakeDocument({ numPages })
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(document)
    return task
  })
  return document
}

interface Mounted {
  controller: () => NativePdfController
  renderedPage: () => number
  rerender: (props: { pdfUrl?: string; initialPage?: number; reloadKey?: number }) => void
}

/** Mount the real controller against a served document and wait for page 1. */
async function mount(props: {
  numPages?: number
  pdfUrl?: string
  initialPage?: number
  reloadKey?: number
}): Promise<Mounted> {
  serve(props.numPages ?? 20)

  let controller: NativePdfController | null = null
  const view = render(
    <NativeViewerHarness
      pdfUrl={props.pdfUrl ?? 'local-pdf://resume'}
      reloadKey={props.reloadKey ?? 0}
      initialPage={props.initialPage}
      onController={(c) => (controller = c)}
    />
  )

  await waitFor(() => {
    expect((controller as unknown as NativePdfController).status).toBe('ready')
  })
  await waitFor(() => {
    expect(view.container.querySelector('[data-native-pdf-page]')).toBeInTheDocument()
  })
  // The fit scale lands a frame after the first render; drain it so the scale is
  // settled before any test asserts on it.
  await act(async () => {
    await Promise.resolve()
  })
  if (frameCallbacks.length > 0) flushFrames()

  const current = () => controller as unknown as NativePdfController
  const renderedPage = () =>
    Number(
      view.container.querySelector('[data-native-pdf-page]')?.getAttribute('data-native-pdf-page')
    )

  return {
    controller: current,
    renderedPage,
    rerender: (next) => {
      view.rerender(
        <NativeViewerHarness
          pdfUrl={next.pdfUrl ?? props.pdfUrl ?? 'local-pdf://resume'}
          reloadKey={next.reloadKey ?? props.reloadKey ?? 0}
          initialPage={next.initialPage ?? props.initialPage}
          onController={(c) => (controller = c)}
        />
      )
    }
  }
}

/** The page the viewer is showing, after letting effects and renders settle. */
async function shownPage(view: Mounted): Promise<number> {
  await act(async () => {
    await Promise.resolve()
  })
  if (frameCallbacks.length > 0) flushFrames()
  await waitFor(() => {
    expect(view.renderedPage()).toBe(view.controller().currentPage)
  })
  return view.renderedPage()
}

describe('native viewer — reading-progress resume', () => {
  it('opens on the saved page for that file', async () => {
    const view = await mount({ initialPage: 8 })

    expect(await shownPage(view)).toBe(8)
  })

  it('opens on page 1 when nothing has been saved', async () => {
    const view = await mount({})

    expect(await shownPage(view)).toBe(1)
  })

  // A resume page recorded against a longer revision of the file, or a file that
  // shrank since, must not push the viewer past the end.
  it('clamps a saved page that is beyond the document', async () => {
    const view = await mount({ numPages: 10, initialPage: 40 })

    expect(await shownPage(view)).toBe(10)
  })

  // The legacy "no resume zoom hack" contract: consuming the saved page must move
  // the page, not the zoom. The native path reaches the same fit scale from its own
  // scale state, so a resume cannot perturb it.
  it('resuming the page does not change the zoom level', async () => {
    const view = await mount({ initialPage: 8 })

    expect(view.controller().scale).toBeCloseTo(FIT_SCALE, 2)

    await shownPage(view)

    expect(view.controller().scale).toBeCloseTo(FIT_SCALE, 2)
  })

  it('does not re-apply the saved page while the reader turns pages', async () => {
    const view = await mount({ initialPage: 3 })
    expect(await shownPage(view)).toBe(3)

    // The reader navigates, and reading progress persists the new page, so the
    // same file now reports a different `initialPage`. Reading it again would be
    // a no-op here, which is exactly why the case that actually discriminates is
    // the next one.
    await act(async () => {
      view.controller().jumpToPage(7)
      await Promise.resolve()
    })
    expect(await shownPage(view)).toBe(7)

    view.rerender({ initialPage: 7 })

    expect(await shownPage(view)).toBe(7)
  })

  // The load-bearing case. `initialPage` is a *mirror* of persisted progress, not
  // a navigation command: it can legitimately carry a page that is not where the
  // reader currently is — another surface wrote progress for the same file, a link
  // jumped them ahead, or a slower write landed late. Re-consuming it would yank
  // the viewport out from under them, mid-read, with no user action.
  //
  // The saved page has to *change value* for this to be testable at all: the
  // consume-once effect keys on `(pdfUrl, reloadKey)` and only re-runs when
  // `initialPage` differs, so re-rendering with the same number would pass with or
  // without the guard.
  it('ignores a saved page that no longer matches where the reader is', async () => {
    const view = await mount({ initialPage: 3 })
    expect(await shownPage(view)).toBe(3)

    // The reader follows a link to page 9.
    await act(async () => {
      view.controller().jumpToPage(9)
      await Promise.resolve()
    })
    expect(await shownPage(view)).toBe(9)

    // Progress for the file is rewritten from another surface and now describes
    // page 7 — a different number, for a file the viewer has already consumed.
    view.rerender({ initialPage: 7 })

    expect(await shownPage(view)).toBe(9)
  })

  it('consumes the saved page again for a different file', async () => {
    const view = await mount({ pdfUrl: 'local-pdf://a', initialPage: 3 })
    expect(await shownPage(view)).toBe(3)

    view.rerender({ pdfUrl: 'local-pdf://b', initialPage: 9 })

    await act(async () => {
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(view.controller().currentPage).toBe(9)
    })
  })

  it('consumes the saved page again after a reload of the same file', async () => {
    const view = await mount({ pdfUrl: 'local-pdf://a', initialPage: 3 })
    expect(await shownPage(view)).toBe(3)

    await act(async () => {
      view.controller().jumpToPage(6)
      await Promise.resolve()
    })
    expect(await shownPage(view)).toBe(6)

    // A reload is a new document generation for the same URL, so the reader's
    // position is re-consumed rather than left behind.
    view.rerender({ reloadKey: 1 })

    await act(async () => {
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(view.controller().currentPage).toBe(3)
    })
  })
})
