import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, type RefObject, useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'

interface MenuHarnessProps {
  isOpen: boolean
  triggerRef?: RefObject<HTMLElement | null>
  triggerIsWrapper?: boolean
}

function MenuHarness({ isOpen, triggerRef, triggerIsWrapper = false }: MenuHarnessProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const setMenuRef = useMenuKeyboardNavigation(menuRef, { onClose: () => {}, triggerRef })

  return (
    <div>
      <button type="button">Tab A</button>
      {triggerIsWrapper ? (
        <div
          ref={(el) => {
            if (triggerRef) triggerRef.current = el
          }}
        >
          <button type="button">Tab B</button>
        </div>
      ) : (
        <button
          type="button"
          ref={(el) => {
            if (triggerRef) triggerRef.current = el
          }}
        >
          Tab B
        </button>
      )}
      {isOpen && (
        <div ref={setMenuRef} role="menu">
          <button type="button" role="menuitem">
            Copy
          </button>
          <button type="button" role="menuitem">
            Paste
          </button>
        </div>
      )}
    </div>
  )
}

interface CloseableHarnessProps {
  triggerRef?: RefObject<HTMLElement | null>
}

function CloseableHarness({ triggerRef }: CloseableHarnessProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(true)
  const setMenuRef = useMenuKeyboardNavigation(menuRef, {
    onClose: () => setIsOpen(false),
    triggerRef
  })

  return (
    <div>
      <button type="button">Tab A</button>
      <button
        type="button"
        ref={(el) => {
          if (triggerRef) triggerRef.current = el
        }}
      >
        Tab B
      </button>
      {isOpen && (
        <div ref={setMenuRef} role="menu">
          <button type="button" role="menuitem" onClick={() => setIsOpen(false)}>
            Copy
          </button>
        </div>
      )}
    </div>
  )
}

describe('useMenuKeyboardNavigation', () => {
  it('restores focus to the right-clicked trigger on Escape even when focus was elsewhere', () => {
    const triggerRef = createRef<HTMLElement>()
    const { rerender } = render(<MenuHarness isOpen={false} triggerRef={triggerRef} />)
    screen.getByText('Tab A').focus()

    rerender(<MenuHarness isOpen triggerRef={triggerRef} />)
    const item = screen.getByRole('menuitem', { name: 'Copy' })
    expect(item).toHaveFocus()

    fireEvent.keyDown(item, { key: 'Escape' })
    expect(screen.getByText('Tab B')).toHaveFocus()
  })

  it('falls back to the previously focused element when no trigger is provided', () => {
    const { rerender } = render(<MenuHarness isOpen={false} />)
    screen.getByText('Tab A').focus()

    rerender(<MenuHarness isOpen />)
    const item = screen.getByRole('menuitem', { name: 'Copy' })

    fireEvent.keyDown(item, { key: 'Escape' })
    expect(screen.getByText('Tab A')).toHaveFocus()
  })

  it('falls back to the previously focused element when the trigger was removed from the DOM', () => {
    const triggerRef = createRef<HTMLElement>()
    const { rerender } = render(<MenuHarness isOpen={false} triggerRef={triggerRef} />)
    const tabB = screen.getByText('Tab B')
    screen.getByText('Tab A').focus()

    rerender(<MenuHarness isOpen triggerRef={triggerRef} />)
    tabB.remove()
    const item = screen.getByRole('menuitem', { name: 'Copy' })

    fireEvent.keyDown(item, { key: 'Escape' })
    expect(screen.getByText('Tab A')).toHaveFocus()
  })

  it('restores focus to the first focusable element inside a non-focusable trigger wrapper', () => {
    const triggerRef = createRef<HTMLElement>()
    const { rerender } = render(
      <MenuHarness isOpen={false} triggerRef={triggerRef} triggerIsWrapper />
    )
    screen.getByText('Tab A').focus()

    rerender(<MenuHarness isOpen triggerRef={triggerRef} triggerIsWrapper />)
    const item = screen.getByRole('menuitem', { name: 'Copy' })

    fireEvent.keyDown(item, { key: 'Escape' })
    expect(screen.getByText('Tab B')).toHaveFocus()
  })

  it('keeps ArrowDown on the last item and ArrowUp on the first without wrapping', () => {
    const { rerender } = render(<MenuHarness isOpen={false} />)
    rerender(<MenuHarness isOpen />)
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()
    fireEvent.keyDown(items[1], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()

    fireEvent.keyDown(items[1], { key: 'ArrowUp' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0], { key: 'ArrowUp' })
    expect(items[0]).toHaveFocus()
  })

  it('jumps to the first / last item with Home and End', () => {
    const { rerender } = render(<MenuHarness isOpen={false} />)
    rerender(<MenuHarness isOpen />)
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(items[1], { key: 'Home' })
    expect(items[0]).toHaveFocus()

    fireEvent.keyDown(items[0], { key: 'End' })
    expect(items[1]).toHaveFocus()
  })

  it('restores focus to the trigger when the menu unmounts and focus was lost', async () => {
    const triggerRef = createRef<HTMLElement>()
    render(<CloseableHarness triggerRef={triggerRef} />)
    expect(screen.getByRole('menuitem')).toHaveFocus()

    fireEvent.click(screen.getByRole('menuitem'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Tab B')).toHaveFocus())
  })

  it('does not steal focus when the menu unmounts after the user moved focus elsewhere', async () => {
    const triggerRef = createRef<HTMLElement>()
    render(<CloseableHarness triggerRef={triggerRef} />)
    const tabA = screen.getByText('Tab A')
    tabA.focus()

    fireEvent.click(screen.getByRole('menuitem'))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(tabA).toHaveFocus()
  })
})
