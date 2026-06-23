import PdfToolbar from '@features/pdf/ui/components/PdfToolbar'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const ZoomIn = ({ children }: any) => children({ onClick: vi.fn() })
const ZoomOut = ({ children }: any) => children({ onClick: vi.fn() })
const CurrentScale = ({ children }: any) => children({ scale: 1.25 })

describe('PdfToolbar', () => {
  it('uses tertiary glass toolbar groups for compact controls', () => {
    const { container } = render(
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
    )

    expect(container.querySelectorAll('.glass-tier-3.glass-tier-toolbar.p-1\\.5')).toHaveLength(3)
  })
})
