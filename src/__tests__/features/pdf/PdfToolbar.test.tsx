import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'
import { usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'

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

    expect(queryByLabelText('pdf_tools')).not.toBeInTheDocument()

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

  it('does not render AI quick-bar controls (new selection menu owns them)', () => {
    const { queryByTestId } = render(
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

    // Yeni akış: AI metin/görsel/alan butonları ve mod geçişi yok.
    expect(queryByTestId('pdf-ai-quick-bar')).not.toBeInTheDocument()
    expect(queryByTestId('pdf-toolbar-mode-toggle')).not.toBeInTheDocument()
    expect(queryByTestId('pdf-quick-text-ai')).not.toBeInTheDocument()
    expect(queryByTestId('pdf-quick-image-ai')).not.toBeInTheDocument()
    expect(queryByTestId('pdf-quick-area-ai')).not.toBeInTheDocument()
    // Pan korunur.
    expect(queryByTestId('pan-mode-button')).toBeInTheDocument()
  })

  it('keeps reload as an independent viewer control', () => {
    const onReload = vi.fn()
    const { getByTestId } = render(
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
          onReload={onReload}
        />
      </TooltipProvider>
    )

    fireEvent.click(getByTestId('pdf-toolbar-reload'))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

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
      renderNativeToolbar()

      act(() => usePdfSearchStore.setState({ isOpen: false }))
      await waitFor(() =>
        expect(screen.queryByPlaceholderText('search_placeholder')).not.toBeInTheDocument()
      )
      act(() => usePdfSearchStore.getState().open())

      expect(await screen.findByPlaceholderText('search_placeholder')).toBeInTheDocument()
    })

    it('clears the highlights when the search input is emptied', async () => {
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
      const highlight = vi.fn()
      const clearHighlights = vi.fn()
      const { setPdfFile } = renderNativeToolbar(
        { highlight, clearHighlights },
        { path: '/docs/first.pdf', name: 'first.pdf' }
      )

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
  })
})
