import type { AiDraftImageItem } from '@app/providers/ai/types'

import { ImageIcon } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface AttachmentStripProps {
  images: AiDraftImageItem[]
}

/**
 * Visual confirmation of what is queued for the AI.
 *
 * Without this the composer only reported a count, so a queued page capture
 * looked identical to one that had silently failed to attach. Each thumbnail
 * uses the lightweight blob URL when present and falls back to the inline data
 * URL, which is what large captures use until their blob is synthesized.
 *
 * Read-only: the composer exposes a single "clear all" action, and per-item
 * removal would mean threading a new handler through the provider context.
 */
function AttachmentStrip({ images }: AttachmentStripProps) {
  const { t } = useTranslation()

  if (images.length === 0) return null

  return (
    <ul
      className="flex flex-wrap gap-2 px-4 pt-3"
      aria-label={t('ai_send_selected_images')}
      data-testid="ai-send-attachment-strip"
    >
      {images.map((image, index) => {
        const source = image.blobUrl || image.dataUrl
        const label = t('ai_send_image_item', { index: index + 1 })
        return (
          <li
            key={image.id}
            className="animate-app-enter border-border/60 bg-card h-16 w-16 overflow-hidden rounded-lg border shadow-2xs"
            title={label}
          >
            {source ? (
              <img
                src={source}
                alt={label}
                data-testid="ai-send-attachment-preview"
                className="h-full w-full object-cover"
              />
            ) : (
              // A blob URL is built asynchronously for large captures; show a
              // placeholder rather than a broken image while it resolves.
              <span
                className="text-muted-foreground flex h-full w-full items-center justify-center"
                data-testid="ai-send-attachment-pending"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="sr-only">{t('ai_send_image_ready')}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default memo(AttachmentStrip)
