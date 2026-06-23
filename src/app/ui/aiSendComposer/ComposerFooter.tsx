import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'

import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface ComposerFooterProps {
  isSubmitting: boolean
  sendFeedback: 'idle' | 'sending' | 'success' | 'error'
  lastError: string | null
  totalItems: number
  accentStrong: string
  onSubmit: (options?: { forceAutoSend?: boolean }) => void
  onRetry: () => void
}

function ComposerFooter({
  isSubmitting,
  sendFeedback,
  totalItems,
  accentStrong,
  onSubmit,
  onRetry
}: ComposerFooterProps) {
  const { t } = useTranslation()

  const statusLabel = (() => {
    switch (sendFeedback) {
      case 'sending':
        return t('sending_to_ai')
      case 'success':
        return t('ai_send_sent')
      case 'error':
        return t('ai_send_error')
      default:
        return totalItems > 0 ? t('ai_send_ready') : ''
    }
  })()

  const statusIcon = (() => {
    switch (sendFeedback) {
      case 'sending':
        return <Loader2 className="h-4 w-4 animate-spin text-amber-400" strokeWidth={2} />
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" strokeWidth={2} />
      default:
        return null
    }
  })()

  const sendBtnStyle = useMemo(() => {
    if (sendFeedback === 'error') {
      return { background: 'oklch(1 0 0 / 0.1)' }
    }
    return {
      background: `linear-gradient(135deg, ${accentStrong} 0%, oklch(0.8 0.15 175 / 0.55) 100%)`,
      boxShadow: totalItems > 0 ? `0 4px 14px ${accentStrong}35` : 'none'
    }
  }, [sendFeedback, accentStrong, totalItems])

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-2">
        {statusIcon}
        <span
          className={cn(
            'text-ql-11 font-semibold',
            sendFeedback === 'success'
              ? 'text-emerald-400'
              : sendFeedback === 'error'
                ? 'text-red-400'
                : sendFeedback === 'sending'
                  ? 'text-amber-400'
                  : 'text-white/65'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {sendFeedback === 'error' && (
          <Button
            type="button"
            onClick={onRetry}
            variant="ghost"
            className="text-ql-11 rounded-xl px-3 py-2 font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/90"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" strokeWidth={2} />
            {t('ai_send_retry')}
          </Button>
        )}

        <Button
          type="button"
          onClick={() => onSubmit()}
          disabled={isSubmitting || totalItems === 0}
          className="text-ql-11 rounded-xl px-4 py-2.5 font-bold text-white transition-colors hover:brightness-110 active:scale-[0.97] disabled:opacity-30"
          style={sendBtnStyle}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              {t('sending_to_ai')}
            </span>
          ) : sendFeedback === 'error' ? (
            <span className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" strokeWidth={2} />
              {t('ai_send_retry_send')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4 opacity-90" strokeWidth={2.5} />
              {t('send_to_ai')}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

export default memo(ComposerFooter)
