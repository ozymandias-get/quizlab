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
      className="relative cursor-grab select-none touch-none px-3 pb-1.5 pt-2 active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="mb-1.5 flex justify-center">
        <div className="h-[3px] w-7 rounded-full bg-white/[0.16] transition-all duration-200 hover:bg-white/[0.28]" />
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-[linear-gradient(145deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_100%)]">
            <Send className="relative z-10 h-3 w-3 text-white/80" strokeWidth={2.2} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-ql-11 font-semibold tracking-[-0.015em] text-white">
              {t('ai_send_panel_title')}
            </p>
            <p className="text-[9px] tabular-nums tracking-wide text-white/38">
              {textCount} {t('ai_send_text_count_label')} / {imageCount}{' '}
              {t('ai_send_image_count_label')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleAutoSend}
            className={cn(
              'h-[23px] rounded-full border px-2 text-[9px] font-semibold uppercase backdrop-blur-2xl transition-all duration-300',
              autoSend
                ? 'border-emerald-400/25 text-emerald-200/90 hover:border-emerald-400/35'
                : 'border-white/[0.09] text-white/50 hover:border-white/[0.15] hover:text-white/70'
            )}
            style={{
              background: autoSend
                ? 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(255,255,255,0.03) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)'
            }}
            title={autoSend ? t('auto_send_on') : t('auto_send_off')}
          >
            <Send className="mr-0.5 h-2 w-2 opacity-70" strokeWidth={2} />
            {t('auto_send')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="h-[23px] w-[23px] shrink-0 rounded-full border border-white/[0.09] text-white/40 transition-all duration-300 hover:border-white/[0.15] hover:text-white/70"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)'
            }}
            title={t('close')}
          >
            <X className="h-2.5 w-2.5" strokeWidth={2.2} />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
    </div>
  )
}

export default memo(AiSendComposerHeader)
