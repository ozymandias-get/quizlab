import FocusOverlay from '@app/ui/FocusOverlay'

import { useAppearance } from '@shared/stores/appearanceStore'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const motionHandle = vi.hoisted(() => ({
  /** The content shell's reveal handler, captured so tests can complete it. */
  onAnimationComplete: null as (() => void) | null
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, onClick, onAnimationComplete, ...props }: any) => {
      if (typeof onAnimationComplete === 'function') {
        motionHandle.onAnimationComplete = onAnimationComplete
      }
      return (
        <div onClick={onClick} {...props}>
          {children}
        </div>
      )
    },
    button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    )
  },
  useReducedMotion: () => false
}))

const mockUsePdfSelection = vi.fn()
vi.mock('@features/pdf', () => ({
  usePdfSelection: () => mockUsePdfSelection(),
  usePdfOpenActions: () => ({ handleSelectPdf: vi.fn(), resumeLastPdf: vi.fn() }),
  useReadingProgressPersistence: () => ({}),
  usePdfTabStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(
      new Proxy(
        {},
        {
          get: (_t, prop) =>
            typeof prop === 'string' && prop.startsWith('pdf')
              ? []
              : prop === 'activePdfTabId'
                ? null
                : vi.fn()
        }
      )
    )
}))

vi.mock('@features/pdf/viewer', () => ({
  PdfTabStrip: () => <div data-testid="pdf-tab-strip" />,
  PdfViewer: () => <div data-testid="pdf-viewer">PDF Viewer</div>
}))

const mockAiViewSurface = vi.fn()
vi.mock('@features/ai/aiViewSurface', () => ({
  AiViewSurface: (props: unknown) => {
    mockAiViewSurface(props)
    return <div data-testid="ai-content">AI Content</div>
  }
}))

const lastSurfaceProps = (): Record<string, unknown> =>
  (mockAiViewSurface.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

vi.mock('@ui/components/PanelLoadingPlaceholder', () => ({
  default: () => <div data-testid="panel-loading-placeholder" />
}))

vi.mock('@ui/components/ErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@app/ui/BottomBar/animations', () => ({
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

const surfaceState = {
  aliveTabIds: [] as string[],
  showHome: true,
  showHideHome: { show: vi.fn(), hide: vi.fn() },
  coldTabIds: new Set<string>(),
  recordTabUrl: vi.fn(),
  getRestoredUrl: () => undefined,
  tabUrlRequests: {} as Record<string, never>,
  requestTabUrl: vi.fn(),
  clearTabUrlRequest: vi.fn()
}

describe('FocusOverlay', () => {
  const defaultPdfSelection = {
    pdfFile: null,
    pdfTabs: [],
    activePdfTab: null,
    activePdfTabId: '',
    setActivePdfTab: vi.fn(),
    closePdfTab: vi.fn(),
    movePdfTab: vi.fn(),
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
    mockAiViewSurface.mockClear()
    mockUsePdfSelection.mockReturnValue({ ...defaultPdfSelection })
    motionHandle.onAnimationComplete = null
    // The overlay reads the open session from the appearance store; App renders
    // it while a focus mode is set.
    useAppearance.setState({ focusMode: 'ai' })
  })

  afterEach(() => {
    vi.useRealTimers()
    useAppearance.setState({ focusMode: null })
  })

  it('renders the AI content when mode is "ai" and the content is mounted', async () => {
    render(
      <FocusOverlay
        mode="ai"
        onClose={vi.fn()}
        isAiSurfaceMounted
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-content')).toBeInTheDocument()
    })
    expect(mockAiViewSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        isResizing: false,
        isSurfaceActive: true
      })
    )
  })

  it('renders a neutral placeholder while AI is still mounting', () => {
    render(
      <FocusOverlay
        mode="ai"
        onClose={vi.fn()}
        isAiSurfaceMounted={false}
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
      />
    )

    expect(screen.getByTestId('panel-loading-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-content')).not.toBeInTheDocument()
  })

  it('renders the PDF viewer when mode is "pdf"', async () => {
    render(
      <FocusOverlay
        mode="pdf"
        onClose={vi.fn()}
        isAiSurfaceMounted
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
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
        isAiSurfaceMounted
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  const renderOverlay = (onClose = vi.fn()) =>
    render(
      <FocusOverlay
        mode="ai"
        onClose={onClose}
        isAiSurfaceMounted
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
      />
    )

  const closeButton = () => screen.getByRole('button', { name: 'Exit fullscreen' })

  /** Flushes the lazy surface import so the shell's props are observable. */
  const settleLazyLoad = async () => {
    await act(async () => {
      await Promise.resolve()
    })
  }

  it('reveals the view when the reveal animation reports completion', async () => {
    vi.useFakeTimers()
    renderOverlay()
    await settleLazyLoad()
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    act(() => {
      motionHandle.onAnimationComplete?.()
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)
  })

  it('reveals the view through the fallback when the animation never completes', async () => {
    // This is the >1s / suspended-animation case: completion never arrives, so
    // the gate holds for exactly REVEAL_FALLBACK_MS and then lifts, instead of
    // leaving a blank panel. The shipped reveal is ~0.5s, so in practice the
    // timer only fires when the completion is genuinely lost.
    vi.useFakeTimers()
    renderOverlay()
    await settleLazyLoad()
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)
  })

  it('keeps the view hidden when the close lands just before the fallback', async () => {
    // The dangerous window: the reveal fallback is armed for 1000ms and the user
    // closes at 950ms. If the timer fired anyway it would re-show the native view
    // over the shell that is already shrinking.
    vi.useFakeTimers()
    renderOverlay()
    await settleLazyLoad()
    act(() => {
      vi.advanceTimersByTime(950)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    fireEvent.click(closeButton())
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)
  })

  it('ignores a reveal completion that arrives after a close started', async () => {
    vi.useFakeTimers()
    renderOverlay()
    await settleLazyLoad()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)

    fireEvent.click(closeButton())
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    // The exit animation completing must not be mistaken for the reveal.
    act(() => {
      motionHandle.onAnimationComplete?.()
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)
  })

  it('does not let the previous session fallback reveal the next session', async () => {
    vi.useFakeTimers()
    const first = renderOverlay()
    await settleLazyLoad()
    act(() => {
      vi.advanceTimersByTime(900)
    })
    fireEvent.click(closeButton())
    first.unmount()

    renderOverlay()
    await settleLazyLoad()
    // Past the first session's 1000ms boundary: only the new session's timer
    // exists now, and it is not due yet.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)
  })

  it('starts a fresh reveal session when focus reopens on the same instance', async () => {
    // AnimatePresence keeps the exiting overlay mounted with its old props, so a
    // reopen inside the exit animation reuses this component instance. The store
    // is the only thing that tells it a new session started; without that the
    // previous close's state made the native view stay hidden for good.
    vi.useFakeTimers()
    renderOverlay()
    await settleLazyLoad()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)

    fireEvent.click(closeButton())
    act(() => {
      useAppearance.setState({ focusMode: null })
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    // Reopened before the exit finished: same instance, no remount.
    act(() => {
      useAppearance.setState({ focusMode: 'ai' })
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(lastSurfaceProps().isRevealInProgress).toBe(false)
  })

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <FocusOverlay
        mode="ai"
        onClose={onClose}
        isAiSurfaceMounted
        isResizing={false}
        isAiSurfaceActive
        aiViewSurfaceState={surfaceState}
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
          isAiSurfaceMounted
          isResizing={false}
          isAiSurfaceActive
          aiViewSurfaceState={surfaceState}
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
