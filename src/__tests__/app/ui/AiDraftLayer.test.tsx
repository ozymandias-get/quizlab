import { AiDraftLayer } from '@app/ui/AiDraftLayer'
import { AI_DRAFT_SLOT_ID } from '@features/pdf'
import { registerDomSlot, unregisterDomSlot } from '@shared/lib/domSlot'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

function makeSlot(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AiDraftLayer', () => {
  it('renders nothing when no PDF slot exists and the draft is empty', () => {
    render(
      <AiDraftLayer hasContent={false}>
        {(placement) => <span data-testid="draft">{placement}</span>}
      </AiDraftLayer>
    )

    // PDF ekleme ekranında yüzen bir "AI Taslağı" kutusu gösterilmez.
    expect(screen.queryByTestId('draft')).not.toBeInTheDocument()
  })

  it('floats in the app tree when the PDF panel is gone but the draft has content', () => {
    render(
      <AiDraftLayer hasContent>
        {(placement) => <span data-testid="draft">{placement}</span>}
      </AiDraftLayer>
    )

    // PDF paneli yok ama içerik var: toplanan taslak erişilemez olmaz.
    expect(screen.getByTestId('draft')).toHaveTextContent('floating')
  })

  it('portals into the PDF panel slot when one is registered', () => {
    const slot = makeSlot()
    registerDomSlot(AI_DRAFT_SLOT_ID, slot)

    render(
      <AiDraftLayer hasContent={false}>
        {(placement) => <span data-testid="draft">{placement}</span>}
      </AiDraftLayer>
    )

    const draft = screen.getByTestId('draft')
    expect(draft).toHaveTextContent('inline')
    // Kontrol PDF panelinin içinde, viewport katmanında değil.
    expect(slot.contains(draft)).toBe(true)
  })

  it('falls back to floating only for a non-empty draft when the PDF panel unmounts', () => {
    const slot = makeSlot()
    registerDomSlot(AI_DRAFT_SLOT_ID, slot)

    const view = (hasContent: boolean) => (
      <AiDraftLayer hasContent={hasContent}>
        {(placement) => <span data-testid="draft">{placement}</span>}
      </AiDraftLayer>
    )

    const { rerender } = render(view(true))
    expect(screen.getByTestId('draft')).toHaveTextContent('inline')

    unregisterDomSlot(AI_DRAFT_SLOT_ID, slot)
    rerender(view(true))
    expect(screen.getByTestId('draft')).toHaveTextContent('floating')

    // Taslak da boşalınca kontrol tamamen kaybolur.
    rerender(view(false))
    expect(screen.queryByTestId('draft')).not.toBeInTheDocument()
  })
})
