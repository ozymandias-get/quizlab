/**
 * The AI text actions on the native viewer, end to end.
 *
 * This is the Phase 5 promise in one file: with `VITE_NATIVE_PDF_VIEWER=true` the
 * two text actions do real work, and with the flag off they keep doing exactly
 * what they always did.
 *
 * Nothing in the chain between the button and the AI queue is mocked. The real
 * `PdfViewerDocument` → `usePdfViewerState` → `usePdfTextActions` →
 * `extractPageTextFromDom` → `normalizePdfText` path runs, on the real PDF.js
 * text-layer markup the native viewer mounts. Only the leaves are faked:
 * `pdfjs-6`, the Electron-facing toolbar actions, and the AI queue itself — which
 * is the thing under assertion.
 *
 * The selected-text flow is wired through the app's real `useTextSelection`
 * bridge, because that is the production wiring: `onTextSelection` →
 * `queueTextForAi(text, position)`.
 */
import { useTextSelection } from '@app/hooks/useTextSelection'
import PdfViewerDocument from '@features/pdf/ui/components/PdfViewerDocument'

import type { PdfViewerDocumentProps } from '@features/pdf/hooks/usePdfViewerState'

import { TooltipProvider } from '@app/components/ui/tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn(),
  queueTextForAi: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  handleFullPageScreenshot: vi.fn(),
  handleAreaScreenshot: vi.fn()
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn(),
    queueTextForAi: mocks.queueTextForAi
  })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: mocks.showSuccess,
    showError: vi.fn(),
    showWarning: mocks.showWarning,
    showInfo: vi.fn()
  })
}))

vi.mock('@features/pdf/ui/components/usePdfViewerLayout', () => ({
  useContainerSize: () => ({ w: 800, h: 1000 }),
  useFitScale: () => null,
  useLastNavigationTime: () => ({ current: 0 })
}))

// `usePdfTextActions` is deliberately NOT overridden: it is the production code
// the whole feature depends on.
vi.mock('@features/pdf/ui/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/pdf/ui/hooks')>()
  return {
    ...actual,
    usePdfPlugins: () => ({
      plugins: [],
      jumpToPageRef: { current: vi.fn() },
      ZoomIn: ({ children }: any) => children({ onClick: vi.fn() }),
      ZoomOut: ({ children }: any) => children({ onClick: vi.fn() }),
      CurrentScale: ({ children }: any) => children({ scale: 1 }),
      zoomTo: vi.fn(),
      highlight: vi.fn(),
      clearHighlights: vi.fn()
    }),
    usePdfNavigation: () => ({
      currentPage: 1,
      totalPages: 12,
      currentPageRef: { current: 1 },
      handlePageChange: vi.fn(),
      handleDocumentLoad: vi.fn(),
      goToPreviousPage: vi.fn(),
      goToNextPage: vi.fn(),
      jumpToPage: vi.fn()
    }),
    usePdfContextMenu: () => ({ contextMenu: null, setContextMenu: vi.fn() }),
    usePdfPanTool: () => ({ isDragging: false }),
    useCanvasGpuCleanup: () => {},
    usePdfResizeRefit: () => {},
    usePdfCtrlWheelZoom: () => {},
    usePdfWheelNavigation: () => {},
    usePdfViewerZoomIpc: () => {},
    usePdfCaptureActions: () => ({
      handleFullPageScreenshot: mocks.handleFullPageScreenshot,
      handleAreaScreenshot: mocks.handleAreaScreenshot
    })
  }
})

vi.mock('@features/pdf/ui/components/PdfViewerElement', () => ({
  default: () => (
    <div data-testid="legacy-viewer">
      {/* Enough legacy markup for the shipped text pipeline to work on. */}
      <div className="rpv-core__page-layer" data-virtual-index="0">
        <div className="rpv-core__text-layer">
          <span>legacy page text for the ai queue</span>
        </div>
      </div>
    </div>
  )
}))

vi.mock('@features/pdf/ui/components/ContextMenu', () => ({ default: () => null }))

/* ------------------------------------------------------------- pdf doubles */

const PAGE_TEXT = 'the native page text goes to the ai'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The minimal `PDFPageProxy` the native engine and text layer actually use. */
function createPage(pageNumber: number) {
  const renderDeferred = createDeferred<void>()
  const textContentDeferred = createDeferred<{
    items: { str: string }[]
    styles: Record<string, unknown>
    lang: string | null
  }>()
  queueMicrotask(() =>
    textContentDeferred.resolve({ items: [{ str: PAGE_TEXT }], styles: {}, lang: null })
  )
  return {
    pageNumber,
    getViewport: ({ scale }: { scale: number }) => ({
      width: 400 * scale,
      height: 600 * scale,
      rotation: 0,
      scale
    }),
    render: () => ({ promise: renderDeferred.promise, cancel: () => renderDeferred.resolve() }),
    getTextContent: () => textContentDeferred.promise
  }
}

