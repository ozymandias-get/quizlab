/**
 * Page text extraction on the native viewer — the "add current page text to AI"
 * source.
 *
 * The source is the PDF.js text layer the native viewer mounts, read by the
 * **real** `extractPageTextFromDom` and the **real** `normalizePdfText`. There is
 * no OCR, no canvas readback and no second parse of the PDF: what the user sees
 * selectable is what is sent.
 *
 * Pinned here:
 *
 *  - the current page's runs, in reading order, normalized
 *  - the idle-deferred scheduling (`requestIdleCallback` with a forced timeout,
 *    and the 500 ms `setTimeout` fallback) is unchanged
 *  - a page with no text reports "nothing found" rather than an empty string
 *  - a page whose layer has not arrived falls back to the page box, and then to
 *    nothing
 *  - a page switch reads the new page, not a cached one
 */
import { NativeViewerHarness, createFakeDocument, createLoadingTask } from './nativeViewerHarness'

import { act, fireEvent, render, screen } from '@testing-library/react'
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

let frameCallbacks: FrameRequestCallback[]

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

async function waitFor(check: () => void, timeoutMs = 2000): Promise<void> {
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

function serveDocument(document: ReturnType<typeof createFakeDocument>): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(document)
    return task
  })
}

function makeRect(partial: Partial<DOMRect>): DOMRect {
  const rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }
  Object.assign(rect, partial)
  return rect as DOMRect
}

interface MountOptions {
  textItems?: Record<number, string[]>
  idle?: boolean
}

async function mountExtraction(options: MountOptions = {}) {
  const onTextExtracted = vi.fn()
  const onNoTextFound = vi.fn()
  const document = createFakeDocument({
    numPages: 6,
    textItems: options.textItems ?? { 1: ['the native page text'], 2: ['second page text'] }
  })
  serveDocument(document)

  const control: {
    current: { currentPage: number; goToNextPage: () => void } | null
  } = { current: null }

  const view = render(
    <NativeViewerHarness
      onController={(c) => {
        control.current = c
      }}
      textActions={{ enabled: false, onTextExtracted, onNoTextFound }}
    />
  )

  const container = screen.getByTestId('native-container')
  const items = options.textItems ?? { 1: ['the native page text'], 2: ['second page text'] }
  // Wait for the layer itself, and for its runs only when the page has any —
  // a text-free page produces an empty layer, which is the case under test in
  // more than one test below.
  const expectRuns = (items[1] ?? []).length > 0

  await waitFor(() => {
    const layer = container.querySelector('[data-native-pdf-text-layer]')
    expect(layer).not.toBe(null)
    if (expectRuns) {
      expect(layer?.querySelectorAll('span[role="presentation"]').length).toBeGreaterThan(0)
    }
  })

  return {
    ...view,
    container,
    document,
    control,
    onTextExtracted,
    onNoTextFound,
    trigger: () => fireEvent.click(screen.getByTestId('native-extract-trigger')),
    idle: options.idle ?? true
  }
}

