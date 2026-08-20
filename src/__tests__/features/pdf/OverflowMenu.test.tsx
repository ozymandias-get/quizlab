import OverflowMenu from '@features/pdf/ui/components/OverflowMenu'
import type { PdfTab } from '@features/pdf/hooks/types'
import { TooltipProvider } from '@app/components/ui/tooltip'

import { fireEvent, render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

const tabs: PdfTab[] = [
  { id: 't1', file: null, title: 'First Tab' },
  { id: 't2', file: null, title: 'Second Tab' }
]

function renderMenu(props: Partial<React.ComponentProps<typeof OverflowMenu>> = {}) {
  const onSetActiveTab = vi.fn()
  const onCloseTab = vi.fn()
  const onOpenContextMenu = vi.fn()
  const tr = vi.fn((_key: string, fallback: string) => fallback)

  const utils = render(
    <TooltipProvider>
      <OverflowMenu
        overflowTabs={tabs}
        getTabLabel={(tab) => tab.title ?? 'Tab'}
        getTabIcon={() => <FileText />}
        tr={tr}
        onSetActiveTab={onSetActiveTab}
        onCloseTab={onCloseTab}
        onOpenContextMenu={onOpenContextMenu}
        {...props}
      />
    </TooltipProvider>
  )

  return { ...utils, onSetActiveTab, onCloseTab, onOpenContextMenu, tr }
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More tabs' }))
}

describe('OverflowMenu', () => {
  it('renders closed without a popover', () => {
    renderMenu()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens with dialog semantics and a labeled surface', () => {
    renderMenu()
    openMenu()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'More tabs')
    expect(screen.getByRole('button', { name: 'First Tab' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close tab' })).toHaveLength(2)
  })

  it('focuses the first tab button when opened', () => {
    renderMenu()
    openMenu()
    expect(screen.getByRole('button', { name: 'First Tab' })).toHaveFocus()
  })

  it('selects a tab and closes on click', () => {
    const { onSetActiveTab } = renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Second Tab' }))
    expect(onSetActiveTab).toHaveBeenCalledWith('t2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes a tab and closes the popover', () => {
    const { onCloseTab } = renderMenu()
    openMenu()
    const closeButtons = screen.getAllByRole('button', { name: 'Close tab' })
    fireEvent.click(closeButtons[0])
    expect(onCloseTab).toHaveBeenCalledWith('t1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes with Escape and restores focus to the trigger', () => {
    renderMenu()
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More tabs' })).toHaveFocus()
  })

  it('keeps tab buttons keyboard-reachable', () => {
    renderMenu()
    openMenu()
    const firstTab = screen.getByRole('button', { name: 'First Tab' })
    const closeButtons = screen.getAllByRole('button', { name: 'Close tab' })
    expect(firstTab).toHaveAttribute('type', 'button')
    expect(closeButtons[0]).toHaveAttribute('type', 'button')
    expect(firstTab).not.toBeDisabled()
    firstTab.focus()
    expect(firstTab).toHaveFocus()
  })
})
