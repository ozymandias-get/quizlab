import { memo, type PointerEventHandler } from 'react'
import { Image as ImageIcon, Send, Type, X } from 'lucide-react'
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
      className="relative cursor-grab select-none touch-none px-5 pb-3 pt-3 active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="mb-3 flex justify-center">
        <div className="h-[5px] w-10 rounded-full bg-white/[0.16] shadow-[0_0_6px_rgba(255,255,255,0.06)] transition-all duration-200 hover:bg-white/[0.28] hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.04)_45%,rgba(0,0,0,0.12)_100%)] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-2xl backdrop-saturate-200">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.18] to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.05] blur-2xl" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-[linear-gradient(145deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_100%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_24px_rgba(0,0,0,0.22)]">
              <div className="absolute inset-[5px] rounded-xl bg-emerald-400/12 blur-[10px]" />
              <Send className="relative z-10 h-4 w-4 text-white/80" strokeWidth={2.2} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-ql-14 font-semibold tracking-[-0.015em] text-white">
                {t('ai_send_panel_title')}
              </p>
              <p className="mt-1 text-ql-12 tabular-nums tracking-ql-mono text-white/42">
                {`${textCount} ${t('ai_send_text_count_label')} / ${imageCount} ${t('ai_send_image_count_label')}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onToggleAutoSend}
              className={cn(
                'h-[31px] rounded-full border px-3 text-ql-10 font-semibold tracking-ql-micro uppercase backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300',
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
              className="h-[31px] w-[31px] shrink-0 rounded-full border border-white/[0.09] text-white/40 backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-white/[0.15] hover:text-white/70 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.3)]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)'
              }}
              title={t('close')}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-ql-10 font-semibold tracking-ql-chrome text-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <Type className="h-3 w-3 text-white/40" strokeWidth={2.1} />
            <span className="tabular-nums">{textCount}</span>
            <span>{t('ai_send_text_count_label')}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-ql-10 font-semibold tracking-ql-chrome text-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <ImageIcon className="h-3 w-3 text-emerald-300/70" strokeWidth={2.1} />
            <span className="tabular-nums">{imageCount}</span>
            <span>{t('ai_send_image_count_label')}</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
    </div>
  )
}

export default memo(AiSendComposerHeader)
