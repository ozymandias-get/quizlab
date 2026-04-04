import { memo, type PointerEventHandler } from 'react'
import { Send, X } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguage } from '@app/providers'
import { Button } from '@ui/components/button'

interface AiSendComposerHeaderProps {
  textCount: number
  imageCount: number
  autoSend: boolean
  onToggleAutoSend: () => void
  onClearAll: () => void
  onDragStart: PointerEventHandler<HTMLDivElement>
  onDragMove: PointerEventHandler<HTMLDivElement>
  onDragEnd: PointerEventHandler<HTMLDivElement>
}

function AiSendComposerHeader({
  textCount,
  imageCount,
  autoSend,
  onToggleAutoSend,
  onClearAll,
  onDragStart,
  onDragMove,
  onDragEnd
}: AiSendComposerHeaderProps) {
  const { t } = useLanguage()

  return (
    <div
      className="relative cursor-grab select-none touch-none border-b border-white/[0.05] px-5 pb-3.5 pt-3 active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="mb-3 flex justify-center">
        <div className="h-[5px] w-9 rounded-full bg-white/[0.12] transition-colors duration-200 hover:bg-white/[0.22]" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-white/90">
            {t('ai_send_panel_title')}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums tracking-wide text-white/35">
            {`${textCount} ${t('ai_send_text_count_label')} / ${imageCount} ${t('ai_send_image_count_label')}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleAutoSend}
            className={cn(
              'h-[30px] rounded-full border px-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase transition-all duration-200',
              autoSend
                ? 'border-emerald-400/25 bg-emerald-500/14 text-emerald-200/90 hover:bg-emerald-500/22'
                : 'border-white/[0.07] bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white/70'
            )}
            title={autoSend ? t('auto_send_on') : t('auto_send_off')}
          >
            <Send className="mr-1.5 h-3 w-3 opacity-70" strokeWidth={2} />
            {t('auto_send')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="h-[30px] w-[30px] shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] text-white/40 transition-all duration-200 hover:bg-white/[0.07] hover:text-white/70"
            title={t('close')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(AiSendComposerHeader)
