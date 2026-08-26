import { fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@app/components/ui/tooltip'

import { describe, expect, it, vi } from 'vitest'

import OcrButton from '@features/ocr/ui/OcrButton'
import OcrResultPanel from '@features/ocr/ui/OcrResultPanel'
import type { OcrPageResult } from '@features/ocr/types'

function wrap(ui: React.ReactNode) {
  return <TooltipProvider>{ui}</TooltipProvider>
}

const fakeResult: OcrPageResult = {
  pageNumber: 2,
  documentId: 'fp',
  markdown: '# Title\nHello **world**',
  plainText: 'Title Hello world',
  language: 'en',
  blocks: [{ text: 'Title', kind: 'heading' }],
  tables: [],
  formulas: [],
  engine: 'hybrid',
  engineVersion: '1.0.0',
  createdAt: Date.now(),
  config: { language: 'auto', quality: 'balanced', forceOcr: false },
  isNativeText: true,
  readingOrder: 'single-column'
}

describe('OcrButton', () => {
  it('renders and is clickable', () => {
    const onClick = vi.fn()
    render(wrap(<OcrButton onClick={onClick} currentPage={2} />))
    const btn = screen.getByTestId('ocr-button')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalled()
  })

  it('has aria-label from i18n', () => {
    render(wrap(<OcrButton onClick={vi.fn()} currentPage={1} />))
    const btn = screen.getByTestId('ocr-button')
    expect(btn.getAttribute('aria-label')).toBeTruthy()
  })
})

describe('OcrResultPanel', () => {
  it('shows rendered markdown', () => {
    render(
      wrap(
        <OcrResultPanel
          result={fakeResult}
          status="success"
          error={null}
          pageNumber={2}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      )
    )
    // Should show title via markdown renderer
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      wrap(
        <OcrResultPanel
          result={null}
          status="processing"
          error={null}
          pageNumber={1}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      )
    )
    // Should have panel
    expect(screen.getByTestId('ocr-result-panel')).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(
      wrap(
        <OcrResultPanel
          result={fakeResult}
          status="success"
          error={null}
          pageNumber={2}
          onClose={onClose}
          onRetry={vi.fn()}
        />
      )
    )
    fireEvent.click(screen.getByTestId('ocr-close-button'))
    expect(onClose).toHaveBeenCalled()
  })
})
