import { Logger, reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AiDraftImageItem, AiDraftItem } from '../ai/types'
import { buildPendingId, clearBrowserTextSelection } from './appToolUtils'

export type QueuedImageMeta = Partial<Pick<AiDraftImageItem, 'page' | 'captureKind'>>

const MAX_QUEUE_SIZE = 20

function revokeDraftItemBlob(draft: AiDraftItem) {
  if (draft.type === 'image' && draft.blobUrl) {
    URL.revokeObjectURL(draft.blobUrl)
  }
}

function revokeDraftBlobUrls(items: AiDraftItem[]) {
  for (const draft of items) {
    revokeDraftItemBlob(draft)
  }
}

export function useAiDraftQueue() {
  const [pendingAiItems, setPendingAiItems] = useState<AiDraftItem[]>([])

  const pendingAiItemsRef = useRef(pendingAiItems)
  pendingAiItemsRef.current = pendingAiItems

  useEffect(() => {
    return () => {
      revokeDraftBlobUrls(pendingAiItemsRef.current)
    }
  }, [])

  const queueTextForAi = useCallback((text: string) => {
    const normalized = text.trim()
    if (!normalized) {
      return
    }

    const draft: AiDraftItem = {
      id: buildPendingId('text'),
      type: 'text',
      text: normalized
    }

    setPendingAiItems((current) => [...current, draft])
  }, [])

  const queueImageForAi = useCallback((imageUri: string, imageMeta?: QueuedImageMeta) => {
    let blobUrl = ''
    let dataUrl: string | undefined

    if (imageUri.startsWith('blob:')) {
      blobUrl = imageUri
    } else if (imageUri.startsWith('data:image/')) {
      try {
        const byteString = atob(imageUri.split(',')[1])
        const mimeMatch = imageUri.match(/data:([^;]+);/)
        const mime = mimeMatch?.[1] ?? 'image/png'
        const bytes = Uint8Array.from(byteString, (c) => c.charCodeAt(0))
        blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
      } catch (err) {
        reportSuppressedError('draftQueue.imageBlobUrl', { cause: err })
        dataUrl = imageUri
      }
    } else {
      return
    }

    setPendingAiItems((current) => {
      if (current.length >= MAX_QUEUE_SIZE) {
        const dropped = current[0]
        revokeDraftItemBlob(dropped)
        Logger?.warn?.(`[DraftQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`)
        const trimmed = current.slice(1)
        return [
          ...trimmed,
          {
            id: buildPendingId('image'),
            type: 'image',
            ...(dataUrl ? { dataUrl } : {}),
            blobUrl,
            ...imageMeta
          }
        ]
      }
      return [
        ...current,
        {
          id: buildPendingId('image'),
          type: 'image',
          ...(dataUrl ? { dataUrl } : {}),
          blobUrl,
          ...imageMeta
        }
      ]
    })
  }, [])

  const removePendingAiItem = useCallback((id: string) => {
    setPendingAiItems((current) => {
      const removed = current.find((draft) => draft.id === id)
      if (removed) revokeDraftItemBlob(removed)
      return current.filter((draft) => draft.id !== id)
    })
  }, [])

  const clearPendingAiItems = useCallback(() => {
    clearBrowserTextSelection()
    setPendingAiItems((current) => {
      revokeDraftBlobUrls(current)
      return []
    })
  }, [])

  return {
    pendingAiItems,
    pendingAiItemsRef,
    setPendingAiItems,
    queueTextForAi,
    queueImageForAi,
    removePendingAiItem,
    clearPendingAiItems
  }
}
