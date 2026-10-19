import LeftPanel from '@ui/layout/LeftPanel'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseSharedDragDrop = vi.fn()
vi.mock('@shared/hooks/useSharedDragDrop', () => ({
  useSharedDragDrop: (onDrop: any) => mockUseSharedDragDrop(onDrop)
}))

vi.mock('@features/pdf/viewer', () => ({
  PdfViewer: () => <div data-testid="pdf-viewer">PdfViewer Mock</div>,
  PdfTabStrip: () => <div data-testid="pdf-tab-strip">PdfTabStrip Mock</div>
}))

vi.mock('@ui/components/ErrorBoundary', () => ({
  default: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))
describe('LeftPanel', () => {
  const defaultProps = {
    onPdfDrop: vi.fn(),
    pdfFile: null,
    onSelectPdf: vi.fn(),
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

  it('mounts the PDF viewer inside the panel shell', async () => {
    const { container } = render(<LeftPanel {...defaultProps} />)

    // The panel's own surface class, plus the viewer being mounted under it.
    // The ErrorBoundary wrapper is deliberately not asserted: it is stubbed
    // here, so asserting it would only test the stub.
    expect(container.querySelector('.glass-tier-1')).toBeInTheDocument()
    expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument()
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
