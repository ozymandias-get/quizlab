import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LeftPanel from '@src/components/layout/LeftPanel'

// Mock dependencies
vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

// Create a mock for useSharedDragDrop specific to this test file
const mockUseSharedDragDrop = vi.fn()
vi.mock('@src/hooks/useSharedDragDrop', () => ({
    useSharedDragDrop: (onDrop: any) => mockUseSharedDragDrop(onDrop)
}))

vi.mock('@src/features/pdf/components/PdfViewer', () => ({
    default: () => <div data-testid="pdf-viewer">PdfViewer Mock</div>
}))

vi.mock('@react-pdf-viewer/core', () => ({
    Worker: ({ children }: any) => <div data-testid="pdf-worker">{children}</div>
}))

// Need to match the component structure precisely or just mock implementation
vi.mock('@src/components/ui/ErrorBoundary', () => ({
    default: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

describe('LeftPanel Component', () => {
    const defaultProps = {
        onPdfDrop: vi.fn(),
        pdfFile: null,
        onSelectPdf: vi.fn(),
        onTextSelection: vi.fn(),
        width: 300,
        t: (key: string) => key,
        onResumePdf: vi.fn(),
        lastReadingInfo: null,
        initialPage: 1
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // Default impl
        mockUseSharedDragDrop.mockReturnValue({
            isDragOver: false,
            containerRef: { current: null },
            dragHandlers: {}
        })
    })

    it('renders PdfViewer inside Worker and ErrorBoundary', async () => {
        render(<LeftPanel {...defaultProps} />)

        expect(screen.getByTestId('pdf-worker')).toBeInTheDocument()
        expect(screen.getByTestId('error-boundary')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
        })
    })

    it('shows drop overlay when isDragOver is true', () => {
        mockUseSharedDragDrop.mockReturnValue({
            isDragOver: true,
            containerRef: { current: null },
            dragHandlers: {}
        })

        render(<LeftPanel {...defaultProps} />)

        expect(screen.getByText('drop_pdf_title')).toBeInTheDocument()
        expect(screen.getByText('drop_pdf_desc')).toBeInTheDocument()
    })
})
