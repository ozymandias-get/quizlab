import { useCallback, useRef, useEffect } from 'react'

interface UseAiItemDragOptions {
  modelKey: string
  setActiveDragItem: (key: string | null) => void
}

interface UseAiItemDragResult {
  isDraggingRef: React.MutableRefObject<boolean>
  handleDragStart: () => void
  handleDragEnd: () => void
}

export function useAiItemDrag({
  modelKey,
  setActiveDragItem
}: UseAiItemDragOptions): UseAiItemDragResult {
  const isDraggingRef = useRef(false)
  const dragEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearDragEndTimeout = useCallback(() => {
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current)
      dragEndTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearDragEndTimeout
  }, [clearDragEndTimeout])

  const handleDragStart = useCallback(() => {
    clearDragEndTimeout()
    isDraggingRef.current = true
    setActiveDragItem(modelKey)
  }, [clearDragEndTimeout, setActiveDragItem, modelKey])

  const handleDragEnd = useCallback(() => {
    clearDragEndTimeout()
    setActiveDragItem(null)
    dragEndTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false
      dragEndTimeoutRef.current = null
    }, 150)
  }, [clearDragEndTimeout, setActiveDragItem])

  return { isDraggingRef, handleDragStart, handleDragEnd }
}
