import { useState, useCallback } from 'react'

export function useAiSendComposerState() {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

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
