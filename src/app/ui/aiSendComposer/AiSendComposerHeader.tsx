import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'

import { ChevronDown, ChevronUp, Loader2, Send, Sparkles, Trash2 } from 'lucide-react'
import { memo, type PointerEventHandler } from 'react'
import { useTranslation } from 'react-i18next'

import type { SendFeedback } from './types'

interface AiSendComposerHeaderProps {
  textCount: number
  imageCount: number
  autoSend: boolean
  isExpanded: boolean
  sendFeedback: SendFeedback
  onToggleExpand: () => void
  onClearAll: () => void
  onSend: () => void
  isSubmitting: boolean
  isSendDisabled: boolean
  onDragStart: PointerEventHandler<HTMLDivElement>
  onDragMove: PointerEventHandler<HTMLDivElement>
  onDragEnd: PointerEventHandler<HTMLDivElement>
}

function AiSendComposerHeader({
  textCount,
  imageCount,
  autoSend,
  isExpanded,
  sendFeedback,
  onToggleExpand,
  onClearAll,
  onSend,
  isSubmitting,
  isSendDisabled,
  onDragStart,
  onDragMove,
  onDragEnd
}: AiSendComposerHeaderProps) {
  const { t } = useTranslation()
  const totalItems = textCount + imageCount
  const isSending = sendFeedback === 'sending'

  // Compact state: minimal pill bar
  if (!isExpanded) {
    return (
      <div
        className="border-border flex cursor-grab touch-none items-center justify-between gap-3 border-b px-4 py-2.5 select-none active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
            <Send className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {totalItems > 0 && !isSending && (
              <span className="text-ql-13 text-foreground truncate font-semibold">
                {totalItems}{' '}
                {totalItems === 1 ? t('ai_send_item_singular') : t('ai_send_items_plural')}
              </span>
            )}
            {isSending && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="text-primary h-3 w-3 animate-spin" strokeWidth={2} />
                <span className="text-ql-10 text-muted-foreground font-medium">
                  {t('sending_to_ai')}
                </span>
              </div>
            )}
            {autoSend && !isSending && (
              <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5">
                <Sparkles
                  className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={2}
                />
                <span className="text-ql-10 font-semibold text-emerald-600 dark:text-emerald-400">
                  {t('ai_send_mode_auto')}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSend()
            }}
            disabled={isSubmitting || isSendDisabled}
            className={cn(
              'text-ql-11 bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-lg px-3.5 font-semibold shadow-xs transition-colors disabled:opacity-40',
              isSubmitting && 'pointer-events-none'
            )}
            aria-label={t('send_to_ai')}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <span className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                {t('send_to_ai')}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_clear_all')}
            aria-label={t('ai_send_clear_all')}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_expand')}
            aria-label={t('ai_send_expand')}
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>
    )
  }

  // Expanded state: full header
  const summaryParts: string[] = []
  if (textCount > 0) summaryParts.push(`${textCount} ${t('ai_send_text_count_label')}`)
  if (imageCount > 0) summaryParts.push(`${imageCount} ${t('ai_send_image_count_label')}`)
  const summary = summaryParts.join(' · ')

  return (
    <div
      className="border-border relative cursor-grab touch-none border-b px-4 py-3 select-none active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
            <Send className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-ql-13 text-foreground truncate font-semibold">
              {t('ai_send_panel_title')}
            </p>
            {summary && !isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-ql-11 text-muted-foreground font-medium">{summary}</span>
              </div>
            )}
            {isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <Loader2 className="text-primary h-3 w-3 animate-spin" strokeWidth={2} />
                <span className="text-ql-11 text-muted-foreground font-medium">
                  {t('sending_to_ai')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_clear_all')}
            aria-label={t('ai_send_clear_all')}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_collapse')}
            aria-label={t('ai_send_collapse')}
            aria-expanded={isExpanded}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(AiSendComposerHeader)
