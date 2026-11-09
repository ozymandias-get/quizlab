import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'
import { resetPdfSearchStore, usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  resetPdfSearchStore()
  usePdfSearchStore.setState({ isOpen: true })
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const ZoomIn = ({ children }: any) => children({ onClick: vi.fn() })
const ZoomOut = ({ children }: any) => children({ onClick: vi.fn() })
const CurrentScale = ({ children }: any) => children({ scale: 1.25 })

interface PdfFileLike {
  path: string
  name: string
  streamUrl?: string
  size?: number
}

interface Overrides {
  pdfFile?: PdfFileLike | null
  panMode?: boolean
  onTogglePanMode?: () => void
  onReload?: () => void
  highlight?: Mock<(keyword: string) => void>
  clearHighlights?: Mock<() => void>
}

/**
 * Every toolbar test renders the same 14-prop component, so the defaults live
 * here once. The previous version copy-pasted the whole block five times, which
 * is how `pdf-toolbar-reload` and the search wiring drifted apart unnoticed.
 */
function renderToolbar(overrides: Overrides = {}) {
  const props = {
    pdfFile: overrides.pdfFile ?? null,
    panMode: overrides.panMode ?? false,
    onTogglePanMode: overrides.onTogglePanMode ?? vi.fn(),
    currentPage: 2,
    totalPages: 61,
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    highlight: overrides.highlight ?? vi.fn<(keyword: string) => void>(),
    clearHighlights: overrides.clearHighlights ?? vi.fn<() => void>(),
    ZoomIn,
    ZoomOut,
    CurrentScale,
    onJumpToPage: vi.fn(),
    onReload: overrides.onReload ?? vi.fn()
  }

  const draw = () => (
    <TooltipProvider>
      <PdfToolbar {...(props as React.ComponentProps<typeof PdfToolbar>)} />
    </TooltipProvider>
  )

  const view = render(draw())

  return {
    ...view,
    props,
    /** Apply new overrides to an already-mounted toolbar. */
    update(next: Overrides) {
      Object.assign(props, next)
      view.rerender(draw())
    },
    /** Swap the open document, the way a tab switch does. */
    setPdfFile(next: PdfFileLike | null) {
      props.pdfFile = next
      view.rerender(draw())
    }
  }
}

/*
 * Not tested on purpose: the AI quick-bar (text / image / area send buttons and
 * the mode toggle). Those controls moved to the selection menu, and their
 * `data-testid`s no longer exist anywhere under `src/`. A test that asserts a
 * removed feature is still absent only fails if someone re-adds the exact same
 * identifiers, so it guarded nothing.
 */

describe('PdfToolbar', () => {
  it('renders the pan-mode toggle, reports clicks and mirrors the pressed state', () => {
    const onTogglePanMode = vi.fn()
    const { getByTestId, queryByLabelText, update } = renderToolbar({ onTogglePanMode })

    // The tool palette only appears when the reader asks for it.
    expect(queryByLabelText('pdf_tools')).not.toBeInTheDocument()

    const panButton = getByTestId('pan-mode-button')
    expect(panButton).toBeInTheDocument()
    expect(panButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(panButton)
    expect(onTogglePanMode).toHaveBeenCalledTimes(1)

    // Pressed state follows the prop, not the click: the toolbar mirrors what
    // the viewer decided, it does not own it.
    update({ panMode: true })
    expect(getByTestId('pan-mode-button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps reload as an independent viewer control', () => {
    const onReload = vi.fn()
    const { getByTestId } = renderToolbar({ onReload })

    fireEvent.click(getByTestId('pdf-toolbar-reload'))

    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('keeps the secondary tools reachable from the compact menu', () => {
    const onReload = vi.fn()
    const onTogglePanMode = vi.fn()
    const { getByTestId } = renderToolbar({ onReload, onTogglePanMode })

    fireEvent.click(getByTestId('pdf-toolbar-more'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'pdf_pan_mode' }))
    expect(onTogglePanMode).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(getByTestId('pdf-toolbar-more'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'ctx_reload' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the compact menu and cycles it with the keyboard', () => {
    const { getByTestId } = renderToolbar()

    const trigger = getByTestId('pdf-toolbar-more')
    fireEvent.click(trigger)

    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()

    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()

    fireEvent.keyDown(items[0], { key: 'End' })
    expect(items[items.length - 1]).toHaveFocus()

    fireEvent.keyDown(items[items.length - 1], { key: 'Home' })
    expect(items[0]).toHaveFocus()
  })

  it('returns focus to the trigger when Escape closes the compact menu', () => {
    const { getByTestId } = renderToolbar()

    const trigger = getByTestId('pdf-toolbar-more')
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('handles Escape in one layer and does not leak it to outer listeners', () => {
    const { getByTestId } = renderToolbar()
    const documentKeyDown = vi.fn()
    document.addEventListener('keydown', documentKeyDown)

    fireEvent.click(getByTestId('pdf-toolbar-more'))
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(documentKeyDown).not.toHaveBeenCalled()

    document.removeEventListener('keydown', documentKeyDown)
  })

  it('flips the compact menu when there is no room above or to the left', () => {
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        if (this.getAttribute('data-testid') === 'pdf-toolbar-more') {
          return { top: 4, bottom: 24, left: 2, right: 22, width: 20, height: 20 } as DOMRect
        }
        if (this.getAttribute('data-slot') === 'menu-surface') {
          return { top: 0, bottom: 0, left: 0, right: 0, width: 192, height: 100 } as DOMRect
        }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 } as DOMRect
      })

    try {
      const { getByTestId } = renderToolbar()
      fireEvent.click(getByTestId('pdf-toolbar-more'))

      const menu = screen.getByRole('menu')
      expect(menu).toHaveClass('top-full')
      expect(menu).toHaveClass('right-0')
    } finally {
      rectSpy.mockRestore()
    }
  })

  describe('narrow toolbar zoom hand-off', () => {
    class MockResizeObserver {
      static instances: MockResizeObserver[] = []
      callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        MockResizeObserver.instances.push(this)
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }

    afterEach(() => {
      vi.unstubAllGlobals()
      MockResizeObserver.instances = []
    })

    function emitWidth(width: number) {
      act(() => {
        for (const observer of MockResizeObserver.instances) {
          observer.callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            observer as unknown as ResizeObserver
          )
        }
      })
    }

    function installResizeObserver() {
      vi.stubGlobal('ResizeObserver', MockResizeObserver)
    }

    it.each([
      [419, true],
      [420, false],
      [421, false]
    ])('at %ipx moves zoom into the compact menu: %s', (width, isNarrow) => {
      installResizeObserver()
      const { getByTestId } = renderToolbar()
      emitWidth(width)

      fireEvent.click(getByTestId('pdf-toolbar-more'))

      if (isNarrow) {
        expect(screen.getByRole('menuitem', { name: 'zoom_out' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'zoom_in' })).toBeInTheDocument()
        expect(screen.queryByLabelText('zoom_out')).not.toBeInTheDocument()
      } else {
        expect(screen.queryByRole('menuitem', { name: 'zoom_out' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'zoom_in' })).not.toBeInTheDocument()
        expect(screen.getByLabelText('zoom_out')).toBeInTheDocument()
        expect(screen.getByLabelText('zoom_in')).toBeInTheDocument()
      }
    })
  })

  describe('viewer with no legacy renderer branch', () => {
    it('reveals the search bar when the shared store opens it', async () => {
      renderToolbar()

      act(() => usePdfSearchStore.setState({ isOpen: false }))
      await waitFor(() =>
        expect(screen.queryByPlaceholderText('search_placeholder')).not.toBeInTheDocument()
      )
      act(() => usePdfSearchStore.getState().open())

      expect(await screen.findByPlaceholderText('search_placeholder')).toBeInTheDocument()
    })

    it('clears the highlights when the search input is emptied', async () => {
      const highlight = vi.fn<(keyword: string) => void>()
      const clearHighlights = vi.fn<() => void>()
      renderToolbar({ highlight, clearHighlights })

      const input = screen.getByPlaceholderText('search_placeholder')
      fireEvent.change(input, { target: { value: 'thermodynamics' } })
      await waitFor(() => expect(highlight).toHaveBeenCalledWith('thermodynamics'))
      expect(clearHighlights).not.toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('clear'))

      // Emptying the field is an explicit clear: no 300 ms debounce window in
      // which the old highlights remain visible.
      expect(clearHighlights).toHaveBeenCalledTimes(1)
      expect(highlight).toHaveBeenCalledTimes(1)
      expect(screen.getByPlaceholderText('search_placeholder')).toHaveValue('')
    })

    it('keeps the query in the shared store so overlapping toolbars agree', () => {
      renderToolbar()

      fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
        target: { value: 'entropy' }
      })

      expect(usePdfSearchStore.getState().keyword).toBe('entropy')
    })

    it('does not carry a pending search into the next document', async () => {
      const highlight = vi.fn<(keyword: string) => void>()
      const clearHighlights = vi.fn<() => void>()
      const { setPdfFile } = renderToolbar({
        highlight,
        clearHighlights,
        pdfFile: { path: '/docs/first.pdf', name: 'first.pdf' }
      })

      fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
        target: { value: 'thermodynamics' }
      })
      expect(highlight).not.toHaveBeenCalled()

      setPdfFile({ path: '/docs/second.pdf', name: 'second.pdf' })
      await waitFor(() => expect(clearHighlights).toHaveBeenCalled())

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(highlight).not.toHaveBeenCalled()
    })

    it('resets the search when the same path opens different content', async () => {
      const clearHighlights = vi.fn<() => void>()
      const { setPdfFile } = renderToolbar({
        clearHighlights,
        pdfFile: { path: '/docs/same.pdf', name: 'same.pdf', streamUrl: 'blob:one' }
      })

      fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
        target: { value: 'thermodynamics' }
      })
      expect(usePdfSearchStore.getState().keyword).toBe('thermodynamics')

      // Same path, new stream (the file was regenerated or re-opened).
      setPdfFile({ path: '/docs/same.pdf', name: 'same.pdf', streamUrl: 'blob:two' })

      await waitFor(() => expect(clearHighlights).toHaveBeenCalled())
      expect(usePdfSearchStore.getState().keyword).toBe('')
    })

    it('keeps two viewers with different documents from sharing one query', async () => {
      const drawTwo = (first: string, second: string) => (
        <TooltipProvider>
          <PdfToolbar
            {...({
              pdfFile: { path: first, name: first, streamUrl: 'blob:a' },
              panMode: false,
              onTogglePanMode: vi.fn(),
              currentPage: 1,
              totalPages: 5,
              onPreviousPage: vi.fn(),
              onNextPage: vi.fn(),
              onJumpToPage: vi.fn(),
              highlight: vi.fn(),
              clearHighlights: vi.fn(),
              ZoomIn,
              ZoomOut,
              CurrentScale
            } as React.ComponentProps<typeof PdfToolbar>)}
          />
          <PdfToolbar
            {...({
              pdfFile: { path: second, name: second, streamUrl: 'blob:b' },
              panMode: false,
              onTogglePanMode: vi.fn(),
              currentPage: 1,
              totalPages: 5,
              onPreviousPage: vi.fn(),
              onNextPage: vi.fn(),
              onJumpToPage: vi.fn(),
              highlight: vi.fn(),
              clearHighlights: vi.fn(),
              ZoomIn,
              ZoomOut,
              CurrentScale
            } as React.ComponentProps<typeof PdfToolbar>)}
          />
        </TooltipProvider>
      )

      const { rerender } = render(drawTwo('/docs/a.pdf', '/docs/b.pdf'))

      const inputs = screen.getAllByPlaceholderText('search_placeholder')
      expect(inputs).toHaveLength(2)

      fireEvent.change(inputs[0], { target: { value: 'lupus' } })

      // Document B no longer mirrors document A's query.
      expect(usePdfSearchStore.getState().ownerId).toContain('/docs/a.pdf')
      // AnimatePresence keeps B's exiting bar mounted briefly.
      await waitFor(() =>
        expect(screen.getAllByPlaceholderText('search_placeholder')).toHaveLength(1)
      )
      expect(screen.getByPlaceholderText('search_placeholder')).toHaveValue('lupus')

      rerender(drawTwo('/docs/a.pdf', '/docs/b.pdf'))
    })
  })
})
