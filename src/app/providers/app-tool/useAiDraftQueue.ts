import { useCallback, useEffect, useRef, useState } from 'react'
import { Logger, reportSuppressedError } from '@shared/lib/logger'
import type { AiDraftItem, AiDraftImageItem } from '../ai/types'
import { buildPendingId, clearBrowserTextSelection } from './appToolUtils'

export type QueuedImageMeta = Partial<Pick<AiDraftImageItem, 'page' | 'captureKind'>>

const MAX_QUEUE_SIZE = 20

function revokeDraftItemBlob(item: AiDraftItem) {
  if (item.type === 'image' && item.blobUrl) {
    URL.revokeObjectURL(item.blobUrl)
  }
}

function revokeDraftBlobUrls(items: AiDraftItem[]) {
  for (const item of items) {
    revokeDraftItemBlob(item)
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

    const item: AiDraftItem = {
      id: buildPendingId('text'),
      type: 'text',
      text: normalized
    }

    setPendingAiItems((current) => [...current, item])
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
        const buf = new Uint8Array(byteString.length)
        for (let i = 0; i < byteString.length; i++) {
          buf[i] = byteString.charCodeAt(i)
        }
        blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
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
      const removed = current.find((item) => item.id === id)
      if (removed) revokeDraftItemBlob(removed)
      return current.filter((item) => item.id !== id)
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
