import type { Tab } from '@app/providers/ai-context'
import AiVisibleTabButton from '@features/ai/ui/aiTabStrip/AiVisibleTabButton'

import { fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  getAiIcon: () => null
}))

vi.mock('@shared/ui/components/primitives', async () => {
  const ReactModule = await import('react')
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>

  const TabPillContainer = ({
    isActive: _isActive,
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { isActive?: boolean }) => (
    <div {...props}>{children}</div>
  )

  const TabPillLabel = ReactModule.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { isActive?: boolean }
  >(({ isActive: _isActive, ...props }, ref) => <span ref={ref} {...props} />)

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
    TabPillContainer,
    TabPillIcon: PassThrough,
    TabPillLabel,
    Tooltip: PassThrough,
    TooltipContent: PassThrough,
    TooltipTrigger: PassThrough
  }
})

const TAB = { id: 'tab-1', modelId: 'chatgpt' } as Tab

function renderTab(overrides: Partial<React.ComponentProps<typeof AiVisibleTabButton>> = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()

  render(
    <AiVisibleTabButton
      tab={TAB}
      label="Original"
      isActive
      isDragging={false}
      dropSide={null}
      tr={(key, fallback) => fallback ?? key}
      onSelect={onSelect}
      onContextMenu={vi.fn()}
      onClose={onClose}
      {...overrides}
    />
  )

  return { onSelect, onClose }
}

describe('AiVisibleTabButton', () => {
  it('selects the tab on click', () => {
    const { onSelect } = renderTab()
    fireEvent.click(screen.getByLabelText('Original'))
    expect(onSelect).toHaveBeenCalledWith('tab-1')
  })

  it('closes without selecting when the close control is pressed', () => {
    const { onSelect, onClose } = renderTab()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledWith('tab-1')
    expect(onSelect).not.toHaveBeenCalled()
  })

  // The close control of an active tab is visible without hover, so its width
  // has to come out of the label's box at all times; otherwise it paints over
  // the label (a tab named "Gemini" used to show only its tail).
  it('reserves space for the always-visible close button on the active tab', () => {
    renderTab({ isActive: true })
    expect(screen.getByLabelText('Original').className).toContain('pr-[4.5rem]')
  })

  it('keeps the collapsed padding for an inactive tab until hover', () => {
    renderTab({ isActive: false })
    const className = screen.getByLabelText('Original').className
    expect(className).toContain('pr-3')
    expect(className.split(' ')).not.toContain('pr-[4.5rem]')
  })

  it('exposes the drag identity and the insertion marker for reordering', () => {
    renderTab({ dropSide: 'before' })
    const pill = screen.getByLabelText('Original')
    expect(pill).toHaveAttribute('draggable', 'true')
    expect(pill).toHaveAttribute('data-tab-id', 'tab-1')
    expect(pill.className).toContain('before:bg-primary')
  })
})
