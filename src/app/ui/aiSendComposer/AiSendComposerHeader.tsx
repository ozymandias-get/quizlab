import { memo, type PointerEventHandler } from 'react'
import { Send, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'
import { Button } from '@ui/components/button'
import type { SendFeedback } from './types'

interface AiSendComposerHeaderProps {
  textCount: number
  imageCount: number
  autoSend: boolean
  isExpanded: boolean
  sendFeedback: SendFeedback
  onToggleAutoSend: () => void
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
  onToggleAutoSend,
  onToggleExpand,
  onClearAll,
  onSend,
  isSubmitting,
  isSendDisabled,
  onDragStart,
  onDragMove,
  onDragEnd
}: AiSendComposerHeaderProps) {
  const { t } = useLanguageStrings()

  const summaryParts: string[] = []
  if (textCount > 0) {
    summaryParts.push(`${textCount} ${t('ai_send_text_count_label')}`)
  }
  if (imageCount > 0) {
    summaryParts.push(`${imageCount} ${t('ai_send_image_count_label')}`)
  }
  const summary = summaryParts.join(' · ')
  const modeHint = autoSend ? t('ai_send_mode_auto') : t('ai_send_mode_manual')

  const isSending = sendFeedback === 'sending'

  return (
    <div
      className={cn(
        'relative cursor-grab select-none touch-none active:cursor-grabbing',
        isExpanded ? 'px-3.5 pt-3 pb-2.5' : 'px-3 py-2.5'
      )}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Send className="h-3.5 w-3.5 shrink-0 text-white/65" strokeWidth={2} />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-white/90">
              {t('ai_send_panel_title')}
            </p>
            {summary && !isSending && (
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-[10px] text-white/55">{summary}</span>
                <span className="text-white/25">·</span>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    autoSend ? 'text-emerald-400/75' : 'text-white/55'
                  )}
                >
                  {modeHint}
                </span>
              </div>
            )}
            {isSending && (
              <div className="mt-0.5 flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-white/40" strokeWidth={2} />
                <span className="text-[10px] text-white/45">{t('sending_to_ai')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isExpanded && (
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSend()
              }}
              disabled={isSubmitting || isSendDisabled}
              className={cn(
                'h-7 rounded-lg px-2.5 text-[10px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-35',
                isSubmitting && 'pointer-events-none'
              )}
              style={{
                background: `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))`
              }}
              aria-label={t('send_to_ai')}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
                  {t('send_to_ai')}
                </span>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleAutoSend}
            className={cn(
              'h-6 w-6 shrink-0 rounded-md transition-colors',
              autoSend
                ? 'text-emerald-400/75 hover:text-emerald-300/90 hover:bg-emerald-500/10'
                : 'text-white/40 hover:text-white/65'
            )}
            title={autoSend ? t('auto_send_on') : t('auto_send_off')}
            aria-pressed={autoSend}
            aria-label={t('auto_send')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="h-6 w-6 shrink-0 rounded-md text-white/40 transition-colors hover:text-white/70"
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
            className="h-6 w-6 shrink-0 rounded-md text-white/40 transition-colors hover:text-white/70"
            title={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
            aria-label={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3.5 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  )
}

export default memo(AiSendComposerHeader)
