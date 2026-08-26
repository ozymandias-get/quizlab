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
      // 1) Electron IPC (en güvenilir - throttling/sanitize main'de yapılır)
      const electronCopy = (
        window as unknown as {
          electronAPI?: { copyTextToClipboard?: (t: string) => Promise<boolean> }
        }
      )?.electronAPI?.copyTextToClipboard
      if (typeof electronCopy === 'function') {
        try {
          const ok = await electronCopy(text)
          if (ok) {
            setIsCopied(true)
            if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => setIsCopied(false), timeoutMs)
            return true
          }
        } catch {
          // fallback to navigator
        }
      }

      // 2) Modern async clipboard
      try {
        await navigator.clipboard.writeText(text)
        setIsCopied(true)
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setIsCopied(false), timeoutMs)
        return true
      } catch {
        // fallback to legacy execCommand
      }

      // 3) Legacy execCommand fallback (http, insecure context, permission yok)
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        ta.style.pointerEvents = 'none'
        document.body.appendChild(ta)
        ta.select()
        ta.setSelectionRange(0, ta.value.length)
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (ok) {
          setIsCopied(true)
          if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => setIsCopied(false), timeoutMs)
          return true
        }
      } catch {
        // ignore
      }

      showError('toast_clipboard_failed')
      return false
    },
    [showError, timeoutMs]
  )

  return { copy, isCopied }
}
