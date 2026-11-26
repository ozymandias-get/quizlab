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

  // The close control either paints or is transparent, but its space is always
  // reserved. A `group-hover:pr-*` variant cannot reserve it: it matches
  // descendants of `.group`, never the pill itself, so the button painted over
  // the label on hover.
  it('reserves the close-button space on the active tab', () => {
    renderTab({ isActive: true })
    expect(screen.getByLabelText('Original').className.split(' ')).toContain('pr-10')
  })

  it('reserves the same space on an idle tab and never changes padding on hover', () => {
    renderTab({ isActive: false })
    const classes = screen.getByLabelText('Original').className.split(' ')

    expect(classes).toContain('pr-10')
    expect(classes).not.toContain('pr-3')
    expect(classes).not.toContain('pr-[4.5rem]')
    expect(classes.some((name) => name.startsWith('group-hover:pr-'))).toBe(false)
  })

  it('keeps only the active tab in the tab order', () => {
    renderTab({ isActive: true })
    expect(screen.getByLabelText('Original')).toHaveAttribute('tabindex', '0')
  })

  it('removes an idle tab from the tab order so the strip has one tab stop', () => {
    renderTab({ isActive: false })
    expect(screen.getByLabelText('Original')).toHaveAttribute('tabindex', '-1')
  })

  it('exposes the drag identity and the insertion marker for reordering', () => {
    renderTab({ dropSide: 'before' })
    const pill = screen.getByLabelText('Original')
    expect(pill).toHaveAttribute('draggable', 'true')
    expect(pill).toHaveAttribute('data-tab-id', 'tab-1')
    expect(pill.className).toContain('before:bg-primary')
  })
})
