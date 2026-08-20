import ContextMenu, {
  type MenuItem as ContextMenuItem
} from '@features/pdf/ui/components/ContextMenu'

import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

const defaultItems: ContextMenuItem[] = [
  { label: 'Copy', onClick: vi.fn() },
  { label: 'Paste', onClick: vi.fn() },
  { label: '---', separator: true, onClick: vi.fn() },
  { label: 'Disabled', onClick: vi.fn(), disabled: true },
  { label: 'Delete', onClick: vi.fn(), danger: true }
]

function Harness({ items, open = true }: { items: ContextMenuItem[]; open?: boolean }) {
  const [isOpen, setIsOpen] = useState(open)
  useEffect(() => {
    setIsOpen(open)
  }, [open])
  return (
    <div>
      <button type="button">Opener</button>
      {isOpen && <ContextMenu x={10} y={10} items={items} onClose={() => setIsOpen(false)} />}
    </div>
  )
}

function getMenuItems() {
  return screen.getAllByRole('menuitem')
}

function pressKey(target: Element, key: string) {
  fireEvent.keyDown(target, { key })
}

describe('ContextMenu', () => {
  it('renders items with menu semantics', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(getMenuItems()).toHaveLength(4)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('focuses the first enabled item on open', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    expect(getMenuItems()[0]).toHaveFocus()
  })

  it('moves focus down with ArrowDown', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    pressKey(getMenuItems()[0], 'ArrowDown')
    expect(getMenuItems()[1]).toHaveFocus()
  })

  it('moves focus up with ArrowUp', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    pressKey(getMenuItems()[1], 'ArrowUp')
    expect(getMenuItems()[0]).toHaveFocus()
  })

  it('stays at the last item with ArrowDown', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    getMenuItems()[3].focus()
    pressKey(getMenuItems()[3], 'ArrowDown')
    expect(getMenuItems()[3]).toHaveFocus()
  })

  it('stays at the first item with ArrowUp', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    getMenuItems()[0].focus()
    pressKey(getMenuItems()[0], 'ArrowUp')
    expect(getMenuItems()[0]).toHaveFocus()
  })

  it('jumps to the first item with Home', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    pressKey(getMenuItems()[3], 'Home')
    expect(getMenuItems()[0]).toHaveFocus()
  })

  it('jumps to the last item with End', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    pressKey(getMenuItems()[0], 'End')
    expect(getMenuItems()[3]).toHaveFocus()
  })

  it('skips disabled items during keyboard navigation', () => {
    render(<ContextMenu x={10} y={10} items={defaultItems} onClose={vi.fn()} />)
    pressKey(getMenuItems()[0], 'ArrowDown')
    pressKey(getMenuItems()[1], 'ArrowDown')
    expect(getMenuItems()[3]).toHaveFocus()
  })

  it('activates the focused item on click and closes', () => {
    const onClick = vi.fn()
    const items: ContextMenuItem[] = [
      { label: 'Copy', onClick },
      { label: 'Paste', onClick: vi.fn() }
    ]
    render(<ContextMenu x={10} y={10} items={items} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not activate disabled items on click', () => {
    const onClick = vi.fn()
    const items: ContextMenuItem[] = [{ label: 'Disabled', onClick, disabled: true }]
    render(<ContextMenu x={10} y={10} items={items} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disabled' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('closes and restores focus to the opener on Escape', () => {
    const { rerender } = render(<Harness items={defaultItems} open={false} />)
    const opener = screen.getByText('Opener')
    opener.focus()

    rerender(<Harness items={defaultItems} open />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(opener).not.toHaveFocus()

    pressKey(getMenuItems()[0], 'Escape')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
