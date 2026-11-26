import { InlineSelector } from '@app/components/ui/inline-selector'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
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

function KeyboardHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <InlineSelector
      open={open}
      onClose={() => {
        setOpen(false)
        onClose()
      }}
      closeLabel="Close"
      trigger={
        <button type="button" onClick={() => setOpen(true)}>
          Trigger
        </button>
      }
    >
      <div role="listbox" aria-label="Options">
        <button type="button" role="option" aria-selected={false}>
          One
        </button>
        <button type="button" role="option" aria-selected={false}>
          Two
        </button>
        <button type="button" role="option" aria-selected={false}>
          Three
        </button>
      </div>
    </InlineSelector>
  )
}

describe('InlineSelector keyboard', () => {
  it('moves focus into the options and follows Arrow/Home/End', async () => {
    render(<KeyboardHarness onClose={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Trigger' })
    trigger.focus()
    fireEvent.click(trigger)

    const first = await screen.findByRole('option', { name: 'One' })
    await waitFor(() => expect(first).toHaveFocus())

    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Two' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('option', { name: 'Two' }), { key: 'End' })
    expect(screen.getByRole('option', { name: 'Three' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('option', { name: 'Three' }), { key: 'Home' })
    expect(screen.getByRole('option', { name: 'One' })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const onClose = vi.fn()
    render(<KeyboardHarness onClose={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Trigger' })
    trigger.focus()
    fireEvent.click(trigger)

    const first = await screen.findByRole('option', { name: 'One' })
    await waitFor(() => expect(first).toHaveFocus())

    fireEvent.keyDown(first, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'One' })).not.toBeInTheDocument()
    )
    expect(trigger).toHaveFocus()
  })
})
