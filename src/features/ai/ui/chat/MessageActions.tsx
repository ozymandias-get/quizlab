import { useClipboard } from '@shared/hooks/useClipboard'
import { IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Check, Copy, Square, ThumbsDown, ThumbsUp, Trash2, Volume2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Module-scope regex so V8 doesn't re-evaluate the literal for every TTS
// trigger. Exported so tests can import it if needed.
const TURKISH_CHAR_REGEX = /[ÇÖÜçöüĞğİıŞş]/

/**
 * The stop callback of the utterance that is speaking right now.
 *
 * `speechSynthesis.cancel()` affects the whole app, so the button that owns
 * the queue has to reset the state of the button it interrupted. A single
 * module-level owner does that; per-button state alone cannot.
 */
let activeTtsStop: (() => void) | null = null

/** Long enough to read the confirmation, short enough not to linger. */
const COPY_CONFIRMATION_MS = 2000

export const CopyButton = memo(function CopyButton({ content }: { content: string }) {
  const { t } = useTranslation()
  const { copy, isCopied } = useClipboard(COPY_CONFIRMATION_MS)

  const handleCopy = useCallback(() => void copy(content), [content, copy])

  return (
    <WithTooltip label={isCopied ? t('api_chat_copied') : t('api_chat_copy')}>
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        onClick={handleCopy}
        data-copied={isCopied || undefined}
        className={`text-ql-10 transition-colors ${
          isCopied
            ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
            : 'text-muted-foreground'
        }`}
        aria-label={isCopied ? t('api_chat_copied') : t('api_chat_copy')}
      >
        {isCopied ? <Check className="animate-in fade-in zoom-in motion-slow" /> : <Copy />}
      </IconButton>
    </WithTooltip>
  )
})

export const TtsButton = memo(function TtsButton({
  content,
  onSpeakingChange
}: {
  content: string
  /**
   * Lets the message bubble follow playback. The callback is read through a ref
   * so a new identity every render cannot re-create the speak/stop handlers.
   */
  onSpeakingChange?: (isSpeaking: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSpeakingRef = useRef(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const stopRef = useRef<() => void>(() => undefined)
  const onSpeakingChangeRef = useRef(onSpeakingChange)
  onSpeakingChangeRef.current = onSpeakingChange

  const publishSpeaking = useCallback((value: boolean) => {
    isSpeakingRef.current = value
    setIsSpeaking(value)
    onSpeakingChangeRef.current?.(value)
  }, [])

  const stop = useCallback(() => {
    const utterance = utteranceRef.current
    if (utterance) {
      utterance.onend = null
      utterance.onerror = null
    }
    window.speechSynthesis.cancel()
    publishSpeaking(false)
    if (activeTtsStop === stopRef.current) activeTtsStop = null
  }, [publishSpeaking])
  stopRef.current = stop

  useEffect(() => {
    return () => {
      if (isSpeakingRef.current) stopRef.current()
    }
  }, [])

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      stop()
      return
    }

    // A different message may be speaking: cancel it through its own stop so
    // its state is reset now, not whenever the browser reports the error.
    activeTtsStop?.()

    const utterance = new SpeechSynthesisUtterance(content)
    // The app language is the default. Turkish-specific characters can still
    // identify Turkish text in a non-Turkish UI, but character detection is
    // not the only signal (a Turkish sentence may contain none).
    const appLanguage = i18n.language || ''
    const isTurkish = TURKISH_CHAR_REGEX.test(content) || appLanguage.startsWith('tr')
    utterance.lang = isTurkish ? 'tr-TR' : 'en-US'

    const finish = () => {
      publishSpeaking(false)
      if (activeTtsStop === stopRef.current) activeTtsStop = null
    }
    utterance.onend = finish
    utterance.onerror = finish

    utteranceRef.current = utterance
    activeTtsStop = stopRef.current
    window.speechSynthesis.speak(utterance)
    publishSpeaking(true)
  }, [content, i18n.language, isSpeaking, publishSpeaking, stop])

  return (
    <WithTooltip
      label={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
    >
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        onClick={handleSpeak}
        aria-pressed={isSpeaking}
        className={`text-ql-10 ${
          isSpeaking ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        }`}
        aria-label={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
      >
        {isSpeaking ? (
          <span className="relative flex size-3.5 items-center justify-center" aria-hidden>
            <span className="bg-primary/25 absolute inset-0 animate-ping rounded-full" />
            <Square className="relative size-3.5" />
          </span>
        ) : (
          <Volume2 />
        )}
      </IconButton>
    </WithTooltip>
  )
})

export const FeedbackButtons = memo(function FeedbackButtons() {
  const { t } = useTranslation()
  const [rated, setRated] = useState<'up' | 'down' | null>(null)

  return (
    <div className="flex items-center gap-0.5 transition-opacity">
      <WithTooltip label={t('feedback_like')}>
        <IconButton
          type="button"
          size="compact"
          variant="ghost"
          onClick={() => setRated(rated === 'up' ? null : 'up')}
          className={`${rated === 'up' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          aria-label={t('feedback_like')}
        >
          <ThumbsUp />
        </IconButton>
      </WithTooltip>
      <WithTooltip label={t('feedback_dislike')}>
        <IconButton
          type="button"
          size="compact"
          variant="ghost"
          onClick={() => setRated(rated === 'down' ? null : 'down')}
          className={`${
            rated === 'down' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'
          }`}
          aria-label={t('feedback_dislike')}
        >
          <ThumbsDown />
        </IconButton>
      </WithTooltip>
    </div>
  )
})

export const DeleteButton = memo(function DeleteButton({
  onDelete,
  messageId
}: {
  onDelete: (messageId: string) => void
  messageId: string
}) {
  const { t } = useTranslation()
  const handleClick = () => onDelete(messageId)
  return (
    <WithTooltip label={t('api_chat_delete')}>
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        onClick={handleClick}
        className="text-ql-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={t('api_chat_delete')}
      >
        <Trash2 />
      </IconButton>
    </WithTooltip>
  )
})
