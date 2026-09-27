import { isStagedSendResult } from '@features/ai'

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SendFeedback } from './types'

interface ComposerPayload {
  noteText?: string
  autoSend?: boolean
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
            options?.autoSend !== undefined ? options.autoSend : effectiveAutoSendRef.current
        })
        const succeeded =
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true

        // Auto-send off means the content was staged (pasted into the site's
        // composer, prompt filled) and the user still has to submit. Showing
        // the green badge there would claim a delivery that did not happen.
        const staged =
          succeeded && isStagedSendResult(result as { success: boolean; mode?: string })

        if (succeeded && !staged) {
          setSendFeedback('success')
          setTimeout(() => setSendFeedback('idle'), 1500)
        } else if (staged) {
          setSendFeedback('idle')
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

  // Every composer affordance — Send button and prompt presets — defers to the
  // global auto-send preference. With auto-send off they stage the content
  // (paste the image, fill the prompt) and the user submits on the site; there
  // is no path that submits regardless, so a disabled setting is never bypassed.
  const handleForceSend = useCallback(() => {
    void handleSend()
  }, [handleSend])

  const handleSendWithPreset = useCallback(
    (presetValue: string) => {
      void handleSend({ noteText: presetValue })
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
