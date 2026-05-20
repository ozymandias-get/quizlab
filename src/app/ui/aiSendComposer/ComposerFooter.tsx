import { memo } from 'react'
import { Loader2, Send, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'
import { Button } from '@ui/components/button'

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
  const { t } = useLanguageStrings()

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
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" strokeWidth={2} />
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" strokeWidth={2} />
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-400/80" strokeWidth={2} />
      default:
        return null
    }
  })()

  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5">
        {statusIcon}
        <span
          className={cn(
            'text-[10px] font-medium',
            sendFeedback === 'success'
              ? 'text-emerald-300/80'
              : sendFeedback === 'error'
                ? 'text-red-300/80'
                : 'text-white/50'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {sendFeedback === 'error' && (
          <Button
            type="button"
            onClick={onRetry}
            variant="ghost"
            className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-white/55 transition-colors hover:text-white/75"
          >
            <RotateCcw className="mr-1 h-3 w-3" strokeWidth={2} />
            {t('ai_send_retry')}
          </Button>
        )}

        <Button
          type="button"
          onClick={() => {
            onSubmit()
          }}
          disabled={isSubmitting || totalItems === 0}
          className="rounded-lg px-3.5 py-2 text-[10px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-35"
          style={{
            background:
              sendFeedback === 'error'
                ? 'rgba(255,255,255,0.1)'
                : `linear-gradient(135deg, ${accentStrong}, rgba(45,212,191,0.5) 70%)`
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              {t('sending_to_ai')}
            </span>
          ) : sendFeedback === 'error' ? (
            t('ai_send_retry_send')
          ) : (
            <span className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
              {t('send_to_ai')}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

export default memo(ComposerFooter)
