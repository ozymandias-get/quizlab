import PdfZoomControls from '@features/pdf/ui/components/PdfZoomControls'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const ZoomButton = ({
  children
}: {
  children: (props: { onClick: () => void }) => React.ReactNode
}) => children({ onClick: vi.fn() })

const CurrentScale = ({ children }: { children: (props: { scale: number }) => React.ReactNode }) =>
  children({ scale: 1.25 })

describe('PdfZoomControls', () => {
  it('opens the zoom preset popover from the percentage badge', () => {
    render(
      <TooltipProvider>
        <PdfZoomControls ZoomIn={ZoomButton} ZoomOut={ZoomButton} CurrentScale={CurrentScale} />
      </TooltipProvider>
    )

    const percentage = screen.getByRole('button', { name: 'zoom_presets' })
    expect(percentage).toHaveTextContent('125%')

    fireEvent.click(percentage)
    expect(screen.getByRole('button', { name: 'fit_page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fit_width' })).toBeInTheDocument()
  })
})
