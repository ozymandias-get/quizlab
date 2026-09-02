import { Logger, reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AiDraftImageItem, AiDraftItem, SelectionPosition } from '../ai/types'
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

export function useAiDraftQueue(onDrop?: () => void) {
  const [pendingAiItems, setPendingAiItems] = useState<AiDraftItem[]>([])

  const pendingAiItemsRef = useRef(pendingAiItems)
  pendingAiItemsRef.current = pendingAiItems

  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    return () => {
      revokeDraftBlobUrls(pendingAiItemsRef.current)
    }
  }, [])

  const queueTextForAi = useCallback((text: string, position?: SelectionPosition | null) => {
    const normalized = text.trim()
    if (!normalized) {
      return
    }

    const draft: AiDraftItem = {
      id: buildPendingId('text'),
      type: 'text',
      text: normalized,
      position: position ?? null
    }

    setPendingAiItems((current) => [...current, draft])
  }, [])

  const queueImageForAi = useCallback((imageUri: string, imageMeta?: QueuedImageMeta) => {
    let blobUrl = ''
    let dataUrl: string | undefined

    if (imageUri.startsWith('blob:')) {
      blobUrl = imageUri
      // Keep a dataUrl copy for direct send without fetch if possible — will be
      // lazily resolved via blobUrlToDataUrl at send time if needed. For
      // robustness we keep blobUrl as primary and let the send path fetch it.
    } else if (imageUri.startsWith('data:image/')) {
      // Keep original dataUrl for direct send; also create a lightweight
      // blobUrl for preview rendering to avoid large base64 strings in the DOM.
      dataUrl = imageUri
      try {
        const base64 = imageUri.split(',')[1] ?? ''
        const mimeMatch = imageUri.match(/data:([^;]+);/)
        const mime = mimeMatch?.[1] ?? 'image/png'
        if (base64.length < 2_000_000) {
          const binary = atob(base64)
          const len = binary.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
          blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
        } else {
          void fetch(imageUri)
            .then((res) => res.blob())
            .then((blob) => {
              const url = URL.createObjectURL(blob)
              setPendingAiItems((current) =>
                current.map((item) =>
                  item.type === 'image' && item.dataUrl === imageUri
                    ? { ...item, blobUrl: url }
                    : item
                )
              )
            })
            .catch(() => {})
        }
      } catch (err) {
        reportSuppressedError('draftQueue.imageBlobUrl', { cause: err })
        // Keep dataUrl, leave blobUrl empty — send path will use dataUrl directly
        blobUrl = ''
      }
    } else {
      return
    }

    setPendingAiItems((current) => {
      if (current.length >= MAX_QUEUE_SIZE) {
        const dropped = current[0]
        revokeDraftItemBlob(dropped)
        Logger?.warn?.(`[DraftQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`)
        onDropRef.current?.()
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
