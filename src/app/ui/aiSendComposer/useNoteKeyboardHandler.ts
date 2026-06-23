import type { KeyboardEvent } from 'react'
import { useCallback } from 'react'

interface UseNoteKeyboardHandlerOptions {
  hasNoteText: boolean
  isSubmitting: boolean
  totalItems: number
  onNoteTextChange: (value: string) => void
  onSubmit: (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => void
}

export function useNoteKeyboardHandler({
  hasNoteText,
  isSubmitting,
  totalItems,
  onNoteTextChange,
  onSubmit
}: UseNoteKeyboardHandlerOptions) {
  return useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) {
        return
      }
      if (event.key !== 'Enter') {
        return
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const ta = event.currentTarget
        const start = ta.selectionStart ?? 0
        const end = ta.selectionEnd ?? 0
        const v = ta.value
        const next = `${v.slice(0, start)}\n${v.slice(end)}`
        onNoteTextChange(next)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 1
        })
        return
      }

      if (isSubmitting) {
        event.preventDefault()
        return
      }

      if (totalItems === 0) {
        return
      }

      event.preventDefault()

      if (hasNoteText) {
        if (event.shiftKey) {
          onSubmit()
        } else {
          onSubmit({ forceAutoSend: true })
        }
        return
      }

      if (event.shiftKey) {
        onSubmit({ forceAutoSend: true })
        return
      }

      onSubmit()
    },
    [hasNoteText, isSubmitting, onNoteTextChange, onSubmit, totalItems]
  )
}
