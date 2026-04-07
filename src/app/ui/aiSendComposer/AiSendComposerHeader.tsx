import { memo, type PointerEventHandler } from 'react'
import { Send, X } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'
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
  const { t } = useLanguageStrings()

  return (
    <div
      className="relative cursor-grab select-none touch-none px-5 pb-3.5 pt-3 active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="mb-3 flex justify-center">
        <div className="h-[5px] w-10 rounded-full bg-white/[0.16] shadow-[0_0_6px_rgba(255,255,255,0.06)] transition-all duration-200 hover:bg-white/[0.28] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-white/90">
            {t('ai_send_panel_title')}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums tracking-wide text-white/40">
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
              'h-[30px] rounded-full border px-3 text-[10.5px] font-semibold tracking-[0.06em] uppercase backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300',
              autoSend
                ? 'border-emerald-400/25 text-emerald-200/90 hover:border-emerald-400/35 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.3)]'
                : 'border-white/[0.09] text-white/50 hover:border-white/[0.15] hover:text-white/70 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.3)]'
            )}
            style={{
              background: autoSend
                ? 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(255,255,255,0.03) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)'
            }}
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
            className="h-[30px] w-[30px] shrink-0 rounded-full border border-white/[0.09] text-white/40 backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-white/[0.15] hover:text-white/70 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.3)]"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)' }}
            title={t('close')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
    </div>
  )
}

export default memo(AiSendComposerHeader)
