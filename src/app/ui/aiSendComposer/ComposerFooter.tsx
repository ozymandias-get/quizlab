import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'

import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface ComposerFooterProps {
  isSubmitting: boolean
  sendFeedback: 'idle' | 'sending' | 'success' | 'error'
  lastError: string | null
  totalItems: number
  accentStrong?: string
  onSubmit: (options?: { forceAutoSend?: boolean }) => void
  onRetry: () => void
}

function ComposerFooter({
  isSubmitting,
  sendFeedback,
  totalItems,
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

  return (
    <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-2.5">
      <div className="flex items-center gap-2">
        {statusIcon}
        <span
          className={cn(
            'text-ql-11 font-semibold',
            sendFeedback === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : sendFeedback === 'error'
                ? 'text-destructive'
                : sendFeedback === 'sending'
                  ? 'text-primary'
                  : 'text-muted-foreground'
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
            className="text-ql-11 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
            {t('ai_send_retry')}
          </Button>
        )}

        <Button
          type="button"
          onClick={() => onSubmit()}
          disabled={isSubmitting || totalItems === 0}
          className="text-ql-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3.5 py-1.5 font-semibold shadow-xs transition-colors disabled:opacity-40"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              {t('sending_to_ai')}
            </span>
          ) : sendFeedback === 'error' ? (
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              {t('ai_send_retry_send')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
              {t('send_to_ai')}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

export default memo(ComposerFooter)
