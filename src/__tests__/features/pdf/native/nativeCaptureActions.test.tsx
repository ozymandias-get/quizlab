/**
 * The capture pipeline and the context menu, end to end.
 *
 * The viewer is the only viewer, so there is no other path to compare against:
 *
 *  - the two rasterising AI actions are live and reach the **real** capture ladder
 *  - the context menu opens on the canvas and its capture items reach the same
 *    ladder — one menu, one hook, no renderer branch
 *  - a capture reuses the mounted document instead of loading a second one
 *  - every capture is labelled with the page the reader is actually looking at
 *
 * Nothing between the button and the AI queue is faked. The real
 * `PdfViewerDocument` → `usePdfViewerState` → `usePdfCaptureActions` →
 * `renderPageToImageFallback` → `activePdfDocumentRegistry` → native
 * `PdfDocumentManager` chain runs on the real PDF.js text-layer markup and the real
 * canvas. Only the leaves are: `pdfjs-dist`, the canvas 2D backend jsdom does
 * not ship, object URLs, and the AI queue itself — which is what is asserted.
 */
import PdfViewerDocument from '@features/pdf/ui/components/PdfViewerDocument'

import type { PdfViewerDocumentProps } from '@features/pdf/hooks/usePdfViewerState'

import {
  clearActivePdfDocument,
  getActivePdfDocument
} from '@features/pdf/lib/activePdfDocumentRegistry'

import { TooltipProvider } from '@app/components/ui/tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeDocument, createLoadingTask } from './nativeViewerHarness'
import { FakeAnnotationLayer } from './nativeAnnotationLayerDouble'
import { FakeTextLayer } from './nativeTextLayerDouble'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn(),
  queueImageForAi: vi.fn(),
  queueTextForAi: vi.fn(),
  startScreenshot: vi.fn(),
  showError: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  // Lazily imported: a `vi.mock` factory is hoisted above this file's static
  // imports, so the doubles live in dependency-free modules of their own.
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: mocks.startScreenshot,
    queueImageForAi: mocks.queueImageForAi,
    queueTextForAi: mocks.queueTextForAi
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: vi.fn(),
    showError: mocks.showError,
    showWarning: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@features/pdf/ui/components/usePdfViewerLayout', () => ({
  useContainerSize: () => ({ w: 800, h: 1000 }),
  useFitScale: () => null,
  useLastNavigationTime: () => ({ current: 0 })
}))

/**
 * The viewport measurements are stubbed so fit scale is deterministic. Everything
 * else on the shared hooks — the capture ladder, the context menu, the text
 * actions — is the production code.
 */
vi.mock('@features/pdf/ui/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/pdf/ui/hooks')>()
  return {
    ...actual
  }
})

function serveDocument(numPages = 12) {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask()
    task.resolve(
      createFakeDocument({
        numPages,
        textItems: Object.fromEntries(
          Array.from({ length: numPages }, (_, index) => [
            index + 1,
            [`page ${index + 1} native text`]
          ])
        )
      })
    )
    return task
  })
}

const pdfFile = {
  path: 'book.pdf',
  name: 'book.pdf',
  size: 1000,
  lastModified: 0,
  streamUrl: 'local-pdf://book'
}

/* ------------------------------------------------------------------ canvas */

/**
 * jsdom ships no 2D backend, so capture would bail before it drew anything.
 * `toBlob` yields a real Blob so `FileReader` can turn it into a data URL the way
 * production does, and object URLs are recorded rather than allocated.
 */
let blobUrls = 0

function stubCanvasBackend(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillStyle: '',
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    canvas: document.createElement('canvas')
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string
  ) {
    callback(new Blob(['captured'], { type: type ?? 'image/png' }))
  })
}

/* ----------------------------------------------------------------- helpers */

let frameCallbacks: FrameRequestCallback[]

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function flushFrames(): void {
  const callbacks = frameCallbacks.splice(0)
  act(() => {
    for (const cb of callbacks) cb(0)
  })
}

/** Run frames until the viewer stops producing them, so the fit scale commits. */
async function drainFrames(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await settle()
    if (frameCallbacks.length === 0) continue
    flushFrames()
  }
  await settle()
}

async function waitFor(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await drainFrames()
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

function renderDocument() {
  const props: PdfViewerDocumentProps = {
    pdfFile,
    pdfUrl: 'local-pdf://book',
    t: (key: string) => key,
    isInteractionBlocked: false,
    autoSend: false,
    onToggleAutoSend: vi.fn(),
    startScreenshot: mocks.startScreenshot,
    queueImageForAi: mocks.queueImageForAi
  }
  return render(
    <TooltipProvider>
      <PdfViewerDocument {...props} />
    </TooltipProvider>
  )
}

/** Open the AI actions group in the real toolbar. */
function openAiActions(): void {
  fireEvent.click(screen.getByTestId('pdf-toolbar-mode-toggle'))
}

/** Right-click the shared viewer container, which is what opens the menu. */
function openContextMenu(): void {
  const container = document.querySelector('.pdf-viewer-container') as HTMLElement
  act(() => {
    container.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 80
      })
    )
  })
}

function menuItem(label: string): HTMLElement {
  return screen.getByRole('menuitem', { name: new RegExp(label) })
}

/** The AI payload, asserting the shape the queue is called with. */
function queuedImages(): { url: string; page?: number; captureKind?: string }[] {
  return mocks.queueImageForAi.mock.calls.map(([url, meta]) => ({ url, ...meta }))
}

