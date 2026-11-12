import { TAB_DRAG_ID_ATTR, useTabStripReorder } from '@shared/hooks'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

interface HarnessProps {
  onReorder: (draggedId: string, targetId: string, placeAfter: boolean) => void
}

function Harness({ onReorder }: HarnessProps) {
  const { draggedId, dropTarget, rowDragHandlers } = useTabStripReorder({ onReorder })

  return (
    <div role="tablist" {...rowDragHandlers}>
      {['a', 'b', 'c'].map((id) => (
        <div
          key={id}
          data-testid={`tab-${id}`}
          data-tab-id={id}
          draggable
          aria-label={id}
          className={[
            draggedId === id ? 'is-dragging' : '',
            dropTarget?.tabId === id ? (dropTarget.placeAfter ? 'drop-after' : 'drop-before') : ''
          ].join(' ')}
        />
      ))}
    </div>
  )
}

function drag(from: string, to: string, clientX: number) {
  const source = screen.getByTestId(`tab-${from}`)
  const target = screen.getByTestId(`tab-${to}`)
  target.getBoundingClientRect = () =>
    ({ left: 0, width: 100, top: 0, height: 24, right: 100, bottom: 24, x: 0, y: 0 }) as DOMRect

  fireEvent.dragStart(source)
  // jsdom has no DragEvent constructor that keeps mouse coordinates, so the
  // dragover is dispatched as a MouseEvent with the dragover type.
  target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX }))
  fireEvent.drop(target)
}

describe('useTabStripReorder', () => {
  it('resolves the dragged pill from the row handlers', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    fireEvent.dragStart(screen.getByTestId('tab-a'))

    expect(screen.getByTestId('tab-a')).toHaveClass('is-dragging')
    expect(screen.getByTestId('tab-a')).toHaveAttribute(TAB_DRAG_ID_ATTR, 'a')
  })

  it('drops after the target when the pointer is on its right half', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    drag('a', 'c', 80)

    expect(onReorder).toHaveBeenCalledWith('a', 'c', true)
  })

  it('drops before the target when the pointer is on its left half', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    drag('c', 'a', 20)

    expect(onReorder).toHaveBeenCalledWith('c', 'a', false)
  })

  it('clears the drag state after the drop', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    drag('a', 'b', 80)

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('tab-a').className).not.toContain('is-dragging')
  })
})