function serveDocument(numPages = 12) {
  mocks.getDocument.mockImplementation(() => {
    const deferred = createDeferred<unknown>()
    const task = {
      promise: deferred.promise,
      destroy: vi.fn(() => Promise.resolve()),
      onProgress: null,
      onPassword: null
    }
    deferred.resolve({
      numPages,
      getPage: (pageNumber: number) => Promise.resolve(createPage(pageNumber))
    })
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

/**
 * `PdfViewerDocument` reads the flag through `useTextSelection`'s sibling
 * `usePdfWorkspaceState` wiring, so the real app bridge is used here: whatever
 * the selection hook receives is what `queueTextForAi` receives.
 */
function renderDocument() {
  function Harness() {
    const { handleTextSelection } = useTextSelection()
    const props: PdfViewerDocumentProps = {
      pdfFile,
      pdfUrl: 'local-pdf://book',
      t: (key: string) => key,
      isInteractionBlocked: false,
      autoSend: false,
      onToggleAutoSend: vi.fn(),
      startScreenshot: vi.fn(),
      queueImageForAi: vi.fn(),
      onTextSelection: handleTextSelection
    }
    return (
      <TooltipProvider>
        <PdfViewerDocument {...props} />
      </TooltipProvider>
    )
  }
  return render(<Harness />)
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

/**
 * Run frames until the viewer stops producing them.
 *
 * The native fit scale commits on an animation frame, and a scale change rebuilds
 * the text layer. Draining until quiet is what makes the rendered spans stable
 * enough to build a selection from.
 */
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

/** Open the AI actions group in the real toolbar. */
function openAiActions(): void {
  fireEvent.click(screen.getByTestId('pdf-toolbar-mode-toggle'))
}

/* ------------------------------------------------------------------- tests */

beforeEach(() => {
  vi.clearAllMocks()
  serveDocument()
  // Frames are driven by the test: the native zoom channel and the shared fit
  // both commit on one, and leaving them to the wall clock would make the
  // rendered text layer move under the assertions.
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
  document.body.innerHTML = ''
})

describe('native viewer — AI text actions', () => {
  it('mounts the native viewer, not the legacy one, and renders a text layer', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'true')

    renderDocument()

    await waitFor(() => {
      expect(screen.queryByTestId('legacy-viewer')).not.toBeInTheDocument()
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
  })

  it('sends the current native page text to the AI queue exactly once', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'true')
    serveDocument()
    renderDocument()

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    )

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-text-ai'))

    await waitFor(() => expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi.mock.calls[0][0]).toBe(PAGE_TEXT)
    expect(mocks.showSuccess).toHaveBeenCalledWith('pdf_text_added_to_ai')
  })

  it('sends a native text-layer selection to the AI queue exactly once', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'true')
    renderDocument()

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
    // Frames are drained, so the fit has committed and the layer is no longer
    // being rebuilt underneath the selection.
    await drainFrames()

    const run = document.querySelector(
      '[data-native-pdf-text-layer] span[role="presentation"]'
    )?.firstChild
    if (!run) throw new Error('text layer produced no run')

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => PAGE_TEXT,
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: run,
      focusNode: run,
      getRangeAt: () => ({
        commonAncestorContainer: run,
        startContainer: run,
        endContainer: run,
        getBoundingClientRect: () => ({
          left: 10,
          top: 10,
          right: 110,
          bottom: 30,
          width: 100,
          height: 20,
          x: 10,
          y: 10,
          toJSON: () => ({})
        }),
        getClientRects: () => []
      })
    } as unknown as Selection)

    const container = document.querySelector('.pdf-viewer-container') as HTMLElement
    act(() => {
      container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
    })
    flushFrames()

    await waitFor(() => expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi.mock.calls[0][0]).toBe(PAGE_TEXT)
    // The selection flow carries a position, so the AI bubble can be anchored.
    expect(mocks.queueTextForAi.mock.calls[0][1]).toEqual(
      expect.objectContaining({ top: expect.any(Number), left: expect.any(Number) })
    )
  })

  it('leaves every quick-bar action enabled, because nothing is unsupported', async () => {
    // Text from Phase 5, capture from Phase 8A, reload from Phase 4 — the whole
    // bar is live on the native path, which is why the bounding flag is gone.
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'true')
    renderDocument()
    await settle()

    openAiActions()

    expect(screen.getByTestId('pdf-quick-text-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-image-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-area-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-reload')).toBeEnabled()
  })

  it('hands the capture buttons to the one capture pipeline, not to a dead end', async () => {
    // The AI-text suite's own concern: capture is faked here, so what is asserted
    // is that the real toolbar wires both rasterising buttons to the shared
    // capture actions rather than disabling or dropping them.
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'true')
    renderDocument()
    await settle()

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-image-ai'))
    fireEvent.click(screen.getByTestId('pdf-quick-area-ai'))

    expect(mocks.handleFullPageScreenshot).toHaveBeenCalledTimes(1)
    expect(mocks.handleAreaScreenshot).toHaveBeenCalledTimes(1)
  })
})

describe('legacy viewer — AI text actions unchanged', () => {
  it('still sends the legacy page text to the AI queue', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'false')
    renderDocument()

    expect(screen.getByTestId('legacy-viewer')).toBeInTheDocument()
    expect(document.querySelector('[data-native-pdf-text-layer]')).toBe(null)

    openAiActions()
    fireEvent.click(screen.getByTestId('pdf-quick-text-ai'))

    await waitFor(() => expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi.mock.calls[0][0]).toBe('legacy page text for the ai queue')
  })

  it('leaves every quick-bar action enabled, because nothing is unsupported', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'false')
    renderDocument()

    openAiActions()

    expect(screen.getByTestId('pdf-quick-text-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-image-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-area-ai')).toBeEnabled()
    expect(screen.getByTestId('pdf-quick-reload')).toBeEnabled()
  })

  it('never starts the native engine while the flag is off', async () => {
    vi.stubEnv('VITE_NATIVE_PDF_VIEWER', 'false')
    renderDocument()
    await settle()

    expect(mocks.getDocument).not.toHaveBeenCalled()
    expect(mocks.initializeNativePdfWorker).not.toHaveBeenCalled()
    expect(document.querySelector('canvas')).toBe(null)
  })
})
