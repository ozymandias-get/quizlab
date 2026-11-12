import PdfTabItem from '@features/pdf/ui/components/PdfTabItem'

import { fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@shared/ui/components/primitives', async () => {
  const ReactModule = await import('react')
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>

  const TabPill = ReactModule.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean; withControls?: boolean }
  >(({ isActive: _isActive, withControls: _withControls, ...props }, ref) => (
    <button ref={ref} type="button" {...props} />
  ))

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
    TabPillIcon: PassThrough,
    TabPillLabel: PassThrough,
    Tooltip: PassThrough,
    TooltipContent: PassThrough,
    TooltipTrigger: PassThrough
  }
})

const TAB = { id: 'tab-1', file: null, kind: 'pdf' as const }

function renderItem(overrides: Partial<React.ComponentProps<typeof PdfTabItem>> = {}) {
  const onSetActiveTab = vi.fn()
  const onCloseTab = vi.fn()

  render(
    <PdfTabItem
      tab={TAB as never}
      isActive
      isDragging={false}
      dropSide={null}
      getTabLabel={() => 'Doc'}
      getTabIcon={() => null}
      tr={(key, fallback) => fallback ?? key}
      onSetActiveTab={onSetActiveTab}
      onCloseTab={onCloseTab}
      onOpenContextMenu={vi.fn()}
      {...overrides}
    />
  )

  return { onSetActiveTab, onCloseTab }
}

describe('PdfTabItem', () => {
  it('selects the tab on click', () => {
    const { onSetActiveTab } = renderItem()
    fireEvent.click(screen.getByLabelText('Doc'))
    expect(onSetActiveTab).toHaveBeenCalledWith('tab-1')
  })

  it('closes without selecting when the close control is pressed', () => {
    const { onSetActiveTab, onCloseTab } = renderItem()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onCloseTab).toHaveBeenCalledWith('tab-1')
    expect(onSetActiveTab).not.toHaveBeenCalled()
  })

  it('exposes the drag identity and the insertion marker for reordering', () => {
    renderItem({ dropSide: 'after' })
    const wrapper = screen.getByLabelText('Doc').closest('[data-tab-id]') as HTMLElement

    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('draggable', 'true')
    expect(wrapper).toHaveAttribute('data-tab-id', 'tab-1')
    expect(wrapper.className).toContain('after:bg-primary')
  })

  it('marks the pill being dragged', () => {
    renderItem({ isDragging: true })
    const wrapper = screen.getByLabelText('Doc').closest('[data-tab-id]') as HTMLElement
    expect(wrapper.className).toContain('opacity-45')
  })
})
