import { isSupportedDocumentFileName } from '@shared-core/constants/documentFormats'

import { Logger } from '@shared/lib/logger'

import { type DragEvent, type RefObject, useCallback, useMemo, useRef, useState } from 'react'

interface DragDropReturn {
  isDragOver: boolean
  containerRef: RefObject<HTMLDivElement | null>
  dragHandlers: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
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

    const related = e.relatedTarget as Node | null
    if (containerRef.current && related && containerRef.current.contains(related)) {
      return
    }

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

      const files = [...e.dataTransfer.files]
      // Multi-format ingestion: DOCX, PPTX, HTML, Markdown ve taranmış görseller dahil
      const supportedFile = files.find((file) => isSupportedDocumentFileName(file.name))

      if (!supportedFile) return

      try {
        const fileWithPath = supportedFile as File & { path?: string }
        const filePath = fileWithPath.path

        if (!filePath) {
          Logger.warn('[DragDrop] File has no path')
          return
        }

        onFileReceived(supportedFile)
      } catch (error) {
        Logger.error('[DragDrop] Error processing drop:', error)
      }
    },
    [onFileReceived]
  )

  const dragHandlers = useMemo(
    () => ({
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }),
    [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]
  )

  return {
    isDragOver,
    containerRef,
    dragHandlers
  }
}
