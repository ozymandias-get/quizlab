import { Dialog } from '@app/components/ui/dialog'
import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

function DialogWithSelect({ onClose }: { onClose: () => void }) {
  return (
    <Dialog isOpen onClose={onClose} size="sm" ariaLabelledBy="dialog-with-select-title">
      <h2 id="dialog-with-select-title">Dialog</h2>
      <Select defaultValue="a">
        <SelectTrigger aria-label="Pick a value">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>
    </Dialog>
  )
}

describe('dialog Escape ownership with a real Radix Select', () => {
  it('closes only the select first, then the dialog', async () => {
    const onClose = vi.fn()
    render(<DialogWithSelect onClose={onClose} />)

    const trigger = screen.getByRole('combobox', { name: 'Pick a value' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const listbox = await screen.findByRole('listbox')
    // Radix moves focus into the portalled content; wait for the real focused
    // layer before pressing Escape, as a user would.
    await waitFor(() => expect(listbox.contains(document.activeElement)).toBe(true))

    fireEvent.keyDown(document.activeElement ?? listbox, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

function DialogWithContextMenu({ onClose }: { onClose: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const setMenuRef = useMenuKeyboardNavigation(menuRef, {
    onClose: () => setMenuOpen(false),
    triggerRef
  })

  return (
    <Dialog isOpen onClose={onClose} size="sm" ariaLabelledBy="dialog-with-menu-title">
      <h2 id="dialog-with-menu-title">Dialog</h2>
      <button ref={triggerRef} type="button" onClick={() => setMenuOpen(true)}>
        open-menu
      </button>
      {menuOpen && (
        <MenuSurface ref={setMenuRef} className="relative mt-2">
          <MenuItem>menu-item</MenuItem>
        </MenuSurface>
      )}
    </Dialog>
  )
}

describe('dialog Escape ownership with a context menu', () => {
  it('lets the menu consume the first Escape and the dialog the second', async () => {
    const onClose = vi.fn()
    render(<DialogWithContextMenu onClose={onClose} />)

    const opener = screen.getByRole('button', { name: 'open-menu' })
    await waitFor(() => expect(opener).toHaveFocus())
    fireEvent.click(opener)

    const item = await screen.findByRole('menuitem', { name: 'menu-item' })
    await waitFor(() => expect(item).toHaveFocus())

    fireEvent.keyDown(item, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    expect(opener).toHaveFocus()

    fireEvent.keyDown(opener, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
