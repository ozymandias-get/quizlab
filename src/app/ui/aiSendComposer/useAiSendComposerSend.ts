import { useCallback, useRef } from 'react'

import type { SendFeedback } from './types'

export function useAiSendComposerSend(
  onSend: (payload: {
    noteText?: string
    autoSend?: boolean
    forceAutoSend?: boolean
  }) => Promise<unknown>,
  isSubmitting: boolean,
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>,
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setStoredExpanded: (value: boolean) => void,
  setSendFeedback: React.Dispatch<React.SetStateAction<SendFeedback>>,
  setLastError: React.Dispatch<React.SetStateAction<string | null>>,
  t: (key: string) => string
) {
  const mountedRef = useRef(true)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSend = useCallback(
    async (options?: { forceAutoSend?: boolean }) => {
      if (isSubmitting) return

      setIsSubmitting(true)
      setSendFeedback('sending')
      setLastError(null)
      setIsExpanded(false)
      setStoredExpanded(false)

      try {
        const result = await onSend({
          ...options
        })

        if (!mountedRef.current) return

        const wasSuccessful =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        if (wasSuccessful) {
          setSendFeedback('success')
          feedbackTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setSendFeedback('idle')
          }, 1500)
        } else {
          setSendFeedback('error')
          const rawError =
            typeof result === 'object' && result && 'error' in result
              ? String((result as { error?: string }).error)
              : null
          const errorKey = rawError ? `error_${rawError}` : 'unknown_error'
          const localizedError = t(errorKey)
          setLastError(localizedError === errorKey ? rawError : localizedError)
          setIsExpanded(true)
          setStoredExpanded(true)
        }
      } catch {
        if (!mountedRef.current) return
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        if (mountedRef.current) setIsSubmitting(false)
      }
    },
    [
      onSend,
      isSubmitting,
      setIsSubmitting,
      setStoredExpanded,
      t,
      setIsExpanded,
      setSendFeedback,
      setLastError
    ]
  )

  return { handleSend, feedbackTimerRef, mountedRef }
}
