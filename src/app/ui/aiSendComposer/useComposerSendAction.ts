import { isStagedSendResult } from '@features/ai'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ComposerPayload, SendFeedback } from './types'

interface UseComposerSendActionOptions {
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
  noteText: string
  effectiveAutoSend: boolean
  setIsExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  setStoredExpanded: (value: boolean) => void
}

/** Sonuç bildiriminin görünür kalma süreleri. */
const FEEDBACK_TIMEOUT_MS = { success: 1500, staged: 2500 } as const

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

  // Tek zamanlayıcı, ref ile: üst üste gelen gönderimlerde eski zamanlayıcı
  // yeni bildirimi silemez; unmount'ta sızar.
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const timerRef = feedbackTimerRef
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const scheduleFeedbackReset = useCallback((afterMs: number) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null
      setSendFeedback('idle')
    }, afterMs)
  }, [])

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
          scheduleFeedbackReset(FEEDBACK_TIMEOUT_MS.success)
        } else if (staged) {
          // Hazırlandı durumu: gönderilmedi; kısa bilgi sonra dinlenir.
          setSendFeedback('staged')
          scheduleFeedbackReset(FEEDBACK_TIMEOUT_MS.staged)
        } else {
          if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current)
            feedbackTimerRef.current = null
          }
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
        if (feedbackTimerRef.current) {
          clearTimeout(feedbackTimerRef.current)
          feedbackTimerRef.current = null
        }
        setSendFeedback('error')
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      onSend,
      isSubmitting,
      setIsSubmitting,
      setIsExpanded,
      setStoredExpanded,
      scheduleFeedbackReset,
      t
    ]
  )

  const handleRetry = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
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
