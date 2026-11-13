import {
  type DragEvent,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

export interface GridDragReorderState {
  dragItemRef: MutableRefObject<string | null>
  draggingId: string | null
  dragOverId: string | null
  handleDragEnd: () => void
  handleDragLeave: (event: DragEvent, id: string) => void
  handleDragOver: (event: DragEvent, id: string) => void
  handleDragStart: (id: string) => void
  handleDrop: (event: DragEvent) => void
  moveItem: (id: string, delta: -1 | 1, visibleOrder?: string[]) => void
}

export function useGridDragReorder(
  order: string[],
  onReorder: (newOrder: string[]) => void
): GridDragReorderState {
  const dragItemRef = useRef<string | null>(null)
  const dragOverItemRef = useRef<string | null>(null)
  // Ref mutations do not render. Cards use these state mirrors to dim the
  // dragged item and highlight the current drop target; refs stay synchronous.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Use refs to keep callback identities stable — without this, every
  // change to `order` or `onReorder` recreates `handleDrop`, which
  // cascades a new `GridDragReorderState` reference to all children
  // (AiHomeCardGrid → GridCard), breaking their memo guards.
  const orderRef = useRef(order)
  orderRef.current = order
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder

  const clearDragState = useCallback(() => {
    dragItemRef.current = null
    dragOverItemRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }, [])

  // If the dragged card or hovered target is removed from `order` mid-drag
  // (e.g. a filter/preference change unmounts the card before `dragend` fires),
  // clear the stale drag state so a future re-appearance doesn't stay dimmed.
  useEffect(() => {
    if (dragItemRef.current !== null && !order.includes(dragItemRef.current)) {
      clearDragState()
      return
    }
    if (dragOverItemRef.current !== null && !order.includes(dragOverItemRef.current)) {
      dragOverItemRef.current = null
      setDragOverId(null)
    }
  }, [order, clearDragState])

  const handleDragStart = useCallback((id: string) => {
    dragItemRef.current = id
    setDraggingId(id)
    // A new drag must not inherit the drop target of the previous one.
    dragOverItemRef.current = null
    setDragOverId(null)
  }, [])

  const handleDragOver = useCallback((event: DragEvent, id: string) => {
    const from = dragItemRef.current
    if (!from || !orderRef.current.includes(from) || !orderRef.current.includes(id)) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    dragOverItemRef.current = id
    const nextDropTarget = from !== id ? id : null
    setDragOverId((prev) => (prev === nextDropTarget ? prev : nextDropTarget))
  }, [])

  const handleDragLeave = useCallback((event: DragEvent, id: string) => {
    const currentTarget = event.currentTarget
    const relatedTarget = event.relatedTarget
    if (
      typeof Node !== 'undefined' &&
      currentTarget instanceof Node &&
      relatedTarget instanceof Node &&
      currentTarget.contains(relatedTarget)
    ) {
      return
    }
    if (dragOverItemRef.current === id) {
      dragOverItemRef.current = null
      setDragOverId((prev) => (prev === id ? null : prev))
    }
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent) => {
      const from = dragItemRef.current
      const to = dragOverItemRef.current
      // Every path clears the drag state, including the early returns.
      clearDragState()

      const currentOrder = orderRef.current
      if (!from || !currentOrder.includes(from)) {
        return
      }

      event.preventDefault()
      event.stopPropagation?.()

      if (!to || from === to) {
        return
      }

      const nextOrder = [...currentOrder]
      const fromIndex = nextOrder.indexOf(from)
      const toIndex = nextOrder.indexOf(to)

      if (fromIndex === -1 || toIndex === -1) {
        return
      }

      nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, from)
      onReorderRef.current(nextOrder)
    },
    [clearDragState] // stable — reads latest `order` and `onReorder` from refs
  )

  const handleDragEnd = useCallback(() => {
    clearDragState()
  }, [clearDragState])

  const moveItem = useCallback((id: string, delta: -1 | 1, visibleOrder?: string[]) => {
    const currentOrder = orderRef.current
    const navigationOrder = visibleOrder ?? currentOrder
    const visibleFromIndex = navigationOrder.indexOf(id)
    if (visibleFromIndex === -1) return
    const visibleToIndex = visibleFromIndex + delta
    if (visibleToIndex < 0 || visibleToIndex >= navigationOrder.length) return

    const targetId = navigationOrder[visibleToIndex]
    const fromIndex = currentOrder.indexOf(id)
    const toIndex = currentOrder.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

    const nextOrder = [...currentOrder]
    nextOrder.splice(fromIndex, 1)
    nextOrder.splice(toIndex, 0, id)
    onReorderRef.current(nextOrder)
  }, [])

  return useMemo(
    () => ({
      dragItemRef,
      draggingId,
      dragOverId,
      handleDragEnd,
      handleDragLeave,
      handleDragOver,
      handleDragStart,
      handleDrop,
      moveItem
    }),
    [
      dragItemRef,
      draggingId,
      dragOverId,
      handleDragEnd,
      handleDragLeave,
      handleDragOver,
      handleDragStart,
      handleDrop,
      moveItem
    ]
  )
}
