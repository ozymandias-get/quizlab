/**
 * `PdfViewerDocument` is the viewer shell: one container, one renderer, one toolbar.
 *
 * This file used to pin the feature-flag boundary from both sides — legacy viewer
 * when the flag was off, native viewer when it was on — because the switch was the
 * riskiest thing in the migration. The flag is gone, so there is no second side to
 * pin. What replaces it is the positive statement that used to be implicit: the
 * shell renders the native viewer, unconditionally, and binds the toolbar to the
 * native controller's own state.
 *
 * The renderer component is mocked so what is under test is the *wiring* — which
 * state the toolbar is bound to, and which refs the viewer is handed — rather than
 * PDF.js itself. That distinction matters more now: with one renderer, a toolbar
 * bound to a dead state would still look correct in a snapshot.
 */
import PdfViewerDocument from '@features/pdf/ui/components/PdfViewerDocument'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PdfViewerDocumentProps } from '@features/pdf/hooks/usePdfViewerState'

const mocks = vi.hoisted(() => ({
  toolbarProps: { current: null as Record<string, unknown> | null },
  nativeViewerProps: { current: null as Record<string, unknown> | null },
  // Stable identities, so "the toolbar is bound to the controller's search" is an
  // identity assertion rather than a hope.
  controllerHighlight: vi.fn(),
  controllerClearHighlights: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn(),
    queueTextForAi: vi.fn(),
    sendTextDirectToAi: vi.fn().mockResolvedValue({ success: true }),
    sendImageDirectToAi: vi.fn().mockResolvedValue({ success: true })
  }),
  useAppToolQueueState: () => ({ pendingAiItems: [], autoSend: false }),
  useAppToolScreenshotState: () => ({ isScreenshotMode: false, pendingAreaCapture: null })
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@features/pdf/ui/hooks', () => ({
  usePdfContextMenu: () => ({ contextMenu: null, setContextMenu: vi.fn() }),
  usePdfPanTool: () => ({ isDragging: false }),
  useCanvasGpuCleanup: () => {},
  usePdfResizeRefit: () => {},
  usePdfCtrlWheelZoom: () => {},
  usePdfWheelNavigation: () => {},
  usePdfViewerZoomIpc: () => {},
  usePdfTextActions: () => ({ extractCurrentPageText: vi.fn() }),
  usePdfCaptureActions: () => ({
    handleFullPageScreenshot: vi.fn(),
    handleAreaScreenshot: vi.fn()
  })
}))

vi.mock('@features/pdf/ui/components/usePdfViewerLayout', () => ({
  useContainerSize: () => ({ w: 800, h: 1000 }),
  useFitScale: () => null,
  useLastNavigationTime: () => ({ current: 0 })
}))

// The engine is inert here: this file is about which renderer mounts and what the
// toolbar is bound to, not about PDF.js.
vi.mock('@features/pdf/engine', () => ({
  createPdfDocumentManager: () => ({
    load: async () => null,
    reload: async () => null,
    getDocument: () => null,
    getPage: async () => {
      throw new Error('no document in the boundary test')
    },
    destroy: vi.fn(),
    destroyed: false
  }),
  createPageRenderer: () => ({
    renderPage: async () => ({ width: 0, height: 0 }),
    cancel: vi.fn(),
    isRendering: false
  }),
  isRenderCancelled: () => false
}))

vi.mock('@features/pdf/ui/components/NativePdfViewer', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.nativeViewerProps.current = props
    return <div data-testid="native-viewer" />
  }
}))

vi.mock('@features/pdf/ui/components/ContextMenu', () => ({ default: () => null }))

vi.mock('@features/pdf/ui/components/PdfToolbar', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.toolbarProps.current = props
    return <div data-testid="pdf-toolbar" />
  }
}))

const pdfFile = {
  path: 'book.pdf',
  name: 'book.pdf',
  size: 1000,
  lastModified: 0,
  streamUrl: 'local-pdf://book'
}

function renderDocument() {
  const props: PdfViewerDocumentProps = {
    pdfFile,
    pdfUrl: 'local-pdf://book',
    t: (key: string) => key,
    isInteractionBlocked: false,
    autoSend: false,
    onToggleAutoSend: vi.fn(),
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn()
  }
  return render(<PdfViewerDocument {...props} />)
}

/** The props the toolbar mock last received. */
function toolbarProps(): Record<string, unknown> {
  const captured = mocks.toolbarProps.current
  if (!captured) throw new Error('PdfToolbar was never rendered')
  return captured
}

/** The props the native-viewer mock last received. */
function nativeViewerProps(): Record<string, unknown> {
  const captured = mocks.nativeViewerProps.current
  if (!captured) throw new Error('NativePdfViewer was never rendered')
  return captured
}

afterEach(() => {
  mocks.toolbarProps.current = null
  mocks.nativeViewerProps.current = null
})