beforeEach(() => {
  vi.clearAllMocks()
  clearActivePdfDocument()
  FakeTextLayer.reset()
  FakeAnnotationLayer.reset()
  blobUrls = 0
  serveDocument()
  stubCanvasBackend()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:captured-${++blobUrls}`)
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn()
  })
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  clearActivePdfDocument()
})

/* ------------------------------------------------------------------- tests */

describe('native viewer — capture actions', () => {
  it('does not clone a page canvas while its replacement render is incomplete', async () => {
    const pdf = createFakeDocument({ numPages: 12, settleRenders: false })
    mocks.getDocument.mockImplementation(() => {
      const task = createLoadingTask()
      task.resolve(pdf)
      return task
    })
    const { container } = renderDocument()
    await waitFor(() => expect(pdf.page(1).renderCalls.length).toBeGreaterThan(0))
    await act(async () => {
      pdf.page(1).settleLastRender()
      await settle()
    })
    const liveCanvas = container.querySelector<HTMLCanvasElement>('[data-native-pdf-canvas]')!
    const pageTwo = pdf.page(2)
    const renderPageTwo = pageTwo.render
    pageTwo.render = (params) => {
      // The independent capture render fails, while the visible render is still
      // waiting for its PDF.js task to settle. The ladder must not clone it.
      if (params.canvas !== liveCanvas) throw new Error('capture render failed')
      return renderPageTwo(params)
    }
    fireEvent.click(screen.getByLabelText('next_page'))
    await waitFor(() => expect(pageTwo.renderCalls.length).toBeGreaterThan(0))
    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))
    await waitFor(
      () =>
        expect(
          mocks.showError.mock.calls.length + mocks.queueImageForAi.mock.calls.length
        ).toBeGreaterThan(0),
      2500
    )
    expect(mocks.queueImageForAi).not.toHaveBeenCalled()
  })

  it('publishes the mounted document so a capture can borrow it', async () => {
    renderDocument()

    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
    // One document for the whole app, not one per capture.
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
  })

  it('sends the current native page to the AI as one high-DPI image', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))

    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1))
    const [queued] = queuedImages()
    expect(queued.url).toMatch(/^data:image\//)
    expect(queued.page).toBe(1)
    expect(queued.captureKind).toBe('full-page')
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('labels the capture with the page the reader moved to, not page 1', async () => {
    // Capture reads the page the viewer writes into `capturePageRef`, which is the
    // controller's own live page. A capture triggered after a page turn must name
    // the new page, or a capture of page 40 is sent to the AI as page 1.
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    fireEvent.click(screen.getByLabelText('next_page'))

    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))

    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalled())
    const [queued] = queuedImages()
    expect(queued.page).toBe(2)
    expect(queued.captureKind).toBe('full-page')
  })

  it('reuses the mounted document instead of loading a second one', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))
    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1))

    // The whole reason the registry exists: no network round-trip and no second
    // decode of a file that is already decoded.
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
    expect(getActivePdfDocument('local-pdf://book')).not.toBeNull()
  })

  it('never queues twice, and never opens an error toast', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))
    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1))
    await settle()

    expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1)
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('starts the crop screenshot with the native page number', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-area-ai'))

    expect(mocks.startScreenshot).toHaveBeenCalledTimes(1)
    // The crop path never touches PDF.js: the main process crops the window, so
    // only the page label has to come from the right renderer.
    expect(mocks.startScreenshot).toHaveBeenCalledWith({ page: 1, captureKind: 'selection' })
  })

  it('restarts the document on reload and keeps capture pointed at the new one', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-reload'))

    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())
    // A reload is a new document generation, so a second load is expected here —
    // what matters is that capture borrows it rather than loading a third copy.
    expect(mocks.getDocument).toHaveBeenCalledTimes(2)

    mocks.queueImageForAi.mockClear()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))
    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1))
    expect(mocks.getDocument).toHaveBeenCalledTimes(2)
  })
})

describe('native viewer — context menu', () => {
  it('opens on the native canvas with the same four items', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openContextMenu()

    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    expect(menuItem('pdf_add_current_page_text_to_ai')).toBeInTheDocument()
    expect(menuItem('pdf_send_page_as_image')).toBeInTheDocument()
    expect(menuItem('ctx_crop_screenshot_ai')).toBeInTheDocument()
    expect(menuItem('ctx_reload')).toBeInTheDocument()
  })

  it('reaches the real capture backend from the page-image item', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openContextMenu()
    fireEvent.click(menuItem('pdf_send_page_as_image'))

    await waitFor(() => expect(mocks.queueImageForAi).toHaveBeenCalledTimes(1))
    const [queued] = queuedImages()
    expect(queued.url).toMatch(/^data:image\//)
    expect(queued.page).toBe(1)
    expect(queued.captureKind).toBe('full-page')
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
  })

  it('reaches the real crop pipeline from the screenshot item', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openContextMenu()
    fireEvent.click(menuItem('ctx_crop_screenshot_ai'))

    expect(mocks.startScreenshot).toHaveBeenCalledWith({ page: 1, captureKind: 'selection' })
    expect(mocks.queueImageForAi).not.toHaveBeenCalled()
  })

  it('reaches the page-text backend from the text item', async () => {
    renderDocument()
    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    )

    openContextMenu()
    fireEvent.click(menuItem('pdf_add_current_page_text_to_ai'))

    await waitFor(() => expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi.mock.calls[0][0]).toEqual(expect.any(String))
  })

  it('closes after an item runs', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openContextMenu()
    fireEvent.click(menuItem('ctx_crop_screenshot_ai'))

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('never renders a second menu, or a native-only variant', async () => {
    renderDocument()
    await waitFor(() => expect(getActivePdfDocument('local-pdf://book')).not.toBeNull())

    openContextMenu()

    // One menu component, one hook, one set of items — the renderer switch is in
    // `PdfViewerDocument`, and it only chooses which capture backend they call.
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
  })
})
