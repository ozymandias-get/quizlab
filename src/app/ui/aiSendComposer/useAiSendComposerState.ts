import { useCallback, useState } from 'react'

export function useAiSendComposerState() {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const clearNote = useCallback(() => {
    setNoteText('')
  }, [])

  return {
    noteText,
    setNoteText,
    isSubmitting,
    setIsSubmitting,
    clearNote
  }
}
