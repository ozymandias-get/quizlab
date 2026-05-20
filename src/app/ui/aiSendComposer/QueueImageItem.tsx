import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, X, Maximize2 } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { getImageLabel, getImagePreviewSrc } from './useNoteKeyboardHandler'

const ITEM_ENTER = { type: 'spring' as const, stiffness: 500, damping: 32, mass: 0.5 }
const ITEM_ENTER_REDUCED = { duration: 0.12 }

interface QueueImageItemProps {
  item: AiDraftImageItem
  imageIndex: number
  onRemove: (id: string) => void
}

function QueueImageItem({ item, imageIndex, onRemove }: QueueImageItemProps) {
  const { t } = useLanguageStrings()
  const prefersReducedMotion = useReducedMotion()
  const itemTransition = prefersReducedMotion ? ITEM_ENTER_REDUCED : ITEM_ENTER
  const imageLabel = getImageLabel(item, imageIndex, t)
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handlePreview = useCallback(() => {
    const src = getImagePreviewSrc(item)
    if (src) {
      setPreviewUrl(src)
      setShowPreview(true)
    }
  }, [item])

  const closePreview = useCallback(() => {
    setShowPreview(false)
    setPreviewUrl(null)
  }, [])

  useEffect(() => {
    if (!showPreview) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      setPreviewUrl(null)
    }
  }, [showPreview, closePreview])

  const sourceLabel = useMemo(() => {
    if (typeof item.page === 'number' && item.page > 0) {
      return item.captureKind === 'selection'
        ? t('ai_send_page_selection_item', { page: String(item.page) })
        : t('ai_send_page_item', { page: String(item.page) })
    }
    return imageLabel
  }, [item.page, item.captureKind, imageLabel, t])

  return (
    <>
      <motion.div
        key={item.id}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, x: -6, transition: { duration: 0.1 } }
        }
        transition={itemTransition}
        className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05]"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="flex items-center gap-3.5 px-3.5 py-3">
          <button
            type="button"
            onClick={handlePreview}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-black/40 transition-all hover:scale-[1.03] hover:border-emerald-400/25"
            aria-label={t('ai_send_image_preview_alt')}
          >
            <img
              src={getImagePreviewSrc(item)}
              alt={imageLabel}
              className="h-full w-full object-cover"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <div className="rounded-lg bg-white/15 p-1.5 backdrop-blur-sm">
                <Maximize2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                <ImageIcon className="h-4 w-4 text-emerald-400" strokeWidth={2} />
              </div>
              <span className="truncate text-[11px] font-semibold text-white/90">
                {sourceLabel}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-white/60">{t('ai_send_image_ready')}</p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="shrink-0 rounded-lg p-2 text-white/45 transition-all hover:bg-red-500/12 hover:text-red-400"
            title={t('ai_send_remove_item')}
            aria-label={t('ai_send_remove_item')}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </motion.div>

      {showPreview && previewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label={t('ai_send_image_preview_alt')}
        >
          <div
            className="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0e1118] p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-3 top-3 z-10 rounded-xl bg-black/60 p-2 text-white/70 backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white"
              aria-label={t('close')}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            <img
              src={previewUrl}
              alt={imageLabel}
              className="max-h-[75vh] max-w-[75vw] rounded-lg object-contain"
              draggable={false}
              decoding="async"
            />
          </div>
        </div>
      )}
    </>
  )
}

export default memo(QueueImageItem)
