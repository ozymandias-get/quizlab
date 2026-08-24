import { useCallback } from 'react'

import { type HighlightColor, useReaderAnnotationStore } from '../store/readerAnnotationStore'

export function useReaderAnnotations(documentId: string, blockId: string) {
  const highlights = useReaderAnnotationStore((s) =>
    s.highlights.filter((h) => h.blockId === blockId && h.documentId === documentId)
  )
  const notes = useReaderAnnotationStore((s) =>
    s.notes.filter((n) => n.blockId === blockId && n.documentId === documentId)
  )
  const addHighlight = useReaderAnnotationStore((s) => s.addHighlight)
  const removeHighlight = useReaderAnnotationStore((s) => s.removeHighlight)
  const removeHighlightsForBlock = useReaderAnnotationStore((s) => s.removeHighlightsForBlock)
  const addNote = useReaderAnnotationStore((s) => s.addNote)
  const updateNote = useReaderAnnotationStore((s) => s.updateNote)
  const removeNote = useReaderAnnotationStore((s) => s.removeNote)

  const highlightBlock = useCallback(
    (color: HighlightColor = 'yellow', text?: string) => {
      return addHighlight({ blockId, documentId, color, text })
    },
    [addHighlight, blockId, documentId]
  )

  const clearHighlights = useCallback(() => {
    removeHighlightsForBlock(blockId)
  }, [removeHighlightsForBlock, blockId])

  const createNote = useCallback(
    (text: string, pageNumber: number) => {
      return addNote({ blockId, documentId, text, pageNumber })
    },
    [addNote, blockId, documentId]
  )

  return {
    highlights,
    notes,
    highlightBlock,
    removeHighlight,
    clearHighlights,
    createNote,
    updateNote,
    removeNote
  }
}
