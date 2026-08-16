import PdfViewer from '@features/pdf/ui/components/PdfViewer'

import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockViewer = vi.fn()
const mockHandleDocumentLoad = vi.fn()
const mockZoomTo = vi.fn()
const mockJumpToPage = vi.fn()
const mockJumpToPageFromNav = vi.fn()
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
  useAiSessionActions: () => ({
    toggleAutoSend: vi.fn()
  })
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
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
    clearHighlights: { current: vi.fn() },
    renderPage: () => null
  }),
  usePdfNavigation: () => ({
    currentPage: mockNavigationState.currentPage,
    totalPages: mockNavigationState.totalPages,
    currentPageRef: { current: mockNavigationState.currentPage },
    handlePageChange: vi.fn(),
    handleDocumentLoad: mockHandleDocumentLoad,
    goToPreviousPage: vi.fn(),
    goToNextPage: vi.fn(),
    jumpToPage: mockJumpToPageFromNav
  }),
  usePdfContextMenu: () => ({
    contextMenu: null,
    setContextMenu: vi.fn()
  }),
  usePdfPanTool: () => ({ isDragging: false }),
  usePdfResizeRefit: () => {},
  usePdfCtrlWheelZoom: () => {},
  usePdfWheelNavigation: () => {},
  usePdfViewerZoomIpc: () => {},
  usePdfTextActions: () => ({
    extractCurrentPageText: vi.fn()
  }),
  usePdfCaptureActions: () => ({
    handleFullPageScreenshot: vi.fn(),
    handleAreaScreenshot: vi.fn()
  })
}))

vi.mock('@features/pdf/ui/components/usePdfViewerLayout', () => ({
  useContainerSize: () => ({ w: 800, h: 1000 }),
  useFitScale: () => 0.8,
  useLastNavigationTime: () => ({ current: 0 })
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

describe('PdfViewer', () => {
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

  it('navigates to the saved page on load via jumpToPage', async () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    render(<PdfViewer pdfFile={mockPdfFile} initialPage={8} onSelectPdf={vi.fn()} />)

    expect(mockViewer).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ initialPage: expect.anything() })
    )
    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalledWith(8))
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

  it('aligns resume to the saved page when viewer state is out of sync', async () => {
    const mockPdfFile = {
      path: 'resume.pdf',
      name: 'resume.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:resume'
    }

    render(<PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />)

    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalledWith(3))
    expect(mockZoomTo).toHaveBeenCalledWith(0.8)
  })

  it('does not force the saved page again after the initial resume sync', async () => {
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

    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalled())
    const callCountAfterMount = mockJumpToPageFromNav.mock.calls.length
    expect(callCountAfterMount).toBeGreaterThanOrEqual(1)

    mockNavigationState.currentPage = 4

    rerender(<PdfViewer pdfFile={mockPdfFile} initialPage={3} onSelectPdf={vi.fn()} />)

    expect(mockJumpToPageFromNav).toHaveBeenCalledTimes(callCountAfterMount)
    expect(mockZoomTo.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('does not re-apply the resume page when initialPage changes mid-viewing (page turn)', async () => {
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

    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalled())
    const callCountAfterMount = mockJumpToPageFromNav.mock.calls.length

    mockNavigationState.currentPage = 7

    // Reading progress persisted the new page: the same file now reports
    // initialPage=7. The viewer must NOT re-jump — only the first load of a
    // given file may consume initialPage.
    rerender(<PdfViewer pdfFile={mockPdfFile} initialPage={7} onSelectPdf={vi.fn()} />)

    expect(mockJumpToPageFromNav).toHaveBeenCalledTimes(callCountAfterMount)
    expect(mockViewer).not.toHaveBeenLastCalledWith(expect.objectContaining({ initialPage: 7 }))
  })

  it('consumes the new initialPage only when a different file is opened', async () => {
    const firstFile = {
      path: 'a.pdf',
      name: 'a.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:a'
    }
    const secondFile = {
      path: 'b.pdf',
      name: 'b.pdf',
      size: 1000,
      lastModified: 0,
      streamUrl: 'blob:b'
    }

    const { rerender } = render(
      <PdfViewer pdfFile={firstFile} initialPage={3} onSelectPdf={vi.fn()} />
    )

    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalledWith(3))

    mockNavigationState.currentPage = 1

    rerender(<PdfViewer pdfFile={secondFile} initialPage={9} onSelectPdf={vi.fn()} />)

    await waitFor(() => expect(mockJumpToPageFromNav).toHaveBeenCalledWith(9))
  })
})
