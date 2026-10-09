/**
 * `PdfViewer` — the lazy chunk's outer shell.
 *
 * What is under test here is the shell's own contract, not the renderer: with no
 * file it shows the placeholder, and with a file it hands the document down to
 * `PdfViewerDocument` and shows a toolbar. The renderer is mocked out.
 *
 * The renderer itself used to be asserted through `@react-pdf-viewer`'s `<Viewer>`
 * props from this file — `defaultScale: 'PageWidth'`, `viewMode: 'SinglePage'` —
 * and through its `onDocumentLoad` / `onPageChange` callbacks. Those are gone with
 * the viewer. The behaviour they stood for is not: the fit-scale start and the
 * initial-page resume now live in `useNativePdfController` / `usePdfPageState` and
 * are covered by `nativeInitialPageResume.test.tsx` and `nativeZoomParity.test.tsx`
 * against the real controller.
 */
import PdfViewer from '@features/pdf/ui/components/PdfViewer'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  documentProps: { current: null as Record<string, unknown> | null }
}))

vi.mock('@app/providers/ai-context', () => ({
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

vi.mock('@features/pdf/ui/components/PdfPlaceholder', () => ({
  default: () => <div>PDF Placeholder</div>
}))

vi.mock('@features/pdf/ui/components/PdfViewerDocument', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.documentProps.current = props
    return <div>PDF Viewer Content</div>
  }
}))

const pdfFile = {
  path: 'test.pdf',
  name: 'test.pdf',
  size: 1000,
  lastModified: 0,
  streamUrl: 'local-pdf://test'
}

function documentProps(): Record<string, unknown> {
  const captured = mocks.documentProps.current
  if (!captured) throw new Error('PdfViewerDocument was never rendered')
  return captured
}

describe('PdfViewer', () => {
  it('renders placeholder when no PDF is provided', () => {
    render(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
  })

  it('renders the document when a PDF is provided', () => {
    render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()
  })

  it('passes the resume page down to the document', () => {
    render(<PdfViewer pdfFile={pdfFile} initialPage={8} onSelectPdf={vi.fn()} />)

    expect(documentProps().initialPage).toBe(8)
  })

  it('reports progress through the callback it was given', () => {
    const onReadingProgressChange = vi.fn()
    render(
      <PdfViewer
        pdfFile={pdfFile}
        onSelectPdf={vi.fn()}
        onReadingProgressChange={onReadingProgressChange}
      />
    )

    expect(documentProps().onReadingProgressChange).toBe(onReadingProgressChange)
  })

  it('hands down the file it was given, not a stale one', () => {
    render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    const props = documentProps()
    expect(props.pdfFile).toBe(pdfFile)
    expect(props.pdfUrl).toBe('local-pdf://test')
  })
})
