import PdfTabItem from '@features/pdf/ui/components/PdfTabItem'

import { fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@app/components/ui/input', async () => {
  const ReactModule = await import('react')
  return {
    Input: ReactModule.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
      (props, ref) => <input ref={ref} {...props} />
    )
  }
})

vi.mock('@shared/ui/components/primitives', async () => {
  const ReactModule = await import('react')
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>

  const TabPill = ReactModule.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean; withControls?: boolean }
  >(({ isActive: _isActive, withControls: _withControls, ...props }, ref) => (
    <button ref={ref} type="button" {...props} />
  ))

  const TabPillContainer = ReactModule.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { isActive?: boolean }
  >(({ isActive: _isActive, ...props }, ref) => <div ref={ref} {...props} />)

  const IconButton = ReactModule.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ))

  return {
    IconButton,
    TabPill,
    TabPillContainer,
    TabPillIcon: PassThrough,
    TabPillLabel: PassThrough,
    Tooltip: PassThrough,
    TooltipContent: PassThrough,
    TooltipTrigger: PassThrough
  }
})

const TAB = { id: 'tab-1', file: null, kind: 'pdf' as const }

function renderItem(overrides: Partial<React.ComponentProps<typeof PdfTabItem>> = {}) {
  const onBeginRename = vi.fn()
  const onSetActiveTab = vi.fn()

  render(
    <PdfTabItem
      tab={TAB as never}
      isActive
      isEditing={false}
      editingValue=""
      getTabLabel={() => 'Doc'}
      getTabIcon={() => null}
      tr={(key, fallback) => fallback ?? key}
      onSetActiveTab={onSetActiveTab}
      onCloseTab={vi.fn()}
      onBeginRename={onBeginRename}
      onOpenContextMenu={vi.fn()}
      onEditingValueChange={vi.fn()}
      onEditingBlur={vi.fn()}
      onEditingKeyDown={vi.fn()}
      {...overrides}
    />
  )

  return { onBeginRename, onSetActiveTab }
}

describe('PdfTabItem double-click rename', () => {
  it('does not rename when a rapid double-click only activates an inactive tab', () => {
    const onBeginRename = vi.fn()
    const onSetActiveTab = vi.fn()

    function Harness() {
      const [isActive, setIsActive] = React.useState(false)
      return (
        <PdfTabItem
          tab={TAB as never}
          isActive={isActive}
          isEditing={false}
          editingValue=""
          getTabLabel={() => 'Doc'}
          getTabIcon={() => null}
          tr={(key, fallback) => fallback ?? key}
          onSetActiveTab={(tabId) => {
            onSetActiveTab(tabId)
            setIsActive(true)
          }}
          onCloseTab={vi.fn()}
          onBeginRename={onBeginRename}
          onOpenContextMenu={vi.fn()}
          onEditingValueChange={vi.fn()}
          onEditingBlur={vi.fn()}
          onEditingKeyDown={vi.fn()}
        />
      )
    }

    render(<Harness />)
    const surface = screen.getByLabelText('Doc')

    fireEvent.click(surface)
    expect(onSetActiveTab).toHaveBeenCalledWith('tab-1')
    // The click re-rendered the tab as active. The second click of the same
    // gesture must still select, not open the rename input.
    fireEvent.doubleClick(surface)

    expect(onBeginRename).not.toHaveBeenCalled()
  })

  it('renames when the tab was already active', () => {
    const { onBeginRename } = renderItem({ isActive: true })
    const surface = screen.getByLabelText('Doc')

    fireEvent.doubleClick(surface)

    expect(onBeginRename).toHaveBeenCalledWith(TAB)
  })
})
