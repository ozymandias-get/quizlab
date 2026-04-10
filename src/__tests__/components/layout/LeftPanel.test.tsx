import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LeftPanel, { getPdfViewerRemountKey } from '@ui/layout/LeftPanel'
import type { PdfTab } from '@features/pdf'
import type { PdfFile } from '@shared-core/types'

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

const mockUseSharedDragDrop = vi.fn()
vi.mock('@shared/hooks/useSharedDragDrop', () => ({
  useSharedDragDrop: (onDrop: any) => mockUseSharedDragDrop(onDrop)
}))

vi.mock('@features/pdf/ui/components/PdfViewer', () => ({
  default: () => <div data-testid="pdf-viewer">PdfViewer Mock</div>
}))

vi.mock('@react-pdf-viewer/core', () => ({
  Worker: ({ children }: any) => <div data-testid="pdf-worker">{children}</div>
}))

vi.mock('@ui/components/ErrorBoundary', () => ({
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
    mockUseSharedDragDrop.mockReturnValue({
      isDragOver: false,
      containerRef: { current: null },
      dragHandlers: {}
    })
  })

  it('renders PdfViewer inside ErrorBoundary', async () => {
    const { container } = render(<LeftPanel {...defaultProps} />)

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('glass-tier-1')

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
    })
  })

  it('computes stable PdfViewer remount key without active tab id', () => {
    const file: PdfFile = { name: 'a.pdf', path: '/a.pdf', streamUrl: 'blob:1', size: 1 }
    const tab: PdfTab = { id: 'tab-1', file, kind: 'pdf', viewerSessionKey: 'vk-1' }
    expect(getPdfViewerRemountKey(tab, file)).toBe('vk-1|/a.pdf|blob:1')
    expect(getPdfViewerRemountKey({ id: 'd', file: null, kind: 'drive' }, null)).toBe('drive')
    expect(getPdfViewerRemountKey({ id: 'e', file: null, kind: 'pdf' }, null)).toBe('empty')
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
