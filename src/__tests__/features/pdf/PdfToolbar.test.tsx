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

interface PdfFileLike {
  path: string
  name: string
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

      await waitFor(() => expect(clearHighlights).toHaveBeenCalledTimes(1))
      expect(highlight).toHaveBeenCalledTimes(1)
      expect(screen.getByPlaceholderText('search_placeholder')).toHaveValue('')
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
  })
})
