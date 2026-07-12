import { useEffect, useRef } from 'react'

export function useAiSendComposerKeyboard(isSubmitting: boolean, handleToggleExpand: () => void) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        handleToggleExpand()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, handleToggleExpand])
}

export function useAiSendComposerClickOutside(
  isSubmitting: boolean,
  itemsLength: number,
  asideRef: React.RefObject<HTMLElement | null>,
  clearNote: () => void,
  onClearAll: () => void
) {
  const prevItemsLengthRef = useRef(itemsLength)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isSubmitting || itemsLength === 0) return

    const handleClickOutside = (event: MouseEvent) => {
      const el = asideRef.current
      if (!el) return
      const panel = el.querySelector('[data-panel]')
      if (panel && panel.contains(event.target as Node)) return
      if (el.contains(event.target as Node)) return
      const target = event.target as Node
      if (target instanceof Element) {
        if (
          target.closest('[role="dialog"], [role="tooltip"], [role="alertdialog"]') ||
          target.closest('[data-sonner-toaster]')
        )
          return
      }
      clearNote()
      onClearAll()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSubmitting, itemsLength, clearNote, onClearAll, asideRef])
}

export function useAiSendComposerFeedbackReset(
  itemsLength: number,
  setSendFeedback: React.Dispatch<React.SetStateAction<'idle' | 'sending' | 'success' | 'error'>>,
  setLastError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const prevItemsLengthRef = useRef(itemsLength)

  useEffect(() => {
    if (itemsLength > prevItemsLengthRef.current && itemsLength > 0) {
      setSendFeedback('idle')
      setLastError(null)
    }
    prevItemsLengthRef.current = itemsLength
  }, [itemsLength, setSendFeedback, setLastError])
}
