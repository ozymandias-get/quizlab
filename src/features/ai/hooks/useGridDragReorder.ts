import { type DragEvent, type MutableRefObject, useCallback, useMemo, useRef } from 'react'

export interface GridDragReorderState {
  dragItemRef: MutableRefObject<string | null>
  handleDragEnd: () => void
  handleDragOver: (event: DragEvent, id: string) => void
  handleDragStart: (id: string) => void
  handleDrop: (event: DragEvent) => void
}

export function useGridDragReorder(
  order: string[],
  onReorder: (newOrder: string[]) => void
): GridDragReorderState {
  const dragItemRef = useRef<string | null>(null)
  const dragOverItemRef = useRef<string | null>(null)

  // Use refs to keep callback identities stable — without this, every
  // change to `order` or `onReorder` recreates `handleDrop`, which
  // cascades a new `GridDragReorderState` reference to all children
  // (AiHomeCardGrid → GridCard), breaking their memo guards.
  const orderRef = useRef(order)
  orderRef.current = order
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder

  const handleDragStart = useCallback((id: string) => {
    dragItemRef.current = id
  }, [])

  const handleDragOver = useCallback((event: DragEvent, id: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    dragOverItemRef.current = id
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const from = dragItemRef.current
      const to = dragOverItemRef.current

      if (!from || !to || from === to) {
        return
      }

      const currentOrder = orderRef.current
      const nextOrder = [...currentOrder]
      const fromIndex = nextOrder.indexOf(from)
      const toIndex = nextOrder.indexOf(to)

      if (fromIndex === -1 || toIndex === -1) {
        return
      }

      nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, from)
      onReorderRef.current(nextOrder)

      dragItemRef.current = null
      dragOverItemRef.current = null
    },
    [] // stable — reads latest `order` and `onReorder` from refs
  )

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null
    dragOverItemRef.current = null
  }, [])

  return useMemo(
    () => ({ dragItemRef, handleDragEnd, handleDragOver, handleDragStart, handleDrop }),
    [dragItemRef, handleDragEnd, handleDragOver, handleDragStart, handleDrop]
  )
}
