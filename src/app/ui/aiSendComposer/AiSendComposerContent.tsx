import { memo, useMemo, type PointerEventHandler } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, Loader2, Quote, Send, X, Zap } from 'lucide-react'
import { useLanguage } from '@app/providers'
import type { AiDraftItem, AiDraftImageItem } from '@app/providers/ai/types'
import { Button } from '@ui/components/button'

interface AiSendComposerContentProps {
  items: AiDraftItem[]
  totalItems: number
  collapsed: boolean
  noteText: string
  isSubmitting: boolean
  accentStrong: string
  sectionSurface: string
  cardSurface: string
  footerSurface: string
  textareaInsetShadow: string
  bodyHeight: number
  onRemoveItem: (id: string) => void
  onNoteTextChange: (value: string) => void
  onSubmit: (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => void
  onResizeStart: PointerEventHandler<HTMLButtonElement>
  onResizeMove: PointerEventHandler<HTMLButtonElement>
  onResizeEnd: PointerEventHandler<HTMLButtonElement>
}

function getImageLabel(
  item: AiDraftImageItem,
  imageIndex: number,
  t: (key: string, params?: Record<string, string>) => string
) {
  if (typeof item.page === 'number' && item.page > 0) {
    if (item.captureKind === 'selection') {
      return t('ai_send_page_selection_item', { page: String(item.page) })
    }

    return t('ai_send_page_item', { page: String(item.page) })
  }

  return t('ai_send_image_item', { index: String(imageIndex + 1) })
}

const ITEM_ENTER = { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.55 }
const ITEM_ENTER_REDUCED = { duration: 0.15 }

function AiSendComposerContent({
  items,
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
  const prefersReducedMotion = useReducedMotion()
  const hasNoteText = noteText.trim().length > 0
  const hasImages = useMemo(() => items.some((i) => i.type === 'image'), [items])

  const itemTransition = prefersReducedMotion ? ITEM_ENTER_REDUCED : ITEM_ENTER

  if (collapsed) {
    return null
  }

  return (
    <>
      <div
        className="relative space-y-2.5 overflow-y-auto px-5 pb-3 pt-3"
        style={{ height: bodyHeight }}
      >
        {items.length > 1 ? (
          <motion.p
            className="text-[10px] font-medium tracking-wide text-white/30"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {t('ai_send_send_order_hint')}
          </motion.p>
        ) : null}

        <div className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item, index) => {
              if (item.type === 'text') {
                const textOrdinal =
                  items.slice(0, index).filter((entry) => entry.type === 'text').length + 1

                return (
                  <motion.div
                    key={item.id}
                    initial={
                      prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            scale: 0.95,
                            x: -8,
                            transition: { duration: 0.16, ease: [0.32, 0, 0.67, 0] }
                          }
                    }
                    transition={itemTransition}
                    className="group relative overflow-hidden rounded-xl border border-white/[0.05] transition-colors duration-200 hover:border-white/[0.09]"
                    style={{
                      background: cardSurface,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-[2.5px] opacity-70"
                      style={{ background: accentStrong }}
                    />
                    <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-2.5">
                      <span className="flex items-center gap-1.5 pl-1">
                        <Quote
                          className="h-3 w-3 opacity-60"
                          style={{ color: accentStrong }}
                          strokeWidth={2}
                        />
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                          {t('ai_send_selection_item', { index: String(textOrdinal) })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="rounded-full p-1 text-white/25 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/60"
                        title={t('ai_send_remove_item')}
                      >
                        <X className="h-3 w-3" strokeWidth={2.2} />
                      </button>
                    </div>
                    <p
                      className="overflow-hidden px-3 pb-2.5 pl-4 text-[12.5px] leading-[1.55] text-white/65"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 3
                      }}
                    >
                      {item.text}
                    </p>
                  </motion.div>
                )
              }

              const imageIndex = items
                .slice(0, index)
                .filter((entry) => entry.type === 'image').length

              return (
                <motion.div
                  key={item.id}
                  initial={
                    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.95,
                          x: -8,
                          transition: { duration: 0.16, ease: [0.32, 0, 0.67, 0] }
                        }
                  }
                  transition={itemTransition}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.05] transition-colors duration-200 hover:border-white/[0.09]"
                  style={{
                    background: cardSurface,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
                  }}
                >
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <ImageIcon className="h-3 w-3 text-emerald-400/70" strokeWidth={2} />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      {getImageLabel(item, imageIndex, t)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="ml-auto rounded-full p-1 text-white/25 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/60"
                      title={t('ai_send_remove_item')}
                    >
                      <X className="h-3 w-3" strokeWidth={2.2} />
                    </button>
                  </div>
                  <div className="overflow-hidden border-t border-white/[0.04]">
                    <img
                      src={item.blobUrl ?? item.dataUrl}
                      alt={t('ai_send_image_preview_alt')}
                      className="h-[4.2rem] w-full object-cover transition-transform duration-400 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {t('ai_send_note_label')}
            </label>
            <span className="tabular-nums text-[10px] font-medium text-white/30">
              {t('ai_send_item_count', { count: String(totalItems) })}
            </span>
          </div>

          <textarea
            rows={3}
            value={noteText}
            onChange={(event) => onNoteTextChange(event.target.value)}
            placeholder={hasImages ? t('ai_send_image_placeholder') : t('ai_send_text_placeholder')}
            className="w-full resize-none rounded-xl border border-white/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-white/85 outline-none transition-all duration-200 placeholder:text-white/25 focus:border-white/[0.12] focus:ring-2 focus:ring-white/[0.04]"
            style={{
              minHeight: 80,
              background: sectionSurface,
              boxShadow: `inset 0 1px 0 ${textareaInsetShadow}`
            }}
          />
        </section>
      </div>

      <div
        className="relative flex items-center justify-end gap-2 border-t border-white/[0.05] px-5 py-3"
        style={{ background: footerSurface }}
      >
        <AnimatePresence initial={false}>
          {hasNoteText ? (
            <motion.div
              key="auto-send-btn"
              initial={{ opacity: 0, scale: 0.9, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 'auto' }}
              exit={{ opacity: 0, scale: 0.9, width: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onSubmit({ forceAutoSend: true })
                }}
                disabled={isSubmitting || totalItems === 0}
                variant="outline"
                aria-label={t('auto_send')}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.1] px-3.5 py-2 text-[12px] font-semibold text-emerald-100/90 transition-all duration-200 hover:bg-emerald-500/[0.18] active:scale-[0.97] disabled:opacity-35"
              >
                <Zap className="mr-1.5 h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
                {t('auto_send')}
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onSubmit()
          }}
          disabled={isSubmitting || totalItems === 0}
          aria-label={isSubmitting ? t('sending_to_ai') : t('send_to_ai')}
          className="group relative overflow-hidden rounded-xl border border-white/[0.08] px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)] active:scale-[0.97] disabled:opacity-35"
          style={{
            background: `linear-gradient(140deg, ${accentStrong}, rgba(255,255,255,0.12))`
          }}
        >
          <span className="relative z-10 flex items-center gap-1.5">
            {isSubmitting ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  strokeWidth={2}
                  aria-hidden
                />
                {t('sending_to_ai')}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                {t('send_to_ai')}
              </>
            )}
          </span>
        </Button>
      </div>

      <button
        type="button"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        className="absolute bottom-1.5 right-1.5 flex h-6 w-6 cursor-nwse-resize items-end justify-end rounded-full text-white/20 transition-colors duration-150 hover:text-white/45"
        title={t('ai_send_resize')}
      >
        <span className="relative block h-3.5 w-3.5">
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-br-[0.4rem] border-b-[1.5px] border-r-[1.5px] border-current" />
          <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-br-[0.35rem] border-b-[1.5px] border-r-[1.5px] border-current opacity-50" />
        </span>
      </button>
    </>
  )
}

export default memo(AiSendComposerContent)
