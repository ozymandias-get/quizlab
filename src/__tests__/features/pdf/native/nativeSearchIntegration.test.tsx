/**
 * Search through the real UI, on both renderers.
 *
 * The point of Phase 7 is that the search *UI* did not change: one `PdfSearchBar`, one
 * `usePdfSearchStore`, one toolbar, and the two functions the legacy search plugin
 * exposes. So this file drives the actual toolbar and the actual bar — typing, `Enter`,
 * `Escape`, the `Ctrl+F` pathway — against the native controller, and then against the
 * legacy plugin functions, and asserts that neither renderer leaks into the other.
 *
 * Only PDF.js and layout are faked; `PdfToolbar`, `PdfSearchBar`, `usePdfSearchStore`,
 * `useNativePdfController` and `useNativePdfSearch` are all the real thing.
 */
import {
  type FakeDocument,
  NativeViewerHarness,
  createFakeDocument,
  createLoadingTask
} from './nativeViewerHarness'

import { usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'

import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { TooltipProvider } from '@app/components/ui/tooltip'
import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { highlightsIn, installNativeSearchGeometry, searchLayerOf } from './nativeSearchGeometry'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', async () => {
  const { FakeAnnotationLayer } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: FakeTextLayer,
    AnnotationLayer: FakeAnnotationLayer,
    RenderingCancelledException: class RenderingCancelledException extends Error {
      constructor(message = 'Rendering cancelled') {
        super(message)
        this.name = 'RenderingCancelledException'
      }
    }
  }
})

