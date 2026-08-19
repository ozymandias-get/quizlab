import PdfSearchBar from '@features/pdf/ui/components/PdfSearchBar'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('PdfSearchBar', () => {
  it('renders closed state with file name and triggers onToggle on click', () => {
    const onToggle = vi.fn()
    render(
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
    expect(screen.getByText('Ctrl+F')).toBeInTheDocument()

    fireEvent.click(screen.getByText('SampleDocument.pdf'))
    expect(onToggle).toHaveBeenCalled()
  })

  it('renders open search bar, handles input change and Enter search trigger', () => {
    const onKeywordChange = vi.fn()
    const onSearch = vi.fn()
    const onClear = vi.fn()

    render(
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
    expect(screen.getByText('Esc')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'neurology' } })
    expect(onKeywordChange).toHaveBeenCalledWith('neurology')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSearch).toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClear).toHaveBeenCalled()
  })
})
