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
  it('floats in the app tree while no PDF panel slot exists', () => {
    render(
      <AiDraftLayer>{(placement) => <span data-testid="draft">{placement}</span>}</AiDraftLayer>
    )

    // PDF paneli yok: içerik yine de render edilir, taslak erişilebilir kalır.
    expect(screen.getByTestId('draft')).toHaveTextContent('floating')
  })

  it('portals into the PDF panel slot when one is registered', () => {
    const slot = makeSlot()
    registerDomSlot(AI_DRAFT_SLOT_ID, slot)

    render(
      <AiDraftLayer>{(placement) => <span data-testid="draft">{placement}</span>}</AiDraftLayer>
    )

    const draft = screen.getByTestId('draft')
    expect(draft).toHaveTextContent('inline')
    // Kontrol PDF panelinin içinde, viewport katmanında değil.
    expect(slot.contains(draft)).toBe(true)
  })

  it('moves back to the floating placement when the PDF panel unmounts', () => {
    const slot = makeSlot()
    registerDomSlot(AI_DRAFT_SLOT_ID, slot)

    const { rerender } = render(
      <AiDraftLayer>{(placement) => <span data-testid="draft">{placement}</span>}</AiDraftLayer>
    )
    expect(screen.getByTestId('draft')).toHaveTextContent('inline')

    unregisterDomSlot(AI_DRAFT_SLOT_ID, slot)
    rerender(
      <AiDraftLayer>{(placement) => <span data-testid="draft">{placement}</span>}</AiDraftLayer>
    )

    expect(screen.getByTestId('draft')).toHaveTextContent('floating')
  })
})
