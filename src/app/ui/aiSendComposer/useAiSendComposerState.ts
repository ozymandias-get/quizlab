import { useState, useCallback } from 'react'
import type { AiDraftItem } from '@app/providers/ai/types'

interface UseAiSendComposerStateProps {
  items: AiDraftItem[]
  onSend: (params: { noteText?: string; forceAutoSend?: boolean }) => Promise<unknown>
}

export function useAiSendComposerState(_props: UseAiSendComposerStateProps) {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  void _props

  const clearNote = useCallback(() => {
    setNoteText('')
  }, [])

  return {
    noteText,
    setNoteText,
    isSubmitting,
    isDismissed,
    setIsSubmitting,
    setIsDismissed,
    clearNote
  }
}
