import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the "copied" feedback stays visible. */
const COPY_FEEDBACK_MS = 1500

interface UseClipboardResult {
  /** Writes `text` to the clipboard; shows an error toast on failure. */
  copy: (text: string) => Promise<boolean>
  /** True while the success feedback window is active. */
  isCopied: boolean
}

/**
 * Centralized clipboard helper: write + transient "copied" feedback +
 * error toast. Replaces per-component `navigator.clipboard.writeText` /
 * `setTimeout` boilerplate (STD-012).
 */
export function useClipboard(timeoutMs: number = COPY_FEEDBACK_MS): UseClipboardResult {
  const { showError } = useToastActions()
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    },
    []
  )

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        showError('toast_clipboard_failed')
        return false
      }
      setIsCopied(true)
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsCopied(false), timeoutMs)
      return true
    },
    [showError, timeoutMs]
  )

  return { copy, isCopied }
}
