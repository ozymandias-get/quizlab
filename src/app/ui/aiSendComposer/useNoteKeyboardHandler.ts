import type { KeyboardEvent } from 'react'
import { useCallback } from 'react'

interface UseNoteKeyboardHandlerOptions {
  isSubmitting: boolean
  totalItems: number
  onNoteTextChange: (text: string) => void
  onSubmit: (options?: { autoSend?: boolean }) => void
}

/**
 * Inserts a newline at the caret, replacing any selection.
 *
 * The caret restore is deferred to the next frame because the textarea is a
 * controlled component: assigning `selectionStart` before React commits the new
 * value would be overwritten when the value change lands.
 */
function insertNewlineAtCaret(textarea: HTMLTextAreaElement): string {
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const next = `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1
  })
  return next
}

export function useNoteKeyboardHandler({
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

      // Shift+Enter is the newline shortcut in every chat composer, so Enter
      // stays reserved for submitting. Ctrl/Cmd+Enter keeps its original
      // newline behaviour so anyone who learned it is not surprised. Newlines
      // must keep working with an empty queue, hence the check before the
      // submit guards.
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault()
        onNoteTextChange(insertNewlineAtCaret(event.currentTarget))
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

      // Submitting defers to the global auto-send preference: with auto-send off
      // the content is only staged and the user submits on the site. Typing a
      // note and pressing Enter expresses intent, but it must not bypass a
      // setting the user deliberately turned off — the Send button does not
      // either, and the two must agree.
      onSubmit()
    },
    [isSubmitting, onNoteTextChange, onSubmit, totalItems]
  )
}
