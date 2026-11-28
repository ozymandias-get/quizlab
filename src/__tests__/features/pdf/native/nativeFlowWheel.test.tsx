/**
 * The continuous-flow wheel: while wheel page turn is off, the wheel scrolls
 * inside the page and continues into the next page only at the edge.
 *
 * The handler reads the direction from `deltaY` and nothing else, so a
 * horizontal gesture is the case that cannot be seen by reading the happy
 * path: `deltaY === 0` is not "down", and treating it as "up" turns back a
 * page whenever the reader is at the top of a page.
 */
import { NativeViewerHarness, createFakeDocument } from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import { act, render } from '@testing-library/react'
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

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Drain the queued frames, then let the state updates they caused settle. */
async function drainFrames(): Promise<void> {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
  await settle()
}

async function waitForFrames(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await settle()
    if (frameCallbacks.length > 0) {
      await drainFrames()
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

function serveDocument(numPages: number): void {
  const document = createFakeDocument({ numPages })
  mocks.getDocument.mockImplementation(() => ({
    promise: Promise.resolve(document),
    destroy: vi.fn(() => Promise.resolve()),
    abort: vi.fn()
  }))
}

interface Mounted {
  container: HTMLElement
  currentPage: () => number
}

async function mountFlow(options: { initialPage: number; numPages?: number }): Promise<Mounted> {
  serveDocument(options.numPages ?? 12)
  let controller: { currentPage: number } | null = null
  const { container } = render(
    <NativeViewerHarness
      initialPage={options.initialPage}
      wheelPageTurnEnabled={false}
      onController={(c) => {
        controller = c
      }}
    />
  )

  // The scroll container is the ready state: before it there is only a spinner.
  await waitForFrames(() => expect(scrollerOf(container)).toBeTruthy())
  const scroller = scrollerOf(container)
  // jsdom reports zero for every layout box: the page is both at its top and
  // at its bottom until the test says otherwise. The handler only reads these
  // three numbers, so they are what the edge check is given.
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 800 })

  await waitForFrames(() => expect(controller?.currentPage).toBe(options.initialPage))
  return {
    container,
    currentPage: () => (controller as { currentPage: number }).currentPage
  }
}

function scrollerOf(container: HTMLElement): HTMLElement {
  const scroller = container.querySelector<HTMLElement>('[data-native-pdf-scroll]')
  if (!scroller) throw new Error('the flow scroller is not mounted')
  return scroller
}

function wheel(
  target: HTMLElement,
  init: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; metaKey?: boolean }
): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('the continuous-flow wheel', () => {
  it('does not turn back a page on a horizontal gesture', async () => {
    const view = await mountFlow({ initialPage: 2 })
    const scroller = scrollerOf(view.container)
    scroller.scrollTop = 0

    const event = wheel(scroller, { deltaX: 120, deltaY: 0 })
    await settle()

    expect(view.currentPage()).toBe(2)
    // Nothing moved, so nothing may be swallowed either: a horizontal swipe
    // still belongs to whatever the page does with it.
    expect(event.defaultPrevented).toBe(false)
  })

  it('still turns back a page on a vertical gesture at the top edge', async () => {
    const view = await mountFlow({ initialPage: 2 })
    const scroller = scrollerOf(view.container)
    scroller.scrollTop = 0

    wheel(scroller, { deltaY: -120 })
    await settle()

    expect(view.currentPage()).toBe(1)
  })

  it('still continues into the next page on a vertical gesture at the bottom edge', async () => {
    const view = await mountFlow({ initialPage: 2 })
    const scroller = scrollerOf(view.container)
    scroller.scrollTop = 1200

    wheel(scroller, { deltaY: 120 })
    await settle()
    await drainFrames()

    expect(view.currentPage()).toBe(3)
  })

  // Ctrl/Cmd + wheel is claimed by `usePdfCtrlWheelZoom`, which stops the
  // event in its capture listener before it reaches this one. Pinning it here
  // keeps the flow handler from turning pages if that listener ever moves.
  it('leaves the Ctrl/Cmd wheel to the zoom channel', async () => {
    const view = await mountFlow({ initialPage: 2 })
    const scroller = scrollerOf(view.container)
    scroller.scrollTop = 0

    wheel(scroller, { deltaY: -120, ctrlKey: true })
    await settle()

    expect(view.currentPage()).toBe(2)
  })
})
