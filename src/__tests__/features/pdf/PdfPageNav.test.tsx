import PdfPageNav from '@features/pdf/ui/components/PdfPageNav'

import { TooltipProvider } from '@shared/ui/components/primitives'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en' }
  })
}))

function renderNav(onJumpToPage = vi.fn()) {
  render(
    <TooltipProvider>
      <PdfPageNav
        currentPage={2}
        totalPages={61}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        onJumpToPage={onJumpToPage}
      />
    </TooltipProvider>
  )
  return { onJumpToPage }
}

describe('PdfPageNav', () => {
  it('keeps an out-of-range page input open and announces the accepted range', () => {
    const { onJumpToPage } = renderNav()

    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onJumpToPage).not.toHaveBeenCalled()
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('page_input_range')
  })

  it('jumps to a valid whole page and closes the input', () => {
    const { onJumpToPage } = renderNav()

    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onJumpToPage).toHaveBeenCalledWith(10)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('returns focus to the page button when Escape cancels the edit', () => {
    renderNav()

    const openButton = screen.getByRole('button', { name: /61/ })
    fireEvent.click(openButton)

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /61/ })).toHaveFocus()
  })

  it('commits a valid value on blur', () => {
    const { onJumpToPage } = renderNav()

    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.blur(input)

    expect(onJumpToPage).toHaveBeenCalledWith(7)
  })

  it('rejects non-numeric input instead of parsing its leading digits', () => {
    const { onJumpToPage } = renderNav()

    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onJumpToPage).not.toHaveBeenCalled()
    expect(input).toBeInTheDocument()
  })

  it('explains why an invalid value was reverted when the field loses focus', () => {
    const { onJumpToPage } = renderNav()

    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)

    expect(onJumpToPage).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('page_input_reverted')
  })

  it('cancels an open page edit when the document changes', () => {
    const onJumpToPage = vi.fn()
    const draw = (documentId: string) => (
      <TooltipProvider>
        <PdfPageNav
          currentPage={2}
          totalPages={61}
          documentId={documentId}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onJumpToPage={onJumpToPage}
        />
      </TooltipProvider>
    )

    const { rerender } = render(draw('document-a'))
    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    rerender(draw('document-b'))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(onJumpToPage).not.toHaveBeenCalled()
  })

  it('keeps an open page edit while navigating pages in the same document', () => {
    const draw = (currentPage: number) => (
      <TooltipProvider>
        <PdfPageNav
          currentPage={currentPage}
          totalPages={61}
          documentId="document-a"
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onJumpToPage={vi.fn()}
        />
      </TooltipProvider>
    )

    const { rerender } = render(draw(2))
    fireEvent.click(screen.getByRole('button', { name: /61/ }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } })

    rerender(draw(3))

    expect(screen.getByRole('textbox')).toHaveValue('12')
  })
})
