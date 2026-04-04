import { useState, useCallback, useRef, type DragEvent, type RefObject } from 'react'
import { Logger } from '@shared/lib/logger'

interface DragDropReturn {
  isDragOver: boolean
  containerRef: RefObject<HTMLDivElement | null>
  dragHandlers: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
  resetDragState: () => void
}

/**
 * Handle external file drag & drop.
 * Simpler version of useExternalDragDrop that handles single file open
 */
export function useSharedDragDrop(onFileReceived: (file: File) => void): DragDropReturn {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!e.dataTransfer.types.includes('Files')) return

    dragCounterRef.current++
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current--

    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      dragCounterRef.current = 0
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const pdfFile = files.find((file) => file.name.toLowerCase().endsWith('.pdf'))

      if (!pdfFile) return

      try {
        const fileWithPath = pdfFile as File & { path?: string }
        const filePath = fileWithPath.path

        if (!filePath) {
          Logger.warn('[DragDrop] File has no path')
          return
        }

        onFileReceived(pdfFile)
      } catch (error) {
        Logger.error('[DragDrop] Error processing drop:', error)
      }
    },
    [onFileReceived]
  )

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0
    setIsDragOver(false)
  }, [])

  return {
    isDragOver,
    containerRef,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    },
    resetDragState
  }
}
