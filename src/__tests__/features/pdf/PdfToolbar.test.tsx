import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'

import { TooltipProvider } from '@app/components/ui/tooltip'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

  it('renders pan mode button next to OCR button and handles toggle', () => {
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

    // OCR button should also be present
    expect(getByTestId('ocr-button')).toBeInTheDocument()

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
})
