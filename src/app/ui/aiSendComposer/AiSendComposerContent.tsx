import { memo, useCallback, useMemo, type KeyboardEvent, type PointerEventHandler } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, Loader2, Quote, Send, X, Zap } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import type { AiDraftItem, AiDraftImageItem } from '@app/providers/ai/types'
import { Button } from '@ui/components/button'

interface AiSendComposerContentProps {
  items: AiDraftItem[]
  totalItems: number
  collapsed: boolean
  noteText: string
  isSubmitting: boolean
  accentStrong: string
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

function getImagePreviewSrc(item: AiDraftImageItem) {
  return item.blobUrl ?? item.dataUrl
}

function AiSendComposerContent({
  items,
  totalItems,
  collapsed,
  noteText,
  isSubmitting,
  accentStrong,
  bodyHeight,
  onRemoveItem,
  onNoteTextChange,
  onSubmit,
  onResizeStart,
  onResizeMove,
  onResizeEnd
}: AiSendComposerContentProps) {
  const { t } = useLanguageStrings()
  const prefersReducedMotion = useReducedMotion()
  const hasNoteText = noteText.trim().length > 0
  const hasImages = useMemo(() => items.some((i) => i.type === 'image'), [items])

  const itemTransition = prefersReducedMotion ? ITEM_ENTER_REDUCED : ITEM_ENTER

  const handleNoteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) {
        return
      }
      if (event.key !== 'Enter') {
        return
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const ta = event.currentTarget
        const start = ta.selectionStart ?? 0
        const end = ta.selectionEnd ?? 0
        const v = ta.value
        const next = `${v.slice(0, start)}\n${v.slice(end)}`
        onNoteTextChange(next)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 1
        })
        return
      }

      if (isSubmitting) {
        event.preventDefault()
        return
      }

      if (totalItems === 0) {
        return
      }

      event.preventDefault()

      if (hasNoteText) {
        if (event.shiftKey) {
          onSubmit()
        } else {
          onSubmit({ forceAutoSend: true })
        }
        return
      }

      if (event.shiftKey) {
        onSubmit({ forceAutoSend: true })
        return
      }

      onSubmit()
    },
    [hasNoteText, isSubmitting, onNoteTextChange, onSubmit, totalItems]
  )

  if (collapsed) {
    return null
  }

  return (
    <>
      <div
        className="relative space-y-1.5 overflow-y-auto px-3 pb-1.5 pt-1.5"
        style={{ height: bodyHeight }}
      >
        {items.length > 1 ? (
          <motion.p
            className="text-[9px] font-medium tracking-wide text-white/30"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {t('ai_send_send_order_hint')}
          </motion.p>
        ) : null}

        <div className="space-y-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item, index) => {
              if (item.type === 'text') {
                const textOrdinal =
                  items.slice(0, index).filter((entry) => entry.type === 'text').length + 1

                return (
                  <motion.div
                    key={item.id}
                    initial={
                      prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            scale: 0.95,
                            x: -6,
                            transition: { duration: 0.14, ease: [0.32, 0, 0.67, 0] }
                          }
                    }
                    transition={itemTransition}
                    className="group relative overflow-hidden rounded-xl border border-white/[0.15] backdrop-blur-2xl transition-all duration-300 hover:border-white/[0.25]"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 48%, rgba(0,0,0,0.06) 100%)',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-[2px] rounded-l-xl"
                      style={{
                        background: `linear-gradient(180deg, ${accentStrong}, transparent)`,
                        boxShadow: `0 0 8px 1px ${accentStrong}`
                      }}
                    />
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className="flex items-center gap-1 pl-0.5">
                        <Quote
                          className="h-2 w-2"
                          style={{ color: accentStrong }}
                          strokeWidth={2}
                        />
                        <span className="text-[9px] font-semibold uppercase text-white/45">
                          {t('ai_send_selection_item', { index: String(textOrdinal) })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="rounded-full p-0.5 text-white/[0.45] transition-colors hover:text-white/75"
                        title={t('ai_send_remove_item')}
                      >
                        <X className="h-2.5 w-2.5" strokeWidth={2.2} />
                      </button>
                    </div>
                    <p
                      className="overflow-hidden px-2 pb-1.5 pl-2.5 text-ql-10 leading-snug text-white/70"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2
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

              const imageLabel = getImageLabel(item, imageIndex, t)

              return (
                <motion.div
                  key={item.id}
                  initial={
                    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.95,
                          x: -6,
                          transition: { duration: 0.14, ease: [0.32, 0, 0.67, 0] }
                        }
                  }
                  transition={itemTransition}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.15] backdrop-blur-2xl transition-all duration-300 hover:border-white/[0.25]"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 48%, rgba(0,0,0,0.06) 100%)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-white/[0.12] bg-black/20">
                      <img
                        src={getImagePreviewSrc(item)}
                        alt={imageLabel}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <ImageIcon className="h-2 w-2 text-emerald-400/70" strokeWidth={2} />
                        <span className="text-[9px] font-semibold uppercase text-white/45">
                          {imageLabel}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="ml-auto rounded-full p-0.5 text-white/[0.45] transition-colors hover:text-white/75"
                      title={t('ai_send_remove_item')}
                    >
                      <X className="h-2.5 w-2.5" strokeWidth={2.2} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <section>
          <div className="rounded-xl border border-white/[0.1] bg-[linear-gradient(145deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)] p-2">
            <div className="mb-1 flex items-center justify-between gap-1.5">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-white/45">
                {t('ai_send_note_label')}
              </label>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-px tabular-nums text-[9px] font-medium text-white/40">
                {t('ai_send_item_count', { count: String(totalItems) })}
              </span>
            </div>

            <textarea
              rows={2}
              value={noteText}
              onChange={(event) => onNoteTextChange(event.target.value)}
              onKeyDown={handleNoteKeyDown}
              placeholder={
                hasImages ? t('ai_send_image_placeholder') : t('ai_send_text_placeholder')
              }
              className="w-full resize-none rounded-lg border border-white/[0.12] px-2 py-1.5 text-ql-11 leading-snug text-white/85 outline-none backdrop-blur-2xl transition-all duration-300 placeholder:text-white/25 focus:border-white/[0.2]"
              style={{
                minHeight: 40,
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)'
              }}
            />
          </div>
        </section>
      </div>

      <div
        className="relative flex items-center justify-end gap-1 px-3 py-1.5 backdrop-blur-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
        }}
      >
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
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
                className="rounded-lg border border-emerald-400/25 px-2 py-1 text-ql-10 font-semibold text-emerald-100/90 transition-all duration-300 hover:border-emerald-400/35 active:scale-[0.97] disabled:opacity-35"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(255,255,255,0.03) 100%)'
                }}
              >
                <Zap className="mr-1 h-2.5 w-2.5 opacity-70" strokeWidth={2.2} aria-hidden />
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
          className="group relative overflow-hidden rounded-lg border border-white/[0.18] px-2.5 py-1.5 text-ql-10 font-semibold text-white backdrop-blur-2xl transition-all duration-300 hover:border-white/[0.28] active:scale-[0.97] disabled:opacity-35"
          style={{
            background: `linear-gradient(140deg, ${accentStrong} 0%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0.05) 100%)`,
            boxShadow: `inset 0 1px 1px rgba(255,255,255,0.15), 0 0 12px -4px ${accentStrong}, 0 4px 12px rgba(0,0,0,0.25)`
          }}
        >
          <span className="relative z-10 flex items-center gap-1">
            {isSubmitting ? (
              <>
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
                {t('sending_to_ai')}
              </>
            ) : (
              <>
                <Send className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
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
        className="absolute bottom-1 right-1 flex h-5 w-5 cursor-nwse-resize items-end justify-end rounded-full text-white/20 transition-colors duration-150 hover:text-white/45"
        title={t('ai_send_resize')}
      >
        <span className="relative block h-3 w-3">
          <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-br-[0.3rem] border-b-[1.5px] border-r-[1.5px] border-current" />
          <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-br-[0.25rem] border-b-[1.5px] border-r-[1.5px] border-current opacity-50" />
        </span>
      </button>
    </>
  )
}

export default memo(AiSendComposerContent)
