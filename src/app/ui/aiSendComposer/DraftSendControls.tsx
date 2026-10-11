import { cn } from '@shared/lib/uiUtils'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import {
  AlertCircle,
  CheckCircle2,
  Inbox,
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
  const hasItems = totalItems > 0
  const isSendDisabled = isSubmitting || !hasItems

  const statusLabel =
    feedback === 'sending'
      ? t('sending_to_ai')
      : feedback === 'success'
        ? t('ai_send_sent')
        : feedback === 'staged'
          ? t('ai_send_staged')
          : feedback === 'error'
            ? (lastError ?? t('ai_send_error'))
            : t('ai_send_item_count', { count: totalItems })

  const StatusIcon =
    feedback === 'sending'
      ? Loader2
      : feedback === 'success'
        ? CheckCircle2
        : feedback === 'staged'
          ? Info
          : feedback === 'error'
            ? AlertCircle
            : Inbox

  const statusTone =
    feedback === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : feedback === 'error'
        ? 'text-destructive'
        : feedback === 'sending' || feedback === 'staged'
          ? 'text-foreground'
          : 'text-muted-foreground'

  return (
    <footer className="border-border/70 bg-muted/20 flex flex-col gap-2.5 border-t px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleAutoSend}
          aria-pressed={!!autoSend}
          aria-label={autoSend ? t('auto_send_on') : t('auto_send_off')}
          className={cn(
            'motion-normal focus-visible:ring-ring/40 text-ql-11 flex h-7 items-center gap-1.5 rounded-lg border px-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
            autoSend
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          <span>{t('ai_send_mode_auto')}</span>
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full transition-colors',
              autoSend ? 'bg-primary' : 'bg-muted-foreground/45'
            )}
          />
        </button>

        <WithTooltip label={t('ai_send_clear_all')}>
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            onClick={onClearAll}
            disabled={totalItems === 0 && !lastError}
            aria-label={t('ai_send_clear_all')}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-auto disabled:pointer-events-none disabled:opacity-30"
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </WithTooltip>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5" role="status">
          <StatusIcon
            className={cn(
              'size-3.5 shrink-0',
              feedback === 'sending' && 'animate-spin',
              statusTone
            )}
            aria-hidden
          />
          <span className={cn('text-ql-11 truncate font-medium', statusTone)}>{statusLabel}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {feedback === 'error' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-muted-foreground hover:bg-muted hover:text-foreground text-ql-11 h-8 gap-1 px-2.5"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('ai_send_retry')}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSend}
            disabled={isSendDisabled}
            size="sm"
            className={cn(
              'text-ql-12 h-8 gap-1.5 px-3.5 font-semibold transition-all',
              isSendDisabled
                ? 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/40 opacity-50'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs'
            )}
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
