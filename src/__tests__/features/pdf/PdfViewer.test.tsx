import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PdfViewer from '@features/pdf/components/PdfViewer'

// Mock Providers
vi.mock('@src/app/providers/AiContext', () => ({
    useAi: () => ({
        autoSend: false,
        toggleAutoSend: vi.fn(),
        sendImageToAI: vi.fn(),
    }),
}))

vi.mock('@src/app/providers/AppToolContext', () => ({
    useAppTools: () => ({
        startScreenshot: vi.fn(),
    }),
}))

vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

// Mock hooks
vi.mock('@features/pdf/components/hooks', () => ({
    usePdfPlugins: () => ({
        plugins: [],
        jumpToPageRef: { current: vi.fn() },
        ZoomIn: () => <button>ZoomIn</button>,
        ZoomOut: () => <button>ZoomOut</button>,
        zoomTo: vi.fn(),
        CurrentScale: () => <span>100%</span>,
        highlight: { current: vi.fn() },
        clearHighlights: { current: vi.fn() },
    }),
    usePdfNavigation: () => ({
        currentPage: 1,
        totalPages: 10,
        handlePageChange: vi.fn(),
        handleDocumentLoad: vi.fn(),
        goToPreviousPage: vi.fn(),
        goToNextPage: vi.fn(),
    }),
    usePdfScreenshot: () => ({
        handleFullPageScreenshot: vi.fn(),
    }),
    usePdfTextSelection: () => ({}),
    usePdfContextMenu: () => ({
        contextMenu: null,
        setContextMenu: vi.fn(),
    }),
}))

// Mock Subcomponents
vi.mock('@features/pdf/components/PdfPlaceholder', () => ({
    default: () => <div>PDF Placeholder</div>,
}))
vi.mock('@features/pdf/components/PdfToolbar', () => ({
    default: () => <div>PDF Toolbar</div>,
}))

// Mock react-pdf-viewer
vi.mock('@react-pdf-viewer/core', () => ({
    Viewer: () => <div>PDF Viewer Content</div>,
    SpecialZoomLevel: { PageWidth: 'PageWidth' },
    ScrollMode: { Page: 'Page' },
    Worker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('PdfViewer Component', () => {
    it('renders placeholder when no PDF is provided', () => {
        render(
            <PdfViewer
                pdfFile={null}
                onSelectPdf={vi.fn()}
            />
        )
        expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
    })

    it('renders viewer and toolbar when PDF is provided', () => {
        const mockPdfFile = {
            path: 'test.pdf',
            name: 'test.pdf',
            size: 1000,
            lastModified: 0,
            streamUrl: 'blob:url',
        }

        render(
            <PdfViewer
                pdfFile={mockPdfFile}
                onSelectPdf={vi.fn()}
            />
        )

        expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()
        expect(screen.getByText('PDF Toolbar')).toBeInTheDocument()
    })
})

