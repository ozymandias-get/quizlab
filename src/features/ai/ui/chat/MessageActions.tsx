import { useToastActions } from '@app/providers'

import { Check, Copy, Square, ThumbsDown, ThumbsUp, Trash2, Volume2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Module-scope regex so V8 doesn't re-evaluate the literal for every TTS
// trigger. Exported so tests can import it if needed.
const TURKISH_CHAR_REGEX = /[ÇÖÜçöüĞğİıŞş]/

// TTS sample window — checking the first 100 characters is enough to detect
// Turkish vs English for a typical chat message without scanning the whole
// response.
const TTS_SAMPLE_LENGTH = 100

export const CopyButton = memo(function CopyButton({ content }: { content: string }) {
  const { t } = useTranslation()
  const { showError } = useToastActions()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 1500)
    } catch {
      showError('toast_clipboard_failed')
    }
  }, [content, showError])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-ql-10 flex items-center justify-center rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none ${
        isCopied
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'text-white/25 hover:bg-white/[0.06] hover:text-white/60'
      }`}
      title={isCopied ? t('api_chat_copied') : t('api_chat_copy')}
      aria-label={isCopied ? t('api_chat_copied') : t('api_chat_copy')}
    >
      {isCopied ? (
        <Check className="animate-in fade-in zoom-in h-3.5 w-3.5 duration-200" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
})

export const TtsButton = memo(function TtsButton({ content }: { content: string }) {
  const { t } = useTranslation()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSpeakingRef = useRef(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null
        utteranceRef.current.onerror = null
      }
      if (isSpeakingRef.current) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null
        utteranceRef.current.onerror = null
      }
      window.speechSynthesis.cancel()
      isSpeakingRef.current = false
      setIsSpeaking(false)
    } else {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(content)
      const sample = content.slice(0, TTS_SAMPLE_LENGTH)
      const isTurkish = TURKISH_CHAR_REGEX.test(sample)
      utterance.lang = isTurkish ? 'tr-TR' : 'en-US'

      utterance.onend = () => {
        isSpeakingRef.current = false
        setIsSpeaking(false)
      }
      utterance.onerror = () => {
        isSpeakingRef.current = false
        setIsSpeaking(false)
      }
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
      isSpeakingRef.current = true
      setIsSpeaking(true)
    }
  }, [content, isSpeaking])

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`text-ql-10 flex items-center justify-center rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none ${
        isSpeaking
          ? 'bg-amber-500/10 text-amber-400'
          : 'text-white/25 hover:bg-white/[0.06] hover:text-white/60'
      }`}
      title={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
      aria-label={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
    >
      {isSpeaking ? (
        <Square className="h-3.5 w-3.5 animate-pulse" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
})

export const FeedbackButtons = memo(function FeedbackButtons() {
  const { t } = useTranslation()
  const [rated, setRated] = useState<'up' | 'down' | null>(null)

  return (
    <div className="flex items-center gap-0.5 transition-opacity">
      <button
        type="button"
        onClick={() => setRated(rated === 'up' ? null : 'up')}
        className={`rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none ${
          rated === 'up'
            ? 'bg-amber-500/10 text-amber-400'
            : 'text-white/25 hover:bg-white/[0.06] hover:text-white/60'
        }`}
        title={t('feedback_like')}
        aria-label={t('feedback_like')}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setRated(rated === 'down' ? null : 'down')}
        className={`rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none ${
          rated === 'down'
            ? 'bg-red-500/10 text-red-400'
            : 'text-white/25 hover:bg-white/[0.06] hover:text-white/60'
        }`}
        title={t('feedback_dislike')}
        aria-label={t('feedback_dislike')}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
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
    <button
      type="button"
      onClick={handleClick}
      className="text-ql-10 flex items-center justify-center rounded p-1 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
      title={t('api_chat_delete')}
      aria-label={t('api_chat_delete')}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
})

export default CopyButton
