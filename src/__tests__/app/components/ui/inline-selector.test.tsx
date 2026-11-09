import { InlineSelector } from '@app/components/ui/inline-selector'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function renderSelector(open: boolean) {
  return (
    <InlineSelector
      open={open}
      onClose={vi.fn()}
      closeLabel="Close"
      trigger={<button type="button">Trigger</button>}
    >
      <button type="button">Option</button>
    </InlineSelector>
  )
}

function menu() {
  return document.querySelector<HTMLElement>('[data-slot="menu-surface"]')
}

afterEach(() => vi.restoreAllMocks())

describe('InlineSelector placement', () => {
  it('opens below the trigger when there is room below', () => {
    const { rerender } = render(renderSelector(false))
    const anchor = screen.getByRole('button', { name: 'Trigger' }).parentElement!
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 30,
      left: 0,
      right: 80,
      width: 80,
      height: 20
    } as DOMRect)

    rerender(renderSelector(true))

    expect(menu()).toHaveStyle({ top: '38px' })
  })

  it('flips above the trigger near the bottom of the window', () => {
    const { rerender } = render(renderSelector(false))
    const anchor = screen.getByRole('button', { name: 'Trigger' }).parentElement!
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 720,
      left: 0,
      right: 80,
      width: 80,
      height: 20
    } as DOMRect)

    rerender(renderSelector(true))

    // 768px viewport, 300px menu, 8px margin.
    expect(menu()).toHaveStyle({ top: '392px' })
  })
})
