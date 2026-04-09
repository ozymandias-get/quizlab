import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PdfViewer from '@features/pdf/ui/components/PdfViewer'

const mockViewer = vi.fn()
const mockHandleDocumentLoad = vi.fn()
const mockZoomTo = vi.fn()
const mockJumpToPage = vi.fn()
const mockNavigationState = {
  currentPage: 1,
  totalPages: 10
}

vi.mock('@app/providers/AiContext', () => ({
  useAi: () => ({
    autoSend: false,
    toggleAutoSend: vi.fn(),
    sendImageToAI: vi.fn(),
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiState: () => ({
    autoSend: false,
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiRegistryMeta: () => ({
    isRegistryLoaded: true,
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiSessionUiPrefsState: () => ({
    autoSend: false,
    isTutorialActive: false
  }),
  useAiCoreWorkspaceActions: () => ({
    toggleAutoSend: vi.fn()
  })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn()
  })
}))

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key
  }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

vi.mock('@platform/electron/api/useGeminiWebSessionApi', () => ({
  useGeminiWebStatus: () => ({
    data: {
      featureEnabled: false,
      enabled: false
    }
  })
}))

vi.mock('@features/pdf/ui/hooks', () => ({
  usePdfPlugins: () => ({
    plugins: [],
    jumpToPageRef: { current: mockJumpToPage },
    ZoomIn: () => <button>ZoomIn</button>,
    ZoomOut: () => <button>ZoomOut</button>,
    zoomTo: mockZoomTo,
    CurrentScale: () => <span>100%</span>,
    highlight: { current: vi.fn() },
    clearHighlights: { current: vi.fn() }
  }),
  usePdfNavigation: () => ({
    currentPage: mockNavigationState.currentPage,
    totalPages: mockNavigationState.totalPages,
    handlePageChange: vi.fn(),
    handleDocumentLoad: mockHandleDocumentLoad,
    goToPreviousPage: vi.fn(),
    goToNextPage: vi.fn()
  }),
  usePdfScreenshot: () => ({
    handleFullPageScreenshot: vi.fn()
  }),
  usePdfTextSelection: () => ({}),
  usePdfContextMenu: () => ({
    contextMenu: null,
    setContextMenu: vi.fn()
  }),
  usePdfPanTool: () => ({ isDragging: false }),
  usePdfResizeRefit: () => {},
  usePdfCtrlWheelZoom: () => {},
  usePdfViewerZoomIpc: () => {}
}))

vi.mock('@features/pdf/ui/components/PdfPlaceholder', () => ({
  default: () => <div>PDF Placeholder</div>
}))
vi.mock('@features/pdf/ui/components/PdfToolbar', () => ({
  default: () => <div>PDF Toolbar</div>
}))

vi.mock('@react-pdf-viewer/core', () => ({
  Viewer: (props: any) => {
    mockViewer(props)
    return <div>PDF Viewer Content</div>
  },
  SpecialZoomLevel: { PageWidth: 'PageWidth' },
  ScrollMode: { Page: 'Page' },
  ViewMode: { SinglePage: 'SinglePage' },
  Worker: ({ children }: { children: ReactNode }) => <>{children}</>
}))

describe('PdfViewer Component', () => {
  beforeEach(() => {
    mockViewer.mockClear()
    mockHandleDocumentLoad.mockClear()
    mockZoomTo.mockClear()
    mockJumpToPage.mockClear()
    mockNavigationState.currentPage = 1
    mockNavigationState.totalPages = 10
  })

  it('renders placeholder when no PDF is provided', () => {
    render(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
  })

  it('renders viewer and toolbar when PDF is provided', () => {
    const mockPdfFile = {
      path: 'test.pdf',
      name: 'test.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:url'
    }

    render(<PdfViewer pdfFile={mockPdfFile} onSelectPdf={vi.fn()} />)

    expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()
    expect(screen.getByText('PDF Toolbar')).toBeInTheDocument()
    expect(mockViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultScale: 'PageWidth',
        viewMode: 'SinglePage'
      })
    )
  })

  it('passes the saved page to the viewer initialPage prop', () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    render(<PdfViewer pdfFile={mockPdfFile} initialPage={8} onSelectPdf={vi.fn()} />)

    expect(mockViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialPage: 7
      })
    )
  })

  it('uses handleDocumentLoad directly without a resume zoom hack', () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    render(<PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />)

    const viewerProps = mockViewer.mock.lastCall?.[0]
    const loadEvent = { doc: { numPages: 12 } }
    const zoomCallCountBeforeLoad = mockZoomTo.mock.calls.length

    viewerProps.onDocumentLoad(loadEvent)

    expect(mockHandleDocumentLoad).toHaveBeenCalledWith(loadEvent)
    expect(mockZoomTo).toHaveBeenCalledTimes(zoomCallCountBeforeLoad)
  })

  it('aligns resume to the saved page when viewer state is out of sync', () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    render(<PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />)

    expect(mockZoomTo).toHaveBeenCalledWith('PageWidth')
    expect(mockJumpToPage).toHaveBeenCalledWith(2)
  })

  it('does not force the saved page again after the initial resume sync', () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    const { rerender } = render(
      <PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />
    )

    expect(mockJumpToPage).toHaveBeenCalledTimes(1)

    mockNavigationState.currentPage = 4

    rerender(<PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />)

    expect(mockJumpToPage).toHaveBeenCalledTimes(1)
    expect(mockZoomTo).toHaveBeenCalledTimes(1)
  })
})
