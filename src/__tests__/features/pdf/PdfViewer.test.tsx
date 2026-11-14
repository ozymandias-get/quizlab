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
 *
 * The closing surface is the second contract: the viewer leaves on an opacity ramp,
 * is cancelled by a reopen, is skipped for reduced motion and for a surface with no
 * painted page, and is a native surface (not a fade) when a Drive tab takes over.
 * jsdom has no Web Animations API, so `Element.animate` is a recorder here — the
 * *arguments* the shell asks for are the contract, exactly as in
 * `nativePageTransitionViewer.test.tsx`.
 */
import PdfViewer from '@features/pdf/ui/components/PdfViewer'

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  documentProps: { current: null as Record<string, unknown> | null },
  /** Whether the mocked document is holding a committed page, like the real one. */
  hasPaintedCanvas: true
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiState: () => ({
    autoSend: false,
    chromeUserAgent: 'mock-user-agent'
  }),
  useAiSessionUiPrefsState: () => ({
    autoSend: false
  }),
  useAiSessionActions: () => ({
    toggleAutoSend: vi.fn()
  })
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    startScreenshot: vi.fn(),
    queueImageForAi: vi.fn(),
    queueTextForAi: vi.fn(),
    sendTextDirectToAi: vi.fn().mockResolvedValue({ success: true }),
    sendImageDirectToAi: vi.fn().mockResolvedValue({ success: true })
  }),
  useAppToolQueueState: () => ({ pendingAiItems: [], autoSend: false }),
  useAppToolScreenshotState: () => ({ isScreenshotMode: false, pendingAreaCapture: null })
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

vi.mock('@features/pdf/ui/components/PdfPlaceholder', () => ({
  default: () => <div>PDF Placeholder</div>
}))

vi.mock('@features/pdf/ui/components/GoogleDrivePanel', () => ({
  default: ({ tabId }: { tabId: string }) => <div>Google Drive Panel {tabId}</div>
}))

vi.mock('@features/pdf/ui/components/PdfViewerDocument', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.documentProps.current = props
    return (
      <div>
        PDF Viewer Content
        {/* `data-native-pdf-canvas-page` is the real viewer's "these pixels are
            committed" marker; the exit ramp is only presented over it. */}
        {mocks.hasPaintedCanvas && <canvas data-native-pdf-canvas-page="1" />}
      </div>
    )
  }
}))

const pdfFile = {
  path: 'test.pdf',
  name: 'test.pdf',
  size: 1000,
  lastModified: 0,
  streamUrl: 'local-pdf://test'
}

const driveTab = { id: 'drive-tab', file: null, kind: 'drive' as const }

function documentProps(): Record<string, unknown> {
  const captured = mocks.documentProps.current
  if (!captured) throw new Error('PdfViewerDocument was never rendered')
  return captured
}

interface RecordedAnimation {
  element: Element
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions | number | undefined
  cancel: ReturnType<typeof vi.fn>
  finish: () => void
}

let animations: RecordedAnimation[]
let originalAnimate: Element['animate'] | undefined

/** State the reduced-motion preference; the shared setup stub answers `false`. */
function setPrefersReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPaintedCanvas = true
  animations = []
  setPrefersReducedMotion(false)

  originalAnimate = Element.prototype.animate
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions | number
  ) {
    let resolveFinished!: (value: Element) => void
    let rejectFinished!: (reason: unknown) => void
    const finished = new Promise<Element>((resolve, reject) => {
      resolveFinished = resolve
      rejectFinished = reject
    })
    const cancel = vi.fn(() => rejectFinished(new Error('cancelled')))
    animations.push({
      element: this,
      keyframes,
      options,
      cancel,
      finish: () => resolveFinished(this)
    })
    return { cancel, finished } as unknown as Animation
  } as Element['animate']
})

afterEach(() => {
  if (originalAnimate) {
    Element.prototype.animate = originalAnimate
  } else {
    delete (Element.prototype as { animate?: Element['animate'] }).animate
  }
})

describe('PdfViewer', () => {
  // Both children are mocked, so the assertion that matters is *which* one the
  // shell chose for the file it was handed — not the text the mock emits.
  it.each([
    ['no PDF', null, 'PDF Placeholder'],
    ['a PDF', pdfFile, 'PDF Viewer Content']
  ])('mounts the %s branch and not the other one', (_label, file, expected) => {
    render(<PdfViewer pdfFile={file} onSelectPdf={vi.fn()} />)

    const other = expected === 'PDF Placeholder' ? 'PDF Viewer Content' : 'PDF Placeholder'
    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(screen.queryByText(other)).not.toBeInTheDocument()
  })

  it('passes the resume page and the progress callback down to the document', () => {
    const onReadingProgressChange = vi.fn()
    render(
      <PdfViewer
        pdfFile={pdfFile}
        initialPage={8}
        onSelectPdf={vi.fn()}
        onReadingProgressChange={onReadingProgressChange}
      />
    )

    expect(documentProps().initialPage).toBe(8)
    expect(documentProps().onReadingProgressChange).toBe(onReadingProgressChange)
  })

  it('hands down the file it was given, not a stale one', () => {
    render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    const props = documentProps()
    expect(props.pdfFile).toBe(pdfFile)
    expect(props.pdfUrl).toBe('local-pdf://test')
  })
})

