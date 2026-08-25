import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { useClipboard } from '@shared/hooks/useClipboard'

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
  const { copy, isCopied } = useClipboard()

  const handleCopy = useCallback(() => void copy(content), [content, copy])

  return (
    <WithTooltip label={isCopied ? t('api_chat_copied') : t('api_chat_copy')}>
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        onClick={handleCopy}
        className={`text-ql-10 ${
          isCopied
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground'
        }`}
        aria-label={isCopied ? t('api_chat_copied') : t('api_chat_copy')}
      >
        {isCopied ? <Check className="animate-in fade-in zoom-in motion-slow" /> : <Copy />}
      </IconButton>
    </WithTooltip>
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
    <WithTooltip
      label={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
    >
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        onClick={handleSpeak}
        className={`text-ql-10 ${
          isSpeaking ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        }`}
        aria-label={isSpeaking ? t('api_chat_tts_stop_tooltip') : t('api_chat_tts_speak_tooltip')}
      >
        {isSpeaking ? <Square className="animate-pulse" /> : <Volume2 />}
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

export default CopyButton
