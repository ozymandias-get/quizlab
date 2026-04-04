import { useCallback, useRef, type DragEvent, type MutableRefObject } from 'react'

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

      const nextOrder = [...order]
      const fromIndex = nextOrder.indexOf(from)
      const toIndex = nextOrder.indexOf(to)

      if (fromIndex === -1 || toIndex === -1) {
        return
      }

      nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, from)
      onReorder(nextOrder)

      dragItemRef.current = null
      dragOverItemRef.current = null
    },
    [onReorder, order]
  )

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null
    dragOverItemRef.current = null
  }, [])

  return { dragItemRef, handleDragEnd, handleDragOver, handleDragStart, handleDrop }
}
