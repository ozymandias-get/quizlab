/**
 * The AI text actions, end to end — new binary menu contract.
 *
 * - Text drag shows the binary menu (AI'ye Gönder / Taslağa Ekle), it does NOT
 *   auto-queue.
 * - Taslağa Ekle queues with source metadata; AI'ye Gönder uses the direct
 *   pipeline without touching the draft queue.
 * - Full-page text stays discoverable via the right-click menu (toolbar AI
 *   controls were removed with the new selection flow).
 */
import { useTextSelection } from '@app/hooks/useTextSelection'
import PdfViewerDocument from '@features/pdf/ui/components/PdfViewerDocument'

import type { PdfViewerDocumentProps } from '@features/pdf/hooks/usePdfViewerState'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn(),
  queueTextForAi: vi.fn(),
  sendTextDirectToAi: vi.fn().mockResolvedValue({ success: true }),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  handleFullPageScreenshot: vi.fn(),
  handleAreaScreenshot: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  const { createPdfJsDistMock } = await import('./pdfJsMockFactories')
  return createPdfJsDistMock(mocks)
})

vi.mock('@features/pdf/engine/pdfWorker', async () => {
  const { createPdfWorkerMock } = await import('./pdfJsMockFactories')
  return createPdfWorkerMock(mocks)
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn(),
    queueTextForAi: mocks.queueTextForAi,
    sendTextDirectToAi: mocks.sendTextDirectToAi,
    sendImageDirectToAi: vi.fn().mockResolvedValue({ success: true })
  }),
  useAppToolQueueState: () => ({ pendingAiItems: [], autoSend: false }),
  useAppToolScreenshotState: () => ({ isScreenshotMode: false, pendingAreaCapture: null })
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

vi.mock('@features/pdf/ui/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/pdf/ui/hooks')>()
  return {
    ...actual,
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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sendTextDirectToAi.mockResolvedValue({ success: true })
  serveDocument()
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
  vi.restoreAllMocks()
})

describe('native viewer — AI text actions', () => {
  it('renders a text layer for the mounted page', async () => {
    renderDocument()

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
  })

  it('shows the binary menu on selection without auto-queueing', async () => {
    renderDocument()

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
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

    // Menü doğrudan belirir; ekstra AI simgesi gerekmez.
    await waitFor(() => {
      expect(screen.getByTestId('pdf-selection-menu')).toBeInTheDocument()
    })
    expect(screen.getByTestId('pdf-selection-send')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-draft')).toBeInTheDocument()
    // Otomatik kuyruklama yok.
    expect(mocks.queueTextForAi).not.toHaveBeenCalled()
  })

  it('queues with page metadata only after Taslağa Ekle', async () => {
    renderDocument()

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
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

    await waitFor(() => {
      expect(screen.getByTestId('pdf-selection-menu')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('pdf-selection-draft'))

    await waitFor(() => expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi.mock.calls[0][0]).toBe(PAGE_TEXT)
    // Taslağa Ekle gönderim tetiklemez.
    expect(mocks.sendTextDirectToAi).not.toHaveBeenCalled()
    // Sayfa metadata'sı snapshot'tan gelir.
    const meta = mocks.queueTextForAi.mock.calls[0][2]
    expect(meta?.source?.page).toBeGreaterThanOrEqual(1)
  })

  it('sends directly without touching the draft queue', async () => {
    renderDocument()

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-native-pdf-text-layer] span[role="presentation"]').length
      ).toBeGreaterThan(0)
    })
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

    await waitFor(() => {
      expect(screen.getByTestId('pdf-selection-menu')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('pdf-selection-send'))
    })

    await waitFor(() => expect(mocks.sendTextDirectToAi).toHaveBeenCalledTimes(1))
    expect(mocks.queueTextForAi).not.toHaveBeenCalled()
    // Kaynak başlığı doğrudan gönderimde korunur.
    expect(mocks.sendTextDirectToAi.mock.calls[0][0]).toContain('[PDF Kaynağı')
  })
})
