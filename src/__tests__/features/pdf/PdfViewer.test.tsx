import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PdfViewer from '@features/pdf/ui/components/PdfViewer'

const mockViewer = vi.fn()

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
    jumpToPageRef: { current: vi.fn() },
    ZoomIn: () => <button>ZoomIn</button>,
    ZoomOut: () => <button>ZoomOut</button>,
    zoomTo: vi.fn(),
    CurrentScale: () => <span>100%</span>,
    highlight: { current: vi.fn() },
    clearHighlights: { current: vi.fn() }
  }),
  usePdfNavigation: () => ({
    currentPage: 1,
    totalPages: 10,
    handlePageChange: vi.fn(),
    handleDocumentLoad: vi.fn(),
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
  usePdfPanTool: () => ({ isDragging: false })
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
  Worker: ({ children }: { children: ReactNode }) => <>{children}</>
}))

describe('PdfViewer Component', () => {
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
})
