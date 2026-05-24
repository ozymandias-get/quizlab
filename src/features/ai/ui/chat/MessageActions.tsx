import { useState, useEffect, useCallback } from 'react'
import { useLanguageStrings } from '@app/providers'

export function CopyButton({ content }: { content: string }) {
  const { t } = useLanguageStrings()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [content])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center justify-center rounded p-1 text-ql-10 transition-all ${
        copied
          ? 'text-emerald-400 bg-emerald-500/10'
          : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
      }`}
      title={copied ? t('api_chat_copied') || 'Kopyalandı!' : t('api_chat_copy') || 'Kopyala'}
    >
      {copied ? (
        <svg
          className="h-3.5 w-3.5 animate-app-enter"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

export function TtsButton({ content }: { content: string }) {
  const { t } = useLanguageStrings()
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const handleSpeak = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    } else {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(content)
      const isTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(content.slice(0, 100))
      utterance.lang = isTurkish ? 'tr-TR' : 'en-US'

      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
      setIsSpeaking(true)
    }
  }, [content, isSpeaking])

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`flex items-center justify-center rounded p-1 text-ql-10 transition-all ${
        isSpeaking
          ? 'text-amber-400 bg-amber-500/10'
          : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
      }`}
      title={
        isSpeaking
          ? t('api_chat_tts_stop_tooltip') || 'Sesi Durdur'
          : t('api_chat_tts_speak_tooltip') || 'Sesli Oku'
      }
    >
      {isSpeaking ? (
        <svg
          className="h-3.5 w-3.5 animate-pulse"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  )
}

export function FeedbackButtons() {
  const [rated, setRated] = useState<'up' | 'down' | null>(null)

  return (
    <div className="flex items-center gap-0.5 transition-opacity">
      <button
        type="button"
        onClick={() => setRated(rated === 'up' ? null : 'up')}
        className={`p-1 rounded transition-all ${
          rated === 'up'
            ? 'text-amber-400 bg-amber-500/10'
            : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
        }`}
        title="Beğen"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setRated(rated === 'down' ? null : 'down')}
        className={`p-1 rounded transition-all ${
          rated === 'down'
            ? 'text-red-400 bg-red-500/10'
            : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
        }`}
        title="Beğenme"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
  )
}

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { t } = useLanguageStrings()
  return (
    <button
      type="button"
      onClick={onDelete}
      className="flex items-center justify-center rounded p-1 text-ql-10 text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
      title={t('api_chat_delete') || 'Sil'}
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  )
}
