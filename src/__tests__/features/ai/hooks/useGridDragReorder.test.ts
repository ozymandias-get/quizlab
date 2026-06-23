/**
 * Tests for useGridDragReorder hook — pure drag-and-drop reorder logic
 * used by the AI models grid. Critical for UX: dropped items should
 * land in the right spot.
 */
import { act, renderHook } from '@testing-library/react'
import type { DragEvent as ReactDragEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useGridDragReorder } from '../../../../features/ai/hooks/useGridDragReorder'

// Build a minimal React synthetic DragEvent-like object. The hook only
// touches `preventDefault()` and `dataTransfer.dropEffect`, so a partial
// mock is enough. The `as unknown as React.DragEvent` cast sidesteps the
// React 19 / DOM DragEvent type drift that would otherwise require
// importing the full synthetic-event shim.
function makeDragEvent(overrides: Partial<ReactDragEvent> = {}): ReactDragEvent {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { dropEffect: '' } as unknown as DataTransfer,
    ...overrides
  } as unknown as ReactDragEvent
}

describe('useGridDragReorder', () => {
  it('exposes a ref + 4 handlers', () => {
    const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], vi.fn()))
    expect(result.current.dragItemRef).toBeDefined()
    expect(typeof result.current.handleDragStart).toBe('function')
    expect(typeof result.current.handleDragOver).toBe('function')
    expect(typeof result.current.handleDrop).toBe('function')
    expect(typeof result.current.handleDragEnd).toBe('function')
  })

  describe('handleDragStart', () => {
    it('stores the dragged item id in the ref', () => {
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], vi.fn()))
      act(() => {
        result.current.handleDragStart('a')
      })
      expect(result.current.dragItemRef.current).toBe('a')
    })
  })

  describe('handleDragOver', () => {
    it('calls preventDefault and sets dropEffect to "move"', () => {
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], vi.fn()))
      const event = makeDragEvent()
      act(() => {
        result.current.handleDragOver(event, 'b')
      })
      expect(event.preventDefault).toHaveBeenCalled()
      expect((event.dataTransfer as any).dropEffect).toBe('move')
    })
  })

  describe('handleDrop', () => {
    it('reorders items: moves "a" to where "c" is', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'c')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      // a is removed from index 0, then inserted at index 2 (where c was)
      expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
    })

    it('clears refs after a successful drop', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'b')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(result.current.dragItemRef.current).toBeNull()
    })

    it('does nothing when from === to', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'a')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(onReorder).not.toHaveBeenCalled()
    })

    it('does nothing when dragOver was not set', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(onReorder).not.toHaveBeenCalled()
    })

    it('does nothing when dragStart was not called', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], onReorder))

      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'c')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(onReorder).not.toHaveBeenCalled()
    })

    it('ignores ids that are not in the order array', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'unknown-id')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(onReorder).not.toHaveBeenCalled()
    })

    it('moves an item earlier in the list', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a', 'b', 'c', 'd'], onReorder))

      act(() => {
        result.current.handleDragStart('d')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'b')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      // d removed from index 3, inserted at index 1 (where b was)
      expect(onReorder).toHaveBeenCalledWith(['a', 'd', 'b', 'c'])
    })

    it('moves a single-item list (no-op)', () => {
      const onReorder = vi.fn()
      const { result } = renderHook(() => useGridDragReorder(['a'], onReorder))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'a')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      expect(onReorder).not.toHaveBeenCalled()
    })
  })

  describe('handleDragEnd', () => {
    it('clears refs on drag end', () => {
      const { result } = renderHook(() => useGridDragReorder(['a', 'b'], vi.fn()))

      act(() => {
        result.current.handleDragStart('a')
      })
      act(() => {
        result.current.handleDragEnd()
      })
      expect(result.current.dragItemRef.current).toBeNull()
    })
  })

  describe('order changes', () => {
    it('uses the latest order passed in (after re-render)', () => {
      const onReorder = vi.fn()
      const initial: string[] = ['a', 'b', 'c']
      const { result, rerender } = renderHook(({ order }) => useGridDragReorder(order, onReorder), {
        initialProps: { order: initial }
      })

      // Change the order
      const newOrder = ['c', 'a', 'b']
      rerender({ order: newOrder })

      act(() => {
        result.current.handleDragStart('c')
      })
      act(() => {
        result.current.handleDragOver(makeDragEvent(), 'b')
      })
      act(() => {
        result.current.handleDrop(makeDragEvent())
      })

      // Now operating on the new order
      // c is removed from index 0, then inserted at index 2
      expect(onReorder).toHaveBeenCalledWith(['a', 'b', 'c'])
    })
  })
})
