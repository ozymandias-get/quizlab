import PdfSearchBar from '@features/pdf/ui/components/PdfSearchBar'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const renderWithTooltip = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>)

describe('PdfSearchBar', () => {
  it('renders closed state with file name and triggers onToggle on click', () => {
    const onToggle = vi.fn()
    renderWithTooltip(
      <PdfSearchBar
        isOpen={false}
        onToggle={onToggle}
        keyword=""
        onKeywordChange={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
        fileName="SampleDocument.pdf"
      />
    )

    expect(screen.getByText('SampleDocument.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('SampleDocument.pdf'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('renders open search bar, handles input change and Enter search trigger', () => {
    const onKeywordChange = vi.fn()
    const onSearch = vi.fn()
    const onClear = vi.fn()

    renderWithTooltip(
      <PdfSearchBar
        isOpen
        onToggle={vi.fn()}
        keyword="cardiology"
        onKeywordChange={onKeywordChange}
        onSearch={onSearch}
        onClear={onClear}
      />
    )

    const input = screen.getByDisplayValue('cardiology')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'neurology' } })
    expect(onKeywordChange).toHaveBeenCalledWith('neurology')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSearch).toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClear).toHaveBeenCalled()
  })

  it('always shows the match counter, including 0/0', () => {
    const { rerender } = renderWithTooltip(
      <PdfSearchBar
        isOpen
        onToggle={vi.fn()}
        keyword="cardiology"
        onKeywordChange={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
        matchCount={3}
      />
    )

    expect(screen.getByTestId('pdf-search-match-count')).toHaveTextContent('1/3')
    expect(screen.getByDisplayValue('cardiology')).not.toHaveAttribute('aria-invalid', 'true')

    rerender(
      <TooltipProvider>
        <PdfSearchBar
          isOpen
          onToggle={vi.fn()}
          keyword="not-in-this-document"
          onKeywordChange={vi.fn()}
          onSearch={vi.fn()}
          onClear={vi.fn()}
          matchCount={0}
        />
      </TooltipProvider>
    )

    expect(screen.getByTestId('pdf-search-match-count')).toHaveTextContent('0/0')
    expect(screen.getByDisplayValue('not-in-this-document')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows 0/0 without marking an empty query invalid', () => {
    renderWithTooltip(
      <PdfSearchBar
        isOpen
        onToggle={vi.fn()}
        keyword="   "
        onKeywordChange={vi.fn()}
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByTestId('pdf-search-match-count')).toHaveTextContent('0/0')
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid', 'true')
  })
})
