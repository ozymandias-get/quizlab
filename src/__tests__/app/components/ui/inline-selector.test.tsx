import { InlineSelector } from '@app/components/ui/inline-selector'

import { fireEvent, render, screen } from '@testing-library/react'
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

  it('repositions while the window is resized', () => {
    const { rerender } = render(renderSelector(false))
    const anchor = screen.getByRole('button', { name: 'Trigger' }).parentElement!
    let rect = {
      top: 10,
      bottom: 30,
      left: 0,
      right: 80,
      width: 80,
      height: 20
    } as DOMRect
    vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => rect)

    rerender(renderSelector(true))
    expect(menu()).toHaveStyle({ top: '38px' })

    rect = {
      top: 700,
      bottom: 720,
      left: 0,
      right: 80,
      width: 80,
      height: 20
    } as DOMRect
    fireEvent(window, new Event('resize'))

    expect(menu()).toHaveStyle({ top: '392px' })
  })

  it('keeps the menu inside the right edge', () => {
    const { rerender } = render(renderSelector(false))
    const anchor = screen.getByRole('button', { name: 'Trigger' }).parentElement!
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 30,
      left: 900,
      right: 980,
      width: 80,
      height: 20
    } as DOMRect)

    rerender(renderSelector(true))

    // 1024px viewport - 240px fallback width - 8px margin.
    expect(menu()).toHaveStyle({ left: '776px' })
  })

  it('uses the viewport and scrolls when neither side has room', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(100)

    const { rerender } = render(renderSelector(false))
    const anchor = screen.getByRole('button', { name: 'Trigger' }).parentElement!
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      left: 0,
      right: 80,
      width: 80,
      height: 100
    } as DOMRect)

    rerender(renderSelector(true))

    expect(menu()).toHaveStyle({ top: '8px', maxHeight: '84px' })
    expect(menu()).toHaveClass('overflow-y-auto')
  })

  it('portals outside an overflow-hidden ancestor', () => {
    render(<div style={{ overflow: 'hidden' }}>{renderSelector(true)}</div>)

    expect(menu()?.parentElement).toBe(document.body)
  })

  it('keeps trigger focus when the menu closes', () => {
    const { rerender } = render(renderSelector(false))
    const trigger = screen.getByRole('button', { name: 'Trigger' })
    trigger.focus()

    rerender(renderSelector(true))
    rerender(renderSelector(false))

    expect(trigger).toHaveFocus()
  })
})
