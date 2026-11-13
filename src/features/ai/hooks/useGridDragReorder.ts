import {
  type DragEvent,
  type MutableRefObject,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'

export interface GridDragReorderState {
  dragItemRef: MutableRefObject<string | null>
  draggingId: string | null
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
  // Ref mutations do not render. Cards use this state mirror to dim the item
  // that is actually being dragged; the ref stays the synchronous drag source.
  const [draggingId, setDraggingId] = useState<string | null>(null)

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
    setDraggingId(id)
    // A new drag must not inherit the drop target of the previous one.
    dragOverItemRef.current = null
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
      // Every path clears the drag state, including the early returns.
      dragItemRef.current = null
      dragOverItemRef.current = null
      setDraggingId(null)

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
    },
    [] // stable — reads latest `order` and `onReorder` from refs
  )

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null
    dragOverItemRef.current = null
    setDraggingId(null)
  }, [])

  return useMemo(
    () => ({ dragItemRef, draggingId, handleDragEnd, handleDragOver, handleDragStart, handleDrop }),
    [dragItemRef, draggingId, handleDragEnd, handleDragOver, handleDragStart, handleDrop]
  )
}
