import type { PointerEventHandler } from 'react'
import { memo } from 'react'
import { Send, X } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguage } from '@app/providers'
import { Button } from '@ui/components/button'

interface AiSendComposerHeaderProps {
    textCount: number;
    imageCount: number;
    autoSend: boolean;
    onToggleAutoSend: () => void;
    onClearAll: () => void;
    onDragStart: PointerEventHandler<HTMLDivElement>;
    onDragMove: PointerEventHandler<HTMLDivElement>;
    onDragEnd: PointerEventHandler<HTMLDivElement>;
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
            className="relative cursor-grab select-none touch-none border-b border-white/[0.06] px-4 py-3 active:cursor-grabbing backdrop-blur-md"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
        >
            <div className="mb-3.5 flex justify-center">
                <div className="h-1.5 w-10 rounded-full bg-white/10 transition-colors duration-300 hover:bg-white/20" />
            </div>

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-0.5">
                    <p className="truncate text-[15px] font-medium tracking-tight text-white/95">
                        {t('ai_send_panel_title')}
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-medium tracking-wide text-white/40">
                        {`${textCount} ${t('ai_send_text_count_label')} / ${imageCount} ${t('ai_send_image_count_label')}`}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={onToggleAutoSend}
                        className={cn(
                            'h-8 rounded-full border px-3 text-[11px] font-semibold tracking-[0.08em] uppercase shadow-sm backdrop-blur-md transition-all duration-300',
                            autoSend
                                ? 'border-emerald-400/30 bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/24'
                                : 'border-white/[0.08] bg-white/[0.02] text-white/65 hover:bg-white/[0.08] hover:text-white'
                        )}
                        title={autoSend ? t('auto_send_on') : t('auto_send_off')}
                    >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {t('auto_send')}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={onClearAll}
                        className="h-8 w-8 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.02] text-white/50 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/[0.08] hover:text-white"
                        title={t('close')}
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default memo(AiSendComposerHeader)
