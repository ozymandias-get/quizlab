import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiDraftItem, AiDraftImageItem } from '../ai/types'
import { buildPendingId, clearBrowserTextSelection } from './appToolUtils'

export type QueuedImageMeta = Partial<Pick<AiDraftImageItem, 'page' | 'captureKind'>>

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

  const queueImageForAi = useCallback((dataUrl: string, imageMeta?: QueuedImageMeta) => {
    if (!dataUrl.startsWith('data:image/')) {
      return
    }

    let blobUrl: string | undefined
    try {
      const byteString = atob(dataUrl.split(',')[1])
      const mimeMatch = dataUrl.match(/data:([^;]+);/)
      const mime = mimeMatch?.[1] ?? 'image/png'
      const buf = new Uint8Array(byteString.length)
      for (let i = 0; i < byteString.length; i++) {
        buf[i] = byteString.charCodeAt(i)
      }
      blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
    } catch {}

    const item: AiDraftItem = {
      id: buildPendingId('image'),
      type: 'image',
      dataUrl,
      ...(blobUrl ? { blobUrl } : {}),
      ...imageMeta
    }

    setPendingAiItems((current) => [...current, item])
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