describe('PdfViewer — closing the document', () => {
  it('fades the painted surface out before releasing the document', async () => {
    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)

    // The placeholder arrives underneath at once, but the document is still mounted
    // and still on top for the length of the ramp: that is what makes this a fade
    // rather than a cut.
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
    expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()

    expect(animations).toHaveLength(1)
    expect(animations[0].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(animations[0].options).toEqual({
      duration: 140,
      easing: 'cubic-bezier(0.2, 0.9, 0.22, 1)',
      fill: 'forwards'
    })
    // The ramp is on the layer that wraps the document, not on a canvas or a page box:
    // scaling a live PDF surface is the glitch this transition must not repeat.
    expect(animations[0].element.contains(screen.getByText('PDF Viewer Content'))).toBe(true)
    // Clicks during the ramp belong to the placeholder beneath, not to the document.
    expect((animations[0].element as HTMLElement).style.pointerEvents).toBe('none')

    await act(async () => {
      animations[0].finish()
      await Promise.resolve()
    })

    expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
  })

  it('cancels the ramp when the document is reopened before it finishes', async () => {
    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    expect(animations).toHaveLength(1)

    rerender(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)
    await act(async () => {
      await Promise.resolve()
    })

    // The same mounted document is shown again — no reload, no flash of the
    // placeholder, and the cancelled animation cannot unmount it a moment later.
    expect(animations[0].cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()
    expect(screen.queryByText('PDF Placeholder')).not.toBeInTheDocument()
    expect((animations[0].element as HTMLElement).style.pointerEvents).toBe('')
  })

  it('starts a fresh ramp on a second close, rather than reusing the first one', async () => {
    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    rerender(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)
    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)

    expect(animations).toHaveLength(2)
    expect(animations[1].cancel).not.toHaveBeenCalled()

    await act(async () => {
      animations[1].finish()
      await Promise.resolve()
    })
    expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
  })

  it('does not stack a second ramp when the shell re-renders during the exit', () => {
    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    // The resume page can settle mid-close (a flushed reading position), which re-runs
    // the close effect. It must observe the running ramp, not start another one.
    rerender(<PdfViewer pdfFile={null} initialPage={12} onSelectPdf={vi.fn()} />)

    expect(animations).toHaveLength(1)
    expect(animations[0].cancel).not.toHaveBeenCalled()
  })

  it('unmounts when the animation never reports completion', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)
      rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
      expect(screen.getByText('PDF Viewer Content')).toBeInTheDocument()

      // A paused or dropped animation cannot be allowed to leave an invisible layer
      // over the placeholder for the rest of the session.
      act(() => {
        vi.advanceTimersByTime(220)
      })

      expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
      expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('releases the document immediately when the reader asked for reduced motion', () => {
    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)
    setPrefersReducedMotion(true)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)

    // No animation, and no pending exit window: the placeholder is the only surface in
    // the same commit.
    expect(animations).toHaveLength(0)
    expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
  })

  it('does not animate a surface that has no committed page yet', () => {
    mocks.hasPaintedCanvas = false

    const { rerender } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)
    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)

    // Closing a PDF that is still loading must not fade a spinner, and must not leave
    // an exit window in which a revoked blob URL can reject.
    expect(animations).toHaveLength(0)
    expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
    expect(screen.getByText('PDF Placeholder')).toBeInTheDocument()
  })

  it('drops the ramp when the shell itself unmounts', () => {
    const { rerender, unmount } = render(<PdfViewer pdfFile={pdfFile} onSelectPdf={vi.fn()} />)

    rerender(<PdfViewer pdfFile={null} onSelectPdf={vi.fn()} />)
    unmount()

    // A ramp attached to a detached node would keep a composited layer alive for the
    // rest of the session, so the shell's teardown owns it.
    expect(animations[0].cancel).toHaveBeenCalledTimes(1)
  })

  it('leaves the viewer to the Drive surface instead of fading it', () => {
    const { rerender } = render(
      <PdfViewer
        pdfFile={pdfFile}
        activePdfTab={{ id: 'pdf-tab', file: pdfFile }}
        onSelectPdf={vi.fn()}
      />
    )

    rerender(<PdfViewer pdfFile={null} activePdfTab={driveTab} onSelectPdf={vi.fn()} />)

    // A native WebContentsView paints above the DOM, so there is nothing to fade and
    // nothing that may outlive the switch.
    expect(animations).toHaveLength(0)
    expect(screen.queryByText('PDF Viewer Content')).not.toBeInTheDocument()
    expect(screen.queryByText('PDF Placeholder')).not.toBeInTheDocument()
    expect(screen.getByText('Google Drive Panel drive-tab')).toBeInTheDocument()
  })
})
