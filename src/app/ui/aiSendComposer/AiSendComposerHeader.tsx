import { memo, type PointerEventHandler } from 'react'
import { Send, ChevronDown, ChevronUp, Trash2, Loader2, Sparkles } from 'lucide-react'
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
  const totalItems = textCount + imageCount
  const isSending = sendFeedback === 'sending'

  // Compact state: minimal pill bar
  if (!isExpanded) {
    return (
      <div
        className="flex cursor-grab select-none touch-none items-center justify-between gap-3 px-5 py-3 active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/25 to-amber-500/15 ring-1 ring-inset ring-amber-400/20">
            <Send className="h-4 w-4 text-amber-400" strokeWidth={2.5} />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {totalItems > 0 && !isSending && (
              <span className="truncate text-[13px] font-bold text-white">
                {totalItems}{' '}
                {totalItems === 1 ? t('ai_send_item_singular') : t('ai_send_items_plural')}
              </span>
            )}
            {isSending && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" strokeWidth={2} />
                <span className="text-[10px] font-medium text-white/80">{t('sending_to_ai')}</span>
              </div>
            )}
            {autoSend && !isSending && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5">
                <Sparkles className="h-2.5 w-2.5 text-emerald-400" strokeWidth={2} />
                <span className="text-[9px] font-semibold text-emerald-300">
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
              'h-9 rounded-xl px-4 text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-30',
              isSubmitting && 'pointer-events-none'
            )}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset'
            }}
            aria-label={t('send_to_ai')}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4 opacity-90" strokeWidth={2.5} />
                {t('send_to_ai')}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="h-7 w-7 shrink-0 rounded-lg text-white/50 transition-all hover:text-red-400 hover:bg-red-500/10"
            title={t('ai_send_clear_all')}
            aria-label={t('ai_send_clear_all')}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            className="h-7 w-7 shrink-0 rounded-lg text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/80"
            title={t('ai_send_expand')}
            aria-label={t('ai_send_expand')}
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
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
      className="relative cursor-grab select-none touch-none active:cursor-grabbing px-4 pt-3.5 pb-3"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/25 to-amber-500/15 ring-1 ring-inset ring-amber-400/20">
            <Send className="h-4 w-4 text-amber-400" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-white tracking-tight">
              {t('ai_send_panel_title')}
            </p>
            {summary && !isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-white/70">{summary}</span>
                {autoSend && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-[10px] font-medium text-emerald-400">
                      {t('ai_send_mode_auto')}
                    </span>
                  </>
                )}
              </div>
            )}
            {isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" strokeWidth={2} />
                <span className="text-[10px] font-medium text-white/70">{t('sending_to_ai')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleAutoSend}
            className={cn(
              'h-7 w-7 shrink-0 rounded-lg transition-all',
              autoSend
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15'
                : 'text-white/50 hover:text-white/70 hover:bg-white/[0.08]'
            )}
            title={autoSend ? t('auto_send_on') : t('auto_send_off')}
            aria-pressed={autoSend}
            aria-label={t('auto_send')}
          >
            <svg
              width="15"
              height="15"
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
            className="h-7 w-7 shrink-0 rounded-lg text-white/50 transition-all hover:text-red-400 hover:bg-red-500/10"
            title={t('ai_send_clear_all')}
            aria-label={t('ai_send_clear_all')}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            className="h-7 w-7 shrink-0 rounded-lg text-white/50 transition-all hover:text-white/70 hover:bg-white/[0.08]"
            title={t('ai_send_collapse')}
            aria-label={t('ai_send_collapse')}
            aria-expanded={isExpanded}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  )
}

export default memo(AiSendComposerHeader)
