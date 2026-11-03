import PdfZoomControls from '@features/pdf/ui/components/PdfZoomControls'

import { TooltipProvider } from '@shared/ui/components/primitives'

import { render, screen } from '@testing-library/react'
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
  it('shows the zoom level as read-only text, not a dead button', () => {
    render(
      <TooltipProvider>
        <PdfZoomControls ZoomIn={ZoomButton} ZoomOut={ZoomButton} CurrentScale={CurrentScale} />
      </TooltipProvider>
    )

    const percentage = screen.getByText('125%')
    expect(percentage.tagName).toBe('SPAN')
    expect(percentage.closest('button')).toBeNull()
  })
})
