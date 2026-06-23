import FocusOverlay from '@app/ui/FocusOverlay'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, onClick, ...props }: any) => (
      <div onClick={onClick} {...props}>
        {children}
      </div>
    ),
    button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    )
  },
  useReducedMotion: () => false
}))

vi.mock('@app/hooks/useTextSelection', () => ({
  useTextSelection: () => ({ handleTextSelection: vi.fn() })
}))

const mockUsePdfSelection = vi.fn()
vi.mock('@features/pdf', () => ({
  usePdfSelection: () => mockUsePdfSelection()
}))
vi.mock('@features/pdf/hooks/usePdfOpenActions', () => ({
  usePdfOpenActions: () => ({ handleSelectPdf: vi.fn(), resumeLastPdf: vi.fn() })
}))

vi.mock('@features/pdf/viewer', () => ({
  PdfTabStrip: () => <div data-testid="pdf-tab-strip" />,
  PdfViewer: () => <div data-testid="pdf-viewer">PDF Viewer</div>
}))

const mockAiWebview = vi.fn()
vi.mock('@features/ai/webview', () => ({
  AiWebview: (props: any) => {
    mockAiWebview(props)
    return <div data-testid="ai-webview">AI Webview</div>
  }
}))

vi.mock('@ui/components/AestheticLoader', () => ({
  default: () => <div data-testid="aesthetic-loader">Loading</div>
}))

vi.mock('@ui/components/ErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@ui/layout/BottomBar/animations', () => ({
  focusBackdropVariants: {},
  focusBackdropReducedVariants: {},
  focusContentVariants: {},
  focusContentReducedVariants: {}
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        error_pdf_handler: 'PDF error',
        error_pdf_viewer: 'PDF viewer error',
        focus_close_aria: 'Exit fullscreen'
      }
      return translations[key] ?? key
    },
    i18n: { language: 'en' }
  })
}))

describe('FocusOverlay', () => {
  const defaultPdfSelection = {
    pdfFile: null,
    pdfTabs: [],
    activePdfTab: null,
    activePdfTabId: '',
    setActivePdfTab: vi.fn(),
    closePdfTab: vi.fn(),
    renamePdfTab: vi.fn(),
    handleSelectPdf: vi.fn(),
    updateReadingProgress: vi.fn(),
    resumeLastPdf: vi.fn(),
    recentReadingInfo: null,
    clearLastReading: vi.fn(),
    restoreRecentReading: vi.fn(),
    addEmptyPdfTab: vi.fn(),
    openGoogleDriveTab: vi.fn(),
    activeTabInitialPage: undefined,
    goToPdfHome: vi.fn()
  }

  beforeEach(() => {
    mockAiWebview.mockClear()
    mockUsePdfSelection.mockReturnValue({ ...defaultPdfSelection })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the AI webview when mode is "ai" and the webview is mounted', async () => {
    render(
      <FocusOverlay
        mode="ai"
        onClose={vi.fn()}
        isWebviewMounted
        isResizing={false}
        isBarHovered={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-webview')).toBeInTheDocument()
    })
    expect(mockAiWebview).toHaveBeenCalledWith(
      expect.objectContaining({ isResizing: false, isBarHovered: false })
    )
  })

  it('renders the aesthetic loader while AI is still mounting', () => {
    render(
      <FocusOverlay
        mode="ai"
        onClose={vi.fn()}
        isWebviewMounted={false}
        isResizing={false}
        isBarHovered={false}
      />
    )

    expect(screen.getByTestId('aesthetic-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-webview')).not.toBeInTheDocument()
  })

  it('renders the PDF viewer when mode is "pdf"', async () => {
    render(
      <FocusOverlay
        mode="pdf"
        onClose={vi.fn()}
        isWebviewMounted
        isResizing={false}
        isBarHovered={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
    })
  })

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <FocusOverlay
        mode="ai"
        onClose={onClose}
        isWebviewMounted
        isResizing={false}
        isBarHovered={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <FocusOverlay
        mode="ai"
        onClose={onClose}
        isWebviewMounted
        isResizing={false}
        isBarHovered={false}
      />
    )

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onClose on Escape when typing in an input', () => {
    const onClose = vi.fn()
    render(
      <div>
        <input data-testid="input-field" />
        <FocusOverlay
          mode="ai"
          onClose={onClose}
          isWebviewMounted
          isResizing={false}
          isBarHovered={false}
        />
      </div>
    )

    const input = screen.getByTestId('input-field')
    act(() => {
      input.focus()
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