/** Give every rendered run a real box so geometry ordering is exercised. */
function stampGeometry(container: HTMLElement, boxes: DOMRect[]): void {
  container.querySelectorAll<HTMLElement>('span[role="presentation"]').forEach((span, index) => {
    const box = boxes[index]
    if (!box) return
    Object.defineProperty(span, 'getBoundingClientRect', {
      configurable: true,
      value: () => box
    })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

/* ------------------------------------------------------------- extraction */

describe('native page text — content', () => {
  it('reads the current page text out of the native text layer', async () => {
    const harness = await mountExtraction()

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onTextExtracted).toHaveBeenCalledTimes(1))

    expect(harness.onTextExtracted.mock.calls[0][0]).toBe('the native page text')
    expect(harness.onNoTextFound).not.toHaveBeenCalled()
  })

  it('normalizes the text it sends', async () => {
    // Ligatures, CRLF runs, tabs and runs of spaces are the exact rules
    // `normalizePdfText` has always applied; they must apply on the native path
    // too, because the text is fed straight into an AI prompt.
    const harness = await mountExtraction({
      textItems: { 1: ['eﬃcient ﬁzzy', 'waffle\r\nhouse\tstop', '  trailing  '] }
    })

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onTextExtracted).toHaveBeenCalledTimes(1))

    const text = harness.onTextExtracted.mock.calls[0][0] as string
    expect(text).toContain('efficient')
    expect(text).toContain('fizzy')
    expect(text).toContain('waffle\nhouse stop')
    expect(text).not.toContain('\t')
    expect(text).not.toContain('\r')
    expect(text).not.toMatch(/ {2}/)
  })

  it('rebuilds a two-column page in column order from the run geometry', async () => {
    const harness = await mountExtraction({
      textItems: { 1: ['left one', 'right one', 'left two', 'right two'] }
    })
    stampGeometry(harness.container, [
      makeRect({ left: 20, top: 100, right: 80, bottom: 112, width: 60, height: 12 }),
      makeRect({ left: 300, top: 100, right: 360, bottom: 112, width: 60, height: 12 }),
      makeRect({ left: 20, top: 116, right: 80, bottom: 128, width: 60, height: 12 }),
      makeRect({ left: 300, top: 116, right: 360, bottom: 128, width: 60, height: 12 })
    ])

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onTextExtracted).toHaveBeenCalledTimes(1))

    // DOM order is content-stream order; reading order has to come from geometry.
    expect(harness.onTextExtracted.mock.calls[0][0]).toBe(
      'left one\nleft two\nright one\nright two'
    )
  })

  it('reads the page that is actually on screen after a page change', async () => {
    const harness = await mountExtraction()

    act(() => harness.control.current?.goToNextPage())
    await waitFor(() =>
      expect(harness.container.querySelector('[data-native-pdf-text-layer]')?.textContent).toBe(
        'second page text'
      )
    )

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onTextExtracted).toHaveBeenCalledTimes(1))

    expect(harness.onTextExtracted.mock.calls[0][0]).toBe('second page text')
  })

  it('reports nothing found for a page with no text at all', async () => {
    const harness = await mountExtraction({ textItems: { 1: [], 2: [] } })

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onNoTextFound).toHaveBeenCalledTimes(1))

    expect(harness.onTextExtracted).not.toHaveBeenCalled()
  })

  it('falls back to the page box when the layer is not mounted yet', async () => {
    const harness = await mountExtraction()
    // A layer that failed to mount leaves an empty page box behind; the page-box
    // fallback must still answer rather than reporting "no text".
    harness.container.querySelector('[data-native-pdf-text-layer]')?.remove()
    harness.container.querySelector('[data-native-pdf-page]')?.append('fallback page text content')

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onTextExtracted).toHaveBeenCalledTimes(1))

    expect(harness.onTextExtracted.mock.calls[0][0]).toBe('fallback page text content')
  })

  it('reports nothing found when neither the layer nor the page box has text', async () => {
    const harness = await mountExtraction()
    harness.container.querySelector('[data-native-pdf-text-layer]')?.remove()

    act(() => harness.trigger())
    await waitFor(() => expect(harness.onNoTextFound).toHaveBeenCalledTimes(1))

    expect(harness.onTextExtracted).not.toHaveBeenCalled()
  })
})

/* -------------------------------------------------------------- scheduling */

describe('native page text — scheduling', () => {
  it('defers extraction to requestIdleCallback with a forced timeout', async () => {
    vi.useFakeTimers()
    const idleCallbacks: { cb: IdleRequestCallback; options?: IdleRequestOptions }[] = []
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback, opts?: IdleRequestOptions) => {
      idleCallbacks.push({ cb, options: opts })
      return idleCallbacks.length
    })
    vi.stubGlobal('cancelIdleCallback', vi.fn())

    try {
      const harness = await mountExtraction()
      // The mount itself already drained microtasks, so the layer has rendered.
      expect(harness.container.querySelector('span[role="presentation"]')).not.toBe(null)

      act(() => harness.trigger())
      expect(idleCallbacks).toHaveLength(1)
      // A forced timeout is required: without one the callback can be starved
      // indefinitely on a busy machine and the text never reaches the AI.
      expect(idleCallbacks[0].options).toEqual({ timeout: 2000 })
      expect(harness.onTextExtracted).not.toHaveBeenCalled()

      await act(async () => {
        idleCallbacks[0].cb({ didTimeout: false, timeRemaining: () => 10 } as IdleDeadline)
      })

      expect(harness.onTextExtracted).toHaveBeenCalledTimes(1)
      expect(harness.onTextExtracted.mock.calls[0][0]).toBe('the native page text')
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to a 500 ms timeout when requestIdleCallback is missing', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.stubGlobal('cancelIdleCallback', undefined)

    try {
      const harness = await mountExtraction()

      act(() => harness.trigger())
      // Nothing runs immediately: the delay lets the page render settle.
      expect(harness.onTextExtracted).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(499)
      })
      expect(harness.onTextExtracted).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(1)
      })
      expect(harness.onTextExtracted).toHaveBeenCalledTimes(1)
      expect(harness.onTextExtracted.mock.calls[0][0]).toBe('the native page text')
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a pending extraction instead of running both', async () => {
    const idleCallbacks: { cb: IdleRequestCallback; options?: IdleRequestOptions }[] = []
    const cancelIdle = vi.fn()
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback, opts?: IdleRequestOptions) => {
      idleCallbacks.push({ cb, options: opts })
      return idleCallbacks.length
    })
    vi.stubGlobal('cancelIdleCallback', cancelIdle)

    const harness = await mountExtraction()

    act(() => {
      harness.trigger()
      harness.trigger()
    })

    expect(cancelIdle).toHaveBeenCalledWith(1)
    expect(idleCallbacks).toHaveLength(2)
  })

  it('cancels a pending extraction on unmount', async () => {
    const cancelIdle = vi.fn()
    vi.stubGlobal('requestIdleCallback', () => 42)
    vi.stubGlobal('cancelIdleCallback', cancelIdle)

    const harness = await mountExtraction()
    act(() => harness.trigger())

    harness.unmount()

    expect(cancelIdle).toHaveBeenCalledWith(42)
  })
})
