/**
 * Parity for the two zoom entry points the legacy viewer owned and the native one
 * had to inherit.
 *
 * Both of these used to live inside `@react-pdf-viewer`:
 *
 *  1. `usePdfViewerZoomIpc` — the Electron PDF context menu's Zoom In / Zoom Out /
 *     Reset Zoom items. It reached the renderer over IPC and terminated at RPV's
 *     `zoomTo`, with reset expressed as `SpecialZoomLevel.PageWidth`.
 *  2. `zoomPlugin({ enableShortcuts: true })` — which injected a `ShortcutHandler`
 *     binding Ctrl/Cmd + `-` / `=` / `0`.
 *
 * Deleting RPV deletes both. These tests drive the **real** native controller
 * against a faked `pdfjs-dist` (so only the PDF.js boundary is fake) and assert the
 * observable consequence: the controller's own `scale` moves. A wiring-only
 * assertion would pass just as happily if the zoom went to a dead channel, so
 * every case ends on a number the viewer actually renders at.
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

import {
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'

import { act, render } from '@testing-library/react'
import type { NativePdfController } from '@features/pdf/native/useNativePdfController'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn(),
  onPdfViewerZoom: vi.fn(),
  removeListener: vi.fn()
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

vi.mock('@shared/lib/electronApi', () => ({
  // `platform` drives `isMacPlatform()`, which decides whether the shortcut reads
  // Ctrl or Cmd. Pin it to a non-Darwin value so these tests exercise Ctrl.
  hasElectronApi: () => true,
  getElectronApi: () => ({ platform: 'win32', onPdfViewerZoom: mocks.onPdfViewerZoom })
}))

/** Fit scale for a 400×600 page in an 800×1000 container: min(2, 1.666…) → 1.67. */
const FIT_SCALE = 1.67

let frameCallbacks: FrameRequestCallback[]

beforeEach(() => {
  vi.clearAllMocks()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  mocks.onPdfViewerZoom.mockReturnValue(mocks.removeListener)
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

function serveDocument(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(document)
    return task
  })
}

/** Mount the real controller and wait until it is showing the page at fit scale. */
async function mountReady(options: { enabled?: boolean } = {}) {
  let controller: NativePdfController | null = null
  const document = createFakeDocument({ numPages: 12 })
  serveDocument(document)

  const view = render(
    <NativeViewerHarness enabled={options.enabled ?? true} onController={(c) => (controller = c)} />
  )

  if (options.enabled === false) {
    await settle()
    return { view, current: () => controller as unknown as NativePdfController }
  }

  await waitForFrames(() => {
    const c = controller as unknown as NativePdfController
    expect(c.status).toBe('ready')
    expect(c.scale).toBeCloseTo(FIT_SCALE, 2)
  })

  return { view, current: () => controller as unknown as NativePdfController }
}

function ipcAction() {
  const calls = mocks.onPdfViewerZoom.mock.calls
  return calls[calls.length - 1][0] as (action: 'in' | 'out' | 'reset') => void
}

function keydown(keyValue: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    ...init,
    key: keyValue
  })
  document.body.dispatchEvent(event)
  return event
}

/** Fire an action and run the frame the coalesced zoom channel commits on. */
async function actAndCommit(action: () => void) {
  await act(async () => {
    action()
    await Promise.resolve()
  })
  await waitForFrames(() => {
    expect(frameCallbacks.length).toBe(0)
  })
}

/* ------------------------------------------------- electron context-menu zoom */

describe('native viewer — electron context-menu zoom parity', () => {
  it('subscribes exactly once per mounted viewer', async () => {
    await mountReady()
    expect(mocks.onPdfViewerZoom).toHaveBeenCalledTimes(1)
  })

  it('zooms in on an IPC "in" action', async () => {
    const { current } = await mountReady()
    const before = current().scale

    await actAndCommit(() => ipcAction()('in'))

    expect(current().scale).toBeCloseTo(before + PDF_ZOOM_STEP, 5)
  })

  it('zooms out on an IPC "out" action', async () => {
    const { current } = await mountReady()

    await actAndCommit(() => ipcAction()('out'))

    expect(current().scale).toBeCloseTo(FIT_SCALE - PDF_ZOOM_STEP, 2)
  })

  // Legacy reset was `SpecialZoomLevel.PageWidth`; the native equivalent is the
  // numeric fit scale this controller already owns.
  it('resets to the numeric fit scale on an IPC "reset" action', async () => {
    const { current } = await mountReady()

    await actAndCommit(() => ipcAction()('in'))
    expect(current().scale).toBeCloseTo(FIT_SCALE + PDF_ZOOM_STEP, 5)

    await actAndCommit(() => ipcAction()('reset'))

    expect(current().scale).toBeCloseTo(FIT_SCALE, 2)
  })

  it('ignores IPC actions while the viewer is disabled', async () => {
    const { current } = await mountReady({ enabled: false })
    const before = current().scale

    await actAndCommit(() => ipcAction()('in'))

    expect(current().scale).toBe(before)
  })

  it('removes the IPC listener on unmount', async () => {
    const { view } = await mountReady()

    view.unmount()

    expect(mocks.removeListener).toHaveBeenCalledTimes(1)
  })
})

/* ---------------------------------------------------------- keyboard shortcuts */

describe('native viewer — keyboard zoom parity', () => {
  it('zooms in on Ctrl + =', async () => {
    const { current } = await mountReady()
    const before = current().scale

    await actAndCommit(() => {
      keydown('=')
    })

    expect(current().scale).toBeCloseTo(before + PDF_ZOOM_STEP, 5)
  })

  it('zooms out on Ctrl + -', async () => {
    const { current } = await mountReady()

    await actAndCommit(() => {
      keydown('-')
    })

    expect(current().scale).toBeCloseTo(FIT_SCALE - PDF_ZOOM_STEP, 2)
  })

  it('resets to fit on Ctrl + 0', async () => {
    const { current } = await mountReady()

    await actAndCommit(() => {
      keydown('=')
    })
    expect(current().scale).toBeCloseTo(FIT_SCALE + PDF_ZOOM_STEP, 5)

    await actAndCommit(() => {
      keydown('0')
    })

    expect(current().scale).toBeCloseTo(FIT_SCALE, 2)
  })

  it('stays inside the product zoom range', async () => {
    const { current } = await mountReady()

    for (let i = 0; i < 80; i += 1) {
      await actAndCommit(() => {
        keydown('=')
      })
    }
    expect(current().scale).toBeLessThanOrEqual(PDF_ZOOM_MAX_SCALE)

    for (let i = 0; i < 120; i += 1) {
      await actAndCommit(() => {
        keydown('-')
      })
    }
    expect(current().scale).toBeGreaterThanOrEqual(PDF_ZOOM_MIN_SCALE)
  })

  it('ignores shortcuts while the viewer is disabled', async () => {
    const { current } = await mountReady({ enabled: false })
    const before = current().scale

    await actAndCommit(() => {
      keydown('=')
    })

    expect(current().scale).toBe(before)
  })

  it('does not steal the shortcut from a text field', async () => {
    const { current, view } = await mountReady()
    const before = current().scale
    const input = document.createElement('input')
    view.container.appendChild(input)

    await actAndCommit(() => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: '='
      })
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    })

    expect(current().scale).toBe(before)
  })
})
