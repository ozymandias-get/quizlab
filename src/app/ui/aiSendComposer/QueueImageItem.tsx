import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, X, Maximize2 } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import type { AiDraftImageItem } from '@app/providers/ai/types'
import { getImageLabel, getImagePreviewSrc } from './useNoteKeyboardHandler'

const ITEM_ENTER = { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.55 }
const ITEM_ENTER_REDUCED = { duration: 0.15 }

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
            : { opacity: 0, x: -6, transition: { duration: 0.12 } }
        }
        transition={itemTransition}
        className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] transition-colors hover:border-white/[0.14]"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            type="button"
            onClick={handlePreview}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/[0.1] bg-black/30 transition-opacity hover:opacity-90"
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5 text-white/80" strokeWidth={2} />
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400/65" strokeWidth={2} />
              <span className="truncate text-[10px] font-medium text-white/60">{sourceLabel}</span>
            </div>
            <p className="mt-0.5 text-[9px] text-white/40">{t('ai_send_image_ready')}</p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="shrink-0 rounded-md p-1.5 text-white/40 transition-colors hover:text-red-400/80 hover:bg-red-500/10"
            title={t('ai_send_remove_item')}
            aria-label={t('ai_send_remove_item')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </motion.div>

      {showPreview && previewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label={t('ai_send_image_preview_alt')}
        >
          <div
            className="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-lg border border-white/[0.1] bg-[#0e1118] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-2 top-2 z-10 rounded-md bg-black/50 p-1 text-white/60 transition-colors hover:text-white"
              aria-label={t('close')}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <img
              src={previewUrl}
              alt={imageLabel}
              className="max-h-[75vh] max-w-[75vw] object-contain"
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