describe('PdfViewerDocument renderer wiring', () => {
  it('mounts the native viewer', () => {
    renderDocument()

    expect(screen.getByTestId('native-viewer')).toBeInTheDocument()
  })

  it('binds the toolbar to the native controller', () => {
    renderDocument()

    const toolbar = toolbarProps()
    expect(toolbar.currentPage).toBe(1)
    expect(toolbar.totalPages).toBeTypeOf('number')
    expect(toolbar.ZoomIn).toBeTypeOf('function')
    expect(toolbar.ZoomOut).toBeTypeOf('function')
    expect(toolbar.CurrentScale).toBeTypeOf('function')
    expect(toolbar.onPreviousPage).toBeTypeOf('function')
    expect(toolbar.onNextPage).toBeTypeOf('function')
    expect(toolbar.onJumpToPage).toBeTypeOf('function')
  })

  it('binds the toolbar search to the controller, not to anything else', () => {
    renderDocument()

    // The search bar is renderer-agnostic and only ever calls
    // `highlight` / `clearHighlights`. That those are the controller's own
    // functions is the whole of what it means for search to work now: a stale
    // binding would render a working-looking bar over a viewer that highlights
    // nothing.
    const toolbar = toolbarProps()
    expect(toolbar.highlight).toBeTypeOf('function')
    expect(toolbar.clearHighlights).toBeTypeOf('function')
    expect(toolbar.highlight).not.toBe(mocks.controllerHighlight)
    expect(toolbar.highlight).not.toBe(mocks.controllerClearHighlights)
  })

  it('passes the very same functions the controller exposes', () => {
    renderDocument()

    // Identity against the controller, not merely "is a function". The controller
    // is handed to the viewer mock, so its search pair is the only candidate.
    const controller = nativeViewerProps().controller as Record<string, unknown>
    const toolbar = toolbarProps()
    expect(toolbar.highlight).toBe(controller.highlight)
    expect(toolbar.clearHighlights).toBe(controller.clearHighlights)
    expect(toolbar.onJumpToPage).toBe(controller.jumpToPage)
    expect(toolbar.onPreviousPage).toBe(controller.goToPreviousPage)
    expect(toolbar.onNextPage).toBe(controller.goToNextPage)
    expect(toolbar.currentPage).toBe(controller.currentPage)
    expect(toolbar.totalPages).toBe(controller.totalPages)
  })

  it('needs no capture bounding: capture works on the renderer', () => {
    renderDocument()

    // The toolbar used to take a bounding flag while the native viewer had no
    // capture pipeline. It has one now, so the flag is gone from the toolbar
    // entirely: leaving it would be a second thing to forget to remove, and it
    // could only ever disable a capability that exists.
    expect(toolbarProps()).not.toHaveProperty('nativeCanvasMode')
    expect(toolbarProps()).not.toHaveProperty('captureActionsDisabled')
  })

  it('hands the viewer a distinct ref for each surface it mounts into', () => {
    renderDocument()

    // The canvas, the text layer, the annotation layer and the search overlay are four
    // separate mount points owned by the shell, because they only exist while the native
    // viewer is the one rendering. They must be four *different* refs: handing the same
    // one to two of them would make the search measure against the text layer.
    const props = nativeViewerProps()
    const refs = (
      ['canvasRef', 'textLayerRef', 'annotationLayerRef', 'searchLayerRef'] as const
    ).map((name) => {
      expect(props[name], name).toMatchObject({ current: null })
      return props[name]
    })
    expect(new Set(refs).size).toBe(4)
  })

  it('mounts one toolbar and one container, not one of each per renderer', () => {
    renderDocument()

    expect(screen.getAllByTestId('pdf-toolbar')).toHaveLength(1)
    expect(screen.getAllByTestId('native-viewer')).toHaveLength(1)
    expect(document.querySelectorAll('.pdf-viewer-container')).toHaveLength(1)
  })

  it('keeps the toolbar out of the viewer area the page is centered inside', () => {
    renderDocument()

    const viewerArea = document.querySelector('.pdf-viewer-container')
    const toolbar = screen.getByTestId('pdf-toolbar')

    // Vertical centering happens inside the page viewport, which fills this container.
    // The toolbar therefore has to sit *beside* it in the same column — a sibling that
    // takes its own layout row — and not inside it and not floating over it. If it were
    // inside, the page would center against a height the toolbar no longer occupies; if
    // it were an overlay, the page would center too low and the toolbar would cover the
    // bottom of a short, centered page.
    expect(viewerArea).not.toBe(null)
    expect(viewerArea?.contains(toolbar)).toBe(false)
    expect(toolbar.parentElement).toBe(viewerArea?.parentElement)
  })

  it('mounts the AI draft slot inside the viewer, not as a viewport overlay', () => {
    renderDocument()

    // Taslak, PDF'den toplanan içeriğin kontrolüdür: panelin içinde, sağ altta
    // durur. Viewport'a sabitlenmiş bir yüzen katman olsaydı AI paneliyle ve alt
    // dock ile çakışırdı.
    const slot = screen.getByTestId('pdf-ai-draft-slot')
    const viewerArea = document.querySelector('.pdf-viewer-container')
    expect(viewerArea?.contains(slot)).toBe(true)
    expect(slot.className).toContain('absolute')
    expect(slot.className).not.toContain('fixed')
  })
})
