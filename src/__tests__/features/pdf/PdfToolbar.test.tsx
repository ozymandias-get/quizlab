import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'
import { usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'

// The bar is closed until something opens it � Ctrl+F through usePdfShortcuts, or the
// toggle in the collapsed state. Every case below wants it open.
beforeEach(() => {
  usePdfSearchStore.setState({ isOpen: true })
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const ZoomIn = ({ children }: any) => children({ onClick: vi.fn() })
const ZoomOut = ({ children }: any) => children({ onClick: vi.fn() })
const CurrentScale = ({ children }: any) => children({ scale: 1.25 })

describe('PdfToolbar', () => {
  it('uses plain tinted toolbar groups (no nested glass) for compact controls', () => {
    const { container } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          onStartScreenshot={vi.fn()}
          onFullPageScreenshot={vi.fn()}
          autoSend={false}
          onToggleAutoSend={vi.fn()}
          panMode={false}
          onTogglePanMode={vi.fn()}
          currentPage={2}
          totalPages={8}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    expect(container.querySelectorAll('.bg-muted\\/40.rounded-lg.p-1\\.5')).toHaveLength(3)
    expect(container.querySelectorAll('.glass-tier-3')).toHaveLength(0)
  })

  it('renders pan mode button and handles toggle', () => {
    const onTogglePanMode = vi.fn()
    const { getByTestId, queryByLabelText } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          panMode={false}
          onTogglePanMode={onTogglePanMode}
          currentPage={1}
          totalPages={5}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    // Tools popup trigger button should no longer exist
    expect(queryByLabelText('pdf_tools')).not.toBeInTheDocument()

    // Pan mode button should exist
    const panButton = getByTestId('pan-mode-button')
    expect(panButton).toBeInTheDocument()
    expect(panButton).toHaveAttribute('aria-pressed', 'false')

    panButton.click()
    expect(onTogglePanMode).toHaveBeenCalledTimes(1)
  })

  it('reflects active pan mode state', () => {
    const { getByTestId } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          panMode
          onTogglePanMode={vi.fn()}
          currentPage={1}
          totalPages={5}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    const panButton = getByTestId('pan-mode-button')
    expect(panButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('defaults to viewer mode with mode toggle visible', () => {
    const { getByTestId, queryByTestId } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          panMode={false}
          onTogglePanMode={vi.fn()}
          currentPage={2}
          totalPages={61}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    expect(getByTestId('pan-mode-button')).toBeInTheDocument()
    expect(getByTestId('pdf-toolbar-mode-toggle')).toBeInTheDocument()
    expect(queryByTestId('pdf-ai-quick-bar')).not.toBeInTheDocument()
  })

  it('toggles to actions-only mode and back without touching right-click menu', () => {
    const { getByTestId, queryByTestId } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          onStartScreenshot={vi.fn()}
          onFullPageScreenshot={vi.fn()}
          onAddCurrentPageTextToAi={vi.fn()}
          onReload={vi.fn()}
          panMode={false}
          onTogglePanMode={vi.fn()}
          currentPage={2}
          totalPages={61}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    fireEvent.click(getByTestId('pdf-toolbar-mode-toggle'))

    expect(getByTestId('pdf-ai-quick-bar')).toBeInTheDocument()
    expect(getByTestId('pdf-quick-text-ai')).toBeInTheDocument()
    expect(getByTestId('pdf-quick-image-ai')).toBeInTheDocument()
    expect(getByTestId('pdf-quick-area-ai')).toBeInTheDocument()
    expect(getByTestId('pdf-quick-reload')).toBeInTheDocument()
    // actions modunda viewer kontrolleri gizlenir
    expect(queryByTestId('pan-mode-button')).not.toBeInTheDocument()
    // kompakt sayfa göstergesi görünür
    const indicator = getByTestId('pdf-actions-page-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveTextContent('2')
    expect(indicator).toHaveTextContent('61')

    fireEvent.click(getByTestId('pdf-toolbar-mode-toggle'))
    expect(queryByTestId('pdf-ai-quick-bar')).not.toBeInTheDocument()
    expect(getByTestId('pan-mode-button')).toBeInTheDocument()
  })

  it('wires quick-bar buttons to toolbar props', () => {
    const onAddCurrentPageTextToAi = vi.fn()
    const onFullPageScreenshot = vi.fn()
    const onStartScreenshot = vi.fn()
    const onReload = vi.fn()
    const { getByTestId } = render(
      <TooltipProvider>
        <PdfToolbar
          pdfFile={null}
          onStartScreenshot={onStartScreenshot}
          onFullPageScreenshot={onFullPageScreenshot}
          onAddCurrentPageTextToAi={onAddCurrentPageTextToAi}
          onReload={onReload}
          panMode={false}
          onTogglePanMode={vi.fn()}
          currentPage={2}
          totalPages={61}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          highlight={vi.fn()}
          clearHighlights={vi.fn()}
          ZoomIn={ZoomIn}
          ZoomOut={ZoomOut}
          CurrentScale={CurrentScale}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    fireEvent.click(getByTestId('pdf-toolbar-mode-toggle'))
    fireEvent.click(getByTestId('pdf-quick-text-ai'))
    fireEvent.click(getByTestId('pdf-quick-image-ai'))
    fireEvent.click(getByTestId('pdf-quick-area-ai'))
    fireEvent.click(getByTestId('pdf-quick-reload'))

    expect(onAddCurrentPageTextToAi).toHaveBeenCalledTimes(1)
    expect(onFullPageScreenshot).toHaveBeenCalledTimes(1)
    expect(onStartScreenshot).toHaveBeenCalledTimes(1)
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  // The search bar and the page navigation are asserted here because they are the
  // two things that must stay reachable on a viewer that owns its own state.
  describe('viewer with no legacy renderer branch', () => {
    interface NativeToolbarOverrides {
      highlight?: Mock<(keyword: string) => void>
      clearHighlights?: Mock<() => void>
    }

    function nativeToolbar(props: {
      pdfFile: { path: string; name: string } | null
      highlight: Mock<(keyword: string) => void>
      clearHighlights: Mock<() => void>
    }) {
      return (
        <TooltipProvider>
          <PdfToolbar
            pdfFile={props.pdfFile}
            onStartScreenshot={vi.fn()}
            onFullPageScreenshot={vi.fn()}
            onAddCurrentPageTextToAi={vi.fn()}
            onReload={vi.fn()}
            panMode={false}
            onTogglePanMode={vi.fn()}
            currentPage={2}
            totalPages={61}
            onPreviousPage={vi.fn()}
            onNextPage={vi.fn()}
            highlight={props.highlight}
            clearHighlights={props.clearHighlights}
            ZoomIn={ZoomIn}
            ZoomOut={ZoomOut}
            CurrentScale={CurrentScale}
            onJumpToPage={vi.fn()}
          />
        </TooltipProvider>
      )
    }

    /**
     * `setPdfFile` re-renders the same tree with a different file, which is what a
     * document switch is: the component is not remounted, so its effects — including
     * the pending search debounce — are exactly what has to cope.
     */
    function renderNativeToolbar(
      overrides: NativeToolbarOverrides = {},
      pdfFile: { path: string; name: string } | null = null
    ) {
      const props = {
        pdfFile,
        highlight: overrides.highlight ?? vi.fn(),
        clearHighlights: overrides.clearHighlights ?? vi.fn()
      }
      const view = render(nativeToolbar(props))
      return {
        ...view,
        setPdfFile: (next: { path: string; name: string } | null) => {
          props.pdfFile = next
          view.rerender(nativeToolbar(props))
        }
      }
    }

    it('reveals the search bar when the shared store opens it', async () => {
      const { getByTestId } = renderNativeToolbar()

      // `Ctrl+F` reaches this bar through `usePdfSearchStore`, with no renderer
      // branch: closed is closed, and one open() reveals exactly one input.
      act(() => usePdfSearchStore.setState({ isOpen: false }))
      await waitFor(() =>
        expect(screen.queryByPlaceholderText('search_placeholder')).not.toBeInTheDocument()
      )
      act(() => usePdfSearchStore.getState().open())

      expect(await screen.findByPlaceholderText('search_placeholder')).toBeInTheDocument()
      // Page navigation and zoom stay: they are backed by the viewer's own state.
      expect(getByTestId('pdf-toolbar-mode-toggle')).toBeInTheDocument()
    })

    it('keeps the capture actions live', () => {
      const { getByTestId } = renderNativeToolbar()

      fireEvent.click(getByTestId('pdf-toolbar-mode-toggle'))

      expect(getByTestId('pdf-quick-text-ai')).toBeEnabled()
      expect(getByTestId('pdf-quick-image-ai')).toBeEnabled()
      expect(getByTestId('pdf-quick-area-ai')).toBeEnabled()
      expect(getByTestId('pdf-quick-reload')).toBeEnabled()
    })

    it('clears the highlights when the search input is emptied', async () => {
      // The search bar's inline clear button empties the input through the same
      // callback typing uses, so the toolbar — not the bar — is what has to reach
      // `clearHighlights`. Without it the previous query's rectangles stay painted
      // under an empty box, because the search hook drops a query on an emptied
      // keyword and never repaints on its own.
      const highlight = vi.fn()
      const clearHighlights = vi.fn()
      renderNativeToolbar({ highlight, clearHighlights })

      const input = screen.getByPlaceholderText('search_placeholder')
      fireEvent.change(input, { target: { value: 'thermodynamics' } })
      await waitFor(() => expect(highlight).toHaveBeenCalledWith('thermodynamics'))
      expect(clearHighlights).not.toHaveBeenCalled()

      fireEvent.click(screen.getByLabelText('clear'))

      await waitFor(() => expect(clearHighlights).toHaveBeenCalledTimes(1))
      expect(highlight).toHaveBeenCalledTimes(1)
      expect(screen.getByPlaceholderText('search_placeholder')).toHaveValue('')
    })

    it('does not carry a pending search into the next document', async () => {
      // The debounce holds a keyword typed for the *previous* file. Clearing the
      // overlay on a file switch is not enough: left alive, the timer fires a few
      // hundred ms later and highlights the old document's term on the new
      // document's page.
      const highlight = vi.fn()
      const clearHighlights = vi.fn()
      const { setPdfFile } = renderNativeToolbar(
        { highlight, clearHighlights },
        { path: '/docs/first.pdf', name: 'first.pdf' }
      )

      fireEvent.change(screen.getByPlaceholderText('search_placeholder'), {
        target: { value: 'thermodynamics' }
      })
      // The 300 ms debounce has not elapsed, so nothing has been highlighted yet.
      expect(highlight).not.toHaveBeenCalled()

      setPdfFile({ path: '/docs/second.pdf', name: 'second.pdf' })
      await waitFor(() => expect(clearHighlights).toHaveBeenCalled())

      // Well past the debounce the pending timer would have fired in.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(highlight).not.toHaveBeenCalled()
    })
  })
})
