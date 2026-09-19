import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'

import { TooltipProvider } from '@app/components/ui/tooltip'
import { fireEvent, render } from '@testing-library/react'
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
})
