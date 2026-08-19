import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SendFeedback } from './types'

interface ComposerPayload {
  noteText?: string
  autoSend?: boolean
  forceAutoSend?: boolean
}

interface UseComposerSendActionOptions {
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
  noteText: string
  effectiveAutoSend: boolean
  setIsExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  setStoredExpanded: (value: boolean) => void
}

export function useComposerSendAction({
  isSubmitting,
  setIsSubmitting,
  onSend,
  noteText,
  effectiveAutoSend,
  setIsExpanded,
  setStoredExpanded
}: UseComposerSendActionOptions) {
  const { t } = useTranslation()
  const [sendFeedback, setSendFeedback] = useState<SendFeedback>('idle')
  const [lastError, setLastError] = useState<string | null>(null)

  const noteTextRef = useRef(noteText)
  noteTextRef.current = noteText
  const effectiveAutoSendRef = useRef(effectiveAutoSend)
  effectiveAutoSendRef.current = effectiveAutoSend

  const handleSend = useCallback(
    async (options?: ComposerPayload) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      setSendFeedback('sending')
      setLastError(null)
      setIsExpanded(false)
      setStoredExpanded(false)
      try {
        const result = await onSend({
          noteText:
            options?.noteText !== undefined
              ? options.noteText
              : noteTextRef.current.trim() || undefined,
          autoSend:
            options?.autoSend !== undefined ? options.autoSend : effectiveAutoSendRef.current,
          forceAutoSend: options?.forceAutoSend
        })
        const wasSuccessful =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        if (wasSuccessful) {
          setSendFeedback('success')
          setTimeout(() => setSendFeedback('idle'), 1500)
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
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        setIsSubmitting(false)
      }
    },
    [onSend, isSubmitting, setIsSubmitting, setIsExpanded, setStoredExpanded, t]
  )

  const handleRetry = useCallback(() => {
    setSendFeedback('idle')
    setLastError(null)
  }, [])

  const handleForceSend = useCallback(() => {
    void handleSend({ forceAutoSend: true })
  }, [handleSend])

  const handleSendWithPreset = useCallback(
    (presetValue: string) => {
      void handleSend({ noteText: presetValue, forceAutoSend: true })
    },
    [handleSend]
  )

  return {
    sendFeedback,
    setSendFeedback,
    lastError,
    setLastError,
    handleSend,
    handleRetry,
    handleForceSend,
    handleSendWithPreset
  }
}
