import PdfSelectionMenu from '@features/pdf/ui/components/PdfSelectionMenu'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('PdfSelectionMenu', () => {
  it('renders both actions at once with no extra AI icon step', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-draft')).toBeInTheDocument()
    expect(screen.getByTestId('pdf-selection-menu')).toBeInTheDocument()
  })

  it('fires direct send without touching the draft', () => {
    const onSendToAi = vi.fn()
    const onAddToDraft = vi.fn()
    render(
      <PdfSelectionMenu top={100} left={100} onSendToAi={onSendToAi} onAddToDraft={onAddToDraft} />
    )
    fireEvent.click(screen.getByTestId('pdf-selection-send'))
    expect(onSendToAi).toHaveBeenCalledTimes(1)
    expect(onAddToDraft).not.toHaveBeenCalled()
  })

  it('fires draft add without sending', () => {
    const onSendToAi = vi.fn()
    const onAddToDraft = vi.fn()
    render(
      <PdfSelectionMenu top={100} left={100} onSendToAi={onSendToAi} onAddToDraft={onAddToDraft} />
    )
    fireEvent.click(screen.getByTestId('pdf-selection-draft'))
    expect(onAddToDraft).toHaveBeenCalledTimes(1)
    expect(onSendToAi).not.toHaveBeenCalled()
  })

  it('shows inline added feedback with count and no gallery', () => {
    render(
      <PdfSelectionMenu
        top={100}
        left={100}
        feedback="added"
        addedCount={3}
        onSendToAi={vi.fn()}
        onAddToDraft={vi.fn()}
      />
    )
    expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-send-attachment-strip')).not.toBeInTheDocument()
  })

  it('is keyboard accessible (buttons focusable)', () => {
    render(<PdfSelectionMenu top={100} left={100} onSendToAi={vi.fn()} onAddToDraft={vi.fn()} />)
    expect(screen.getByTestId('pdf-selection-send').tagName).toBe('BUTTON')
    expect(screen.getByTestId('pdf-selection-draft').tagName).toBe('BUTTON')
  })
})
