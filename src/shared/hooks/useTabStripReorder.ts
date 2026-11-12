import { type DragEvent, useCallback, useRef, useState } from 'react'

interface TabStripDropTarget {
  tabId: string
  /** True when the pointer is on the right half of the target tab. */
  placeAfter: boolean
}

interface UseTabStripReorderOptions {
  /** Called once on drop with the dragged tab, the tab it landed on and the side. */
  onReorder: (draggedId: string, targetId: string, placeAfter: boolean) => void
}

/** Attribute every draggable pill carries; the row handlers resolve it from the event. */
export const TAB_DRAG_ID_ATTR = 'data-tab-id'

function findTabElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest<HTMLElement>(`[${TAB_DRAG_ID_ATTR}]`)
}

/**
 * Drag-to-reorder for tab strips.
 *
 * The handlers live on the tablist row, not on every pill: drag events bubble,
 * so the row can resolve the pill from `data-tab-id` and the pills stay plain
 * memo-friendly children. HTML5 drag and drop is enough here — the strip only
 * moves an existing pill within its own list, so there is no need for pointer
 * capture, auto-scroll or a custom drag preview.
 *
 * The half of the target pill the pointer is over decides the insertion side,
 * which makes a short drag land exactly where the user let go instead of always
 * pushing the tab forward.
 */
export function useTabStripReorder({ onReorder }: UseTabStripReorderOptions) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TabStripDropTarget | null>(null)
  const draggedIdRef = useRef<string | null>(null)
  const dropTargetRef = useRef<TabStripDropTarget | null>(null)

  const reset = useCallback(() => {
    draggedIdRef.current = null
    dropTargetRef.current = null
    setDraggedId(null)
    setDropTarget(null)
  }, [])

  const handleDragStart = useCallback((event: DragEvent<HTMLElement>) => {
    const tabId = findTabElement(event.target)?.getAttribute(TAB_DRAG_ID_ATTR)
    if (!tabId) return
    draggedIdRef.current = tabId
    setDraggedId(tabId)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      // Some platforms refuse to start a drag without a payload.
      event.dataTransfer.setData('text/plain', tabId)
    }
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    const active = draggedIdRef.current
    if (!active) return
    const tabEl = findTabElement(event.target)
    if (!tabEl) {
      if (dropTargetRef.current) {
        dropTargetRef.current = null
        setDropTarget(null)
      }
      return
    }

    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

    const tabId = tabEl.getAttribute(TAB_DRAG_ID_ATTR) ?? ''
    if (!tabId || tabId === active) return
    const rect = tabEl.getBoundingClientRect()
    const placeAfter = event.clientX > rect.left + rect.width / 2
    const current = dropTargetRef.current
    if (current?.tabId === tabId && current.placeAfter === placeAfter) return
    const next = { tabId, placeAfter }
    dropTargetRef.current = next
    setDropTarget(next)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const active = draggedIdRef.current
      const target = dropTargetRef.current
      if (active && target && active !== target.tabId) {
        onReorder(active, target.tabId, target.placeAfter)
      }
      reset()
    },
    [onReorder, reset]
  )

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null
    if (related && event.currentTarget.contains(related)) return
    if (!dropTargetRef.current) return
    dropTargetRef.current = null
    setDropTarget(null)
  }, [])

  const rowDragHandlers = {
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragLeave: handleDragLeave,
    onDragEnd: reset
  }

  return { draggedId, dropTarget, rowDragHandlers }
}
