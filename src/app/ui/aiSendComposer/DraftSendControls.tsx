import { cn } from '@shared/lib/uiUtils'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2
} from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import type { SendFeedback } from './types'

interface DraftSendControlsProps {
  autoSend: boolean
  onToggleAutoSend: () => void
  onClearAll: () => void
  onSend: () => void
  onRetry: () => void
  feedback: SendFeedback
  lastError: string | null
  totalItems: number
  isSubmitting: boolean
}

/**
 * Alt bar: otomatik gönderme anahtarı + temizle + durum + gönder.
 *
 * Durum modeli: `staged` (AI kutusuna hazırlandı) bilinçli olarak `success`
 * (gönderildi) 'den ayrıdır — hazırlanan mesaj gönderilmiş gibi raporlanmaz.
 */
function DraftSendControls({
  autoSend,
  onToggleAutoSend,
  onClearAll,
  onSend,
  onRetry,
  feedback,
  lastError,
  totalItems,
  isSubmitting
}: DraftSendControlsProps) {
  const { t } = useTranslation()
  const isSending = feedback === 'sending' || isSubmitting

  const statusLabel =
    feedback === 'sending'
      ? t('sending_to_ai')
      : feedback === 'success'
        ? t('ai_send_sent')
        : feedback === 'staged'
          ? t('ai_send_staged')
          : feedback === 'error'
            ? (lastError ?? t('ai_send_error'))
            : totalItems > 0
              ? t('ai_send_ready')
              : ''

  const StatusIcon =
    feedback === 'sending'
      ? Loader2
      : feedback === 'success'
        ? CheckCircle2
        : feedback === 'staged'
          ? Info
          : feedback === 'error'
            ? AlertCircle
            : null

  return (
    <footer className="border-border/70 bg-muted/25 flex flex-col gap-2 border-t px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleAutoSend}
          aria-pressed={!!autoSend}
          aria-label={autoSend ? t('auto_send_on') : t('auto_send_off')}
          className={cn(
            'motion-normal focus-visible:ring-ring/40 text-ql-11 flex h-7 items-center gap-1.5 rounded-lg border px-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
            autoSend
              ? 'border-ring/45 bg-accent text-foreground'
              : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {t('ai_send_mode_auto')}
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full transition-colors',
              autoSend ? 'bg-emerald-500' : 'bg-muted-foreground/45'
            )}
          />
        </button>

        <WithTooltip label={t('ai_send_clear_all')}>
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            onClick={onClearAll}
            aria-label={t('ai_send_clear_all')}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </WithTooltip>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5" role="status">
          {StatusIcon && (
            <StatusIcon
              className={cn(
                'size-3.5 shrink-0',
                feedback === 'sending' && 'text-primary animate-spin',
                feedback === 'success' && 'text-emerald-600 dark:text-emerald-400',
                feedback === 'staged' && 'text-primary',
                feedback === 'error' && 'text-destructive'
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'text-ql-11 truncate font-medium',
              feedback === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : feedback === 'error'
                  ? 'text-destructive'
                  : feedback === 'sending' || feedback === 'staged'
                    ? 'text-primary'
                    : 'text-muted-foreground'
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {feedback === 'error' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-muted-foreground hover:bg-muted hover:text-foreground gap-1"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('ai_send_retry')}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSend}
            disabled={isSubmitting || totalItems === 0}
            className="text-ql-12 h-8 gap-1.5 px-3 font-semibold"
          >
            {isSending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t('sending_to_ai')}
              </>
            ) : feedback === 'error' ? (
              <>
                <RotateCcw className="size-3.5" aria-hidden />
                {t('ai_send_retry_send')}
              </>
            ) : (
              <>
                <Send className="size-3.5" aria-hidden />
                {t('send_to_ai')}
              </>
            )}
          </Button>
        </div>
      </div>
    </footer>
  )
}

export default memo(DraftSendControls)