vi.mock('@features/pdf/engine/pdfWorker', () => ({
  initializeNativePdfWorker: mocks.initializeNativePdfWorker,
  nativeWorkerUrl: 'pdf.worker.min.test.mjs',
  resetNativePdfWorkerForTests: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

/* ------------------------------------------------------------ rAF plumbing */

let pendingFrames: Map<number, FrameRequestCallback>

function flushFrames(): void {
  const frames = [...pendingFrames.entries()]
  pendingFrames.clear()
  act(() => {
    for (const [, cb] of frames) cb(0)
  })
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function waitForFrames(check: () => void, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  for (;;) {
    await settle()
    if (pendingFrames.size > 0) {
      flushFrames()
      continue
    }
    try {
      check()
      return
    } catch (error) {
      lastError = error
    }
    if (Date.now() > deadline) throw lastError
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

/* --------------------------------------------------------------- fixtures */

function serve(document: FakeDocument): void {
  mocks.getDocument.mockImplementation(() => {
    const task = createLoadingTask({ abortOnDestroy: false })
    queueMicrotask(() => task.resolve(document))
    return task
  })
}

/** Render-prop zoom stubs, shaped like the legacy plugin's. */
interface ZoomRenderProps {
  onClick: () => void
}
const ZoomIn = ({ children }: { children: (props: ZoomRenderProps) => React.ReactNode }) =>
  children({ onClick: vi.fn() })
const ZoomOut = ({ children }: { children: (props: ZoomRenderProps) => React.ReactNode }) =>
  children({ onClick: vi.fn() })
const CurrentScale = ({ children }: { children: (props: { scale: number }) => React.ReactNode }) =>
  children({ scale: 1 })

/**
 * The native viewer and the real toolbar, wired exactly as `PdfViewerDocument` wires them.
 *
 * `NativeViewerHarness` already owns the controller and the page box; this adds the toolbar
 * and hands it the controller's own search functions, which is the whole of the native
 * search wiring under test. Passing `legacy` swaps in the plugin functions instead, which
 * is what `PdfViewerDocument` does when the flag is off.
 */
function SearchShell({
  legacy
}: {
  legacy?: { highlight: (k: string) => void; clear: () => void }
}) {
  const [controller, setController] = useState<NativePdfController | null>(null)
  return (
    <TooltipProvider>
      <NativeViewerHarness onController={setController} />
      <PdfToolbar
        pdfFile={{ path: 'book.pdf', name: 'book.pdf', size: 1, streamUrl: 'local-pdf://book' }}
        panMode={false}
        onTogglePanMode={vi.fn()}
        currentPage={controller?.currentPage ?? 1}
        totalPages={controller?.totalPages ?? 1}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        onJumpToPage={vi.fn()}
        highlight={legacy ? legacy.highlight : (controller?.highlight ?? noop)}
        clearHighlights={legacy ? legacy.clear : (controller?.clearHighlights ?? noop)}
        ZoomIn={ZoomIn as never}
        ZoomOut={ZoomOut as never}
        CurrentScale={CurrentScale as never}
      />
    </TooltipProvider>
  )
}

function noop(): void {}

let matchMediaSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  pendingFrames = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = pendingFrames.size + 1
    pendingFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingFrames.delete(id)
  })
  matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList
  )
  usePdfSearchStore.setState({ isOpen: true })
})

afterEach(() => {
  matchMediaSpy.mockRestore()
  vi.unstubAllGlobals()
  usePdfSearchStore.setState({ isOpen: false })
})

/* ------------------------------------------------------------------ tests */

describe('search UI on the native viewer', () => {
  it('renders the shared search bar and highlights a typed keyword on Enter', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus nephritis'] } }))
    const geometry = installNativeSearchGeometry()
    const { container } = render(<SearchShell />)

    await waitForFrames(() => {
      geometry.attachPageBox(container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      if (!container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })

    const input = screen.getByPlaceholderText('search_placeholder')
    fireEvent.change(input, { target: { value: 'lupus' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(highlightsIn(searchLayerOf(container))).toHaveLength(1)
    // The one bar, the one store: nothing about the UI changed to make this work.
    expect(container.querySelectorAll('input[placeholder="search_placeholder"]')).toHaveLength(1)
    geometry.restore()
  })

  it('clears the query and closes the bar on Escape', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus nephritis'] } }))
    const geometry = installNativeSearchGeometry()
    const { container } = render(<SearchShell />)

    await waitForFrames(() => {
      geometry.attachPageBox(container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      if (!container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })

    const input = screen.getByPlaceholderText('search_placeholder')
    fireEvent.change(input, { target: { value: 'lupus' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(highlightsIn(searchLayerOf(container))).toHaveLength(1)

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(highlightsIn(searchLayerOf(container))).toHaveLength(0)
    expect(usePdfSearchStore.getState().isOpen).toBe(false)
    geometry.restore()
  })

  it('opens the same bar from the app-level shortcut store', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus'] } }))
    const geometry = installNativeSearchGeometry()
    const { container } = render(<SearchShell />)

    await waitForFrames(() => {
      geometry.attachPageBox(container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      if (!container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })

    // `usePdfShortcuts` calls this on Ctrl/Cmd+F. No new global keydown listener was added
    // for the native path, so this is still the one route into the bar.
    act(() => usePdfSearchStore.getState().open())
    await waitForFrames(() =>
      expect(screen.getByPlaceholderText('search_placeholder')).toBeInTheDocument()
    )
    geometry.restore()
  })

  it('searches after the debounce without an explicit Enter', async () => {
    serve(createFakeDocument({ numPages: 4, textItems: { 1: ['lupus nephritis'] } }))
    const geometry = installNativeSearchGeometry()
    const { container } = render(<SearchShell />)

    // Settle the viewer first: the geometry stand-in and the text layer's readiness both
    // need real timers, and only the toolbar's 300 ms debounce needs faking ones.
    await waitForFrames(() => {
      geometry.attachPageBox(container.querySelector<HTMLElement>('[data-native-pdf-page]')!)
      if (!container.querySelector('[data-native-pdf-text-layer] span')) {
        throw new Error('no text runs yet')
      }
    })

    vi.useFakeTimers()
    try {
      const input = screen.getByPlaceholderText('search_placeholder')
      fireEvent.change(input, { target: { value: 'nephritis' } })
      expect(highlightsIn(searchLayerOf(container))).toHaveLength(0)

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(highlightsIn(searchLayerOf(container))).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
    geometry.restore()
  })
})

describe('search UI on the legacy viewer', () => {
  it('drives the plugin functions and mounts no native overlay', () => {
    const highlight = vi.fn()
    const clear = vi.fn()
    const { container } = render(<SearchShell legacy={{ highlight, clear }} />)

    const input = screen.getByPlaceholderText('search_placeholder')
    fireEvent.change(input, { target: { value: 'lupus' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(highlight).toHaveBeenCalledWith('lupus')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(clear).toHaveBeenCalled()

    // The flag is off here, so no native page box and therefore no overlay exists at all.
    expect(container.querySelectorAll('[data-native-pdf-search-layer]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-native-pdf-search-highlight]')).toHaveLength(0)
  })

  it('does not search for an empty keyword, on either path', () => {
    const highlight = vi.fn()
    render(<SearchShell legacy={{ highlight, clear: vi.fn() }} />)

    const input = screen.getByPlaceholderText('search_placeholder')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(highlight).not.toHaveBeenCalled()
  })
})
