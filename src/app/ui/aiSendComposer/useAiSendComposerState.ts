import { useState, useCallback } from 'react'
import type { AiDraftItem } from '@app/providers/ai/types'

const DISMISS_AFTER_SUBMIT_MS = 320

interface UseAiSendComposerStateProps {
  items: AiDraftItem[]
  onSend: (params: { noteText?: string; forceAutoSend?: boolean }) => Promise<unknown>
}

/**
 * Hook to manage the internal state and submission logic of the AiSendComposer.
 */
export function useAiSendComposerState({ items, onSend }: UseAiSendComposerStateProps) {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClosingAfterSubmit, setIsClosingAfterSubmit] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const resetDismissState = useCallback((dismissTimer: NodeJS.Timeout | null) => {
    if (dismissTimer) {
      clearTimeout(dismissTimer)
    }
    setIsClosingAfterSubmit(false)
    setIsDismissed(false)
  }, [])

  const handleSubmit = useCallback(
    async (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => {
      if (isSubmitting || items.length === 0) {
        return
      }

      const forcedAutoSend = options?.forceAutoSend === true || options?.autoSend === true
      let dismissTimer: NodeJS.Timeout | null = null

      try {
        setIsSubmitting(true)
        setIsClosingAfterSubmit(true)
        dismissTimer = setTimeout(() => {
          setIsDismissed(true)
        }, DISMISS_AFTER_SUBMIT_MS)

        const result = await onSend({
          noteText: noteText.trim() || undefined,
          ...(forcedAutoSend ? { forceAutoSend: true } : {})
        })

        // Standardized success check
        const wasSuccessful =
          result && typeof result === 'object' && 'success' in result
            ? Boolean(result.success)
            : true

        if (wasSuccessful) {
          setNoteText('')
          return
        }

        resetDismissState(dismissTimer)
      } catch (error) {
        resetDismissState(dismissTimer)
        throw error // Re-throw to allow component level error handling if needed
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, items.length, noteText, onSend, resetDismissState]
  )

  const clearNote = useCallback(() => {
    setNoteText('')
  }, [])

  return {
    noteText,
    setNoteText,
    isSubmitting,
    isClosingAfterSubmit,
    isDismissed,
    handleSubmit,
    clearNote
  }
}
