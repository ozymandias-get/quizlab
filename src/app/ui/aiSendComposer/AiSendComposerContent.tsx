import type { PointerEventHandler } from 'react'
import { memo } from 'react'
import { Image as ImageIcon, Quote, X } from 'lucide-react'
import { useLanguage } from '@app/providers'
import { Button } from '@ui/components/button'
import type { AiDraftImageItem, AiDraftTextItem } from './types'

interface AiSendComposerContentProps {
    textItems: AiDraftTextItem[];
    imageItems: AiDraftImageItem[];
    totalItems: number;
    collapsed: boolean;
    noteText: string;
    isSubmitting: boolean;
    accentStrong: string;
    sectionSurface: string;
    cardSurface: string;
    footerSurface: string;
    textareaInsetShadow: string;
    bodyHeight: number;
    onRemoveItem: (id: string) => void;
    onNoteTextChange: (value: string) => void;
    onSubmit: (options?: { autoSend?: boolean }) => void;
    onResizeStart: PointerEventHandler<HTMLButtonElement>;
    onResizeMove: PointerEventHandler<HTMLButtonElement>;
    onResizeEnd: PointerEventHandler<HTMLButtonElement>;
}

function getImageLabel(
    item: AiDraftImageItem,
    index: number,
    t: (key: string, params?: Record<string, string>) => string
) {
    if (typeof item.page === 'number' && item.page > 0) {
        if (item.captureKind === 'selection') {
            return t('ai_send_page_selection_item', { page: String(item.page) })
        }

        return t('ai_send_page_item', { page: String(item.page) })
    }

    return t('ai_send_image_item', { index: String(index + 1) })
}

function AiSendComposerContent({
    textItems,
    imageItems,
    totalItems,
    collapsed,
    noteText,
    isSubmitting,
    accentStrong,
    sectionSurface,
    cardSurface,
    footerSurface,
    textareaInsetShadow,
    bodyHeight,
    onRemoveItem,
    onNoteTextChange,
    onSubmit,
    onResizeStart,
    onResizeMove,
    onResizeEnd
}: AiSendComposerContentProps) {
    const { t } = useLanguage()
    const hasNoteText = noteText.trim().length > 0

    if (collapsed) {
        return null
    }

    return (
        <>
                <div
                    className="relative overflow-y-auto space-y-3 px-4 pb-3 pt-3"
                    style={{ height: bodyHeight }}
                >
                    {textItems.length > 0 ? (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Quote className="h-3.5 w-3.5" style={{ color: accentStrong }} strokeWidth={2.1} />
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                                    {t('ai_send_selected_texts')}
                                </p>
                            </div>

                            <div className="space-y-2">
                                {textItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="group relative overflow-hidden rounded-[1.35rem] border px-3 py-2.5 transition-all duration-300 backdrop-blur-sm hover:bg-white/[0.02]"
                                        style={{
                                            borderColor: 'rgba(255,255,255,0.06)',
                                            background: cardSurface,
                                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        <div
                                            className="absolute inset-y-3 left-0 w-[3px] rounded-full opacity-80"
                                            style={{ background: accentStrong }}
                                        />
                                        <div className="mb-1 flex items-start justify-between gap-3">
                                            <span className="pl-2 pt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                                                {t('ai_send_selection_item', { index: String(index + 1) })}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveItem(item.id)}
                                                className="rounded-full border border-white/5 bg-white/[0.04] p-1 text-white/40 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
                                                title={t('ai_send_remove_item')}
                                            >
                                                <X className="h-3 w-3" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                        <p
                                            className="overflow-hidden pl-2 pr-1 text-[13px] leading-[1.6] text-white/80 font-medium"
                                            style={{
                                                display: '-webkit-box',
                                                WebkitBoxOrient: 'vertical',
                                                WebkitLineClamp: 3
                                            }}
                                        >
                                            {item.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {imageItems.length > 0 ? (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="h-3.5 w-3.5 text-emerald-300/90" strokeWidth={2.1} />
                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                                    {t('ai_send_selected_images')}
                                </p>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {imageItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="group relative min-w-[7.1rem] overflow-hidden rounded-[1.35rem] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg"
                                        style={{
                                            background: cardSurface,
                                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                                        }}
                                    >
                                        <img
                                            src={item.dataUrl}
                                            alt={t('ai_send_image_preview_alt')}
                                            className="h-[4.6rem] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 pb-2 pt-5">
                                            <div className="flex items-end justify-between gap-2">
                                                <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] text-white shadow-[0_8px_24px_-14px_rgba(0,0,0,0.9)] backdrop-blur-sm">
                                                    {getImageLabel(item, index, t)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveItem(item.id)}
                                                    className="rounded-full border border-white/[0.08] bg-white/[0.05] p-1 text-white/60 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-white/[0.15] hover:bg-white/[0.1] hover:text-white"
                                                    title={t('ai_send_remove_item')}
                                                >
                                                    <X className="h-3 w-3" strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <label className="block text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                                {t('ai_send_note_label')}
                            </label>
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                {t('ai_send_item_count', { count: String(totalItems) })}
                            </span>
                        </div>

                        <textarea
                            rows={3}
                            value={noteText}
                            onChange={(event) => onNoteTextChange(event.target.value)}
                            placeholder={imageItems.length > 0 ? t('ai_send_image_placeholder') : t('ai_send_text_placeholder')}
                            className="w-full resize-none rounded-[1.55rem] border border-white/[0.08] px-4 py-3.5 text-[13px] text-white outline-none transition-all duration-300 placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.02] focus:ring-4 focus:ring-white/[0.02]"
                            style={{
                                minHeight: 88,
                                background: sectionSurface,
                                boxShadow: `inset 0 1px 0 ${textareaInsetShadow}`
                            }}
                        />
                    </section>
                </div>

            <div
                className="relative flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3 backdrop-blur-xl"
                style={{ background: footerSurface }}
            >
                {hasNoteText ? (
                    <Button
                        onClick={() => onSubmit({ autoSend: true })}
                        disabled={isSubmitting || totalItems === 0}
                        variant="outline"
                        className="rounded-full border border-emerald-400/20 bg-emerald-500/12 px-4 py-2.5 text-[13px] font-medium text-emerald-100 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.45)] transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-500/18 active:scale-[0.98] disabled:scale-100 disabled:opacity-40"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {t('auto_send')}
                        </span>
                    </Button>
                ) : null}

                <Button
                    onClick={() => onSubmit()}
                    disabled={isSubmitting || totalItems === 0}
                    className="group rounded-full border-0 px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.6)] active:scale-[0.98] disabled:scale-100 disabled:opacity-40"
                    style={{
                        background: `linear-gradient(135deg, ${accentStrong}, rgba(255,255,255,0.18))`
                    }}
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {isSubmitting ? t('sending_to_ai') : t('send_to_ai')}
                    </span>
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10 group-active:opacity-20" />
                </Button>
            </div>

            <button
                type="button"
                onPointerDown={onResizeStart}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                className="absolute bottom-2 right-2 flex h-7 w-7 cursor-nwse-resize items-end justify-end rounded-full text-white/30 transition-colors hover:text-white/65"
                title={t('ai_send_resize')}
            >
                <span className="relative block h-4 w-4">
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-br-[0.55rem] border-b-2 border-r-2 border-current" />
                    <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-br-[0.45rem] border-b-2 border-r-2 border-current opacity-60" />
                </span>
            </button>
        </>
    )
}

export default memo(AiSendComposerContent)
