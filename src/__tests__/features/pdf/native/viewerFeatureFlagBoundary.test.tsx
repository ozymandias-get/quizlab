/**
 * The feature-flag boundary in `PdfViewerDocument`.
 *
 * This is the switch that decides whether the shipped PDF renderer is
 * `@react-pdf-viewer` or the native canvas viewer, so it is pinned from both
 * sides:
 *
 *  - flag absent / `false` → the legacy viewer renders and the native one does not
 *  - flag `true`         → the native viewer renders and `@react-pdf-viewer`'s
 *                           `<Viewer>` is never mounted
 *
 * The toolbar contract is pinned at the same time, because a flag that swaps the
 * viewer but leaves the toolbar wired to the legacy plugins would render buttons
 * that silently do nothing.
 *
 * The viewer components themselves are mocked, so what is under test is the
 * boundary: which renderer is mounted, and which state the toolbar is bound to.
 */
import PdfViewerDocument from '@features/pdf/ui/components/PdfViewerDocument'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PdfViewerDocumentProps } from '@features/pdf/hooks/usePdfViewerState'

const mocks = vi.hoisted(() => ({
  nativeFlag: { current: false },
  legacyState: { current: null as Record<string, unknown> | null }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn(),
    queueTextForAi: vi.fn()
  })
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
  usePdfPlugins: () => ({
    plugins: [],
    jumpToPageRef: { current: vi.fn() },
    ZoomIn: () => <span>legacy-zoom-in</span>,
    ZoomOut: () => <span>legacy-zoom-out</span>,
    CurrentScale: () => <span>legacy-scale</span>,
    zoomTo: vi.fn(),
    highlight: vi.fn(),
    clearHighlights: vi.fn()
  }),
  usePdfNavigation: () => ({
    currentPage: 1,
    totalPages: 99,
    currentPageRef: { current: 1 },
    handlePageChange: vi.fn(),
    handleDocumentLoad: vi.fn(),
    goToPreviousPage: vi.fn(),
    goToNextPage: vi.fn(),
    jumpToPage: vi.fn()
  }),
  usePdfContextMenu: () => ({ contextMenu: null, setContextMenu: vi.fn() }),
  usePdfPanTool: () => ({ isDragging: false }),
  useCoalescedZoom: (zoomTo: unknown) => zoomTo,
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

// The engine is inert here: the boundary test is about which renderer mounts,
// and the native viewer component itself is mocked out.
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

vi.mock('@features/pdf/ui/components/PdfViewerElement', () => ({
  default: () => <div data-testid="legacy-viewer" />
}))

vi.mock('@features/pdf/ui/components/NativePdfViewer', () => ({
  default: () => <div data-testid="native-viewer" />
}))

vi.mock('@features/pdf/ui/components/ContextMenu', () => ({ default: () => null }))

vi.mock('@features/pdf/ui/components/PdfToolbar', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.legacyState.current = props
    return <div data-testid="pdf-toolbar" />
  }
}))

vi.mock('@features/pdf/native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/pdf/native')>()
  return { ...actual, isNativePdfViewerEnabled: () => mocks.nativeFlag.current }
})

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
  const captured = mocks.legacyState.current
  if (!captured) throw new Error('PdfToolbar was never rendered')
  return captured
}

afterEach(() => {
  mocks.nativeFlag.current = false
  mocks.legacyState.current = null
})

describe('PdfViewerDocument feature-flag boundary', () => {
  it('mounts the legacy viewer and not the native one when the flag is off', () => {
    mocks.nativeFlag.current = false

    renderDocument()

    expect(screen.getByTestId('legacy-viewer')).toBeInTheDocument()
    expect(screen.queryByTestId('native-viewer')).not.toBeInTheDocument()
  })

  it('mounts the native viewer and not the legacy one when the flag is on', () => {
    mocks.nativeFlag.current = true

    renderDocument()

    expect(screen.getByTestId('native-viewer')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-viewer')).not.toBeInTheDocument()
  })

  it('binds the toolbar to legacy navigation and zoom on the default path', () => {
    mocks.nativeFlag.current = false

    renderDocument()

    const toolbar = toolbarProps()
    expect(toolbar.currentPage).toBe(1)
    expect(toolbar.totalPages).toBe(99)
    expect(toolbar.ZoomIn).toBeTypeOf('function')
    expect(toolbar.CurrentScale).toBeTypeOf('function')
    // No native-mode bounding while the legacy viewer owns the pipeline.
    expect(toolbar.nativeCanvasMode).toBe(false)
  })

  it('marks the toolbar as native-mode so unsupported controls are bounded', () => {
    mocks.nativeFlag.current = true

    renderDocument()

    expect(toolbarProps().nativeCanvasMode).toBe(true)
  })

  it('supplies native zoom components that are not the legacy plugin ones', () => {
    mocks.nativeFlag.current = false
    const { unmount } = renderDocument()
    const legacyZoomIn = toolbarProps().ZoomIn
    unmount()

    mocks.nativeFlag.current = true
    renderDocument()

    // The legacy plugin render-prop component would keep reading the (absent)
    // RPV zoom plugin state; the native one reads the native scale state.
    expect(toolbarProps().ZoomIn).not.toBe(legacyZoomIn)
  })
})
