import { Logger, reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { PdfSourceMeta } from '../ai/pdfSource'
import type { AiDraftImageItem, AiDraftItem, SelectionPosition } from '../ai/types'
import { buildPendingId, clearBrowserTextSelection } from './appToolUtils'

export type QueuedImageMeta = Partial<Pick<AiDraftImageItem, 'page' | 'captureKind'>> & {
  source?: PdfSourceMeta | null
}

export interface QueuedTextMeta {
  source?: PdfSourceMeta | null
}

export const MAX_DRAFT_QUEUE_SIZE = 20
const MAX_QUEUE_SIZE = MAX_DRAFT_QUEUE_SIZE

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
  const pendingDraftIdsRef = useRef(new Set<string>())

  const pendingAiItemsRef = useRef(pendingAiItems)
  pendingAiItemsRef.current = pendingAiItems

  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    const pendingDraftIds = pendingDraftIdsRef.current
    return () => {
      revokeDraftBlobUrls(pendingAiItemsRef.current)
      pendingDraftIds.clear()
    }
  }, [])

  const queueTextForAi = useCallback(
    (
      text: string,
      position?: SelectionPosition | null,
      meta?: QueuedTextMeta | PdfSourceMeta | null
    ) => {
      const normalized = text.trim()
      if (!normalized) {
        return
      }

      // Üçüncü argüman hem { source } hem de doğrudan PdfSourceMeta olabilir.
      const source =
        meta && typeof meta === 'object' && 'page' in meta && 'docId' in meta
          ? (meta as PdfSourceMeta)
          : ((meta as QueuedTextMeta | null)?.source ?? null)

      const draft: AiDraftItem = {
        id: buildPendingId('text'),
        type: 'text',
        text: normalized,
        position: position ?? null,
        source,
        createdAt: Date.now()
      }

      setPendingAiItems((current) => {
        if (current.length >= MAX_QUEUE_SIZE) {
          const dropped = current[0]
          pendingDraftIdsRef.current.delete(dropped.id)
          revokeDraftItemBlob(dropped)
          Logger?.warn?.(`[DraftQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`)
          onDropRef.current?.()
          return [...current.slice(1), draft]
        }
        return [...current, draft]
      })
    },
    []
  )

  const queueImageForAi = useCallback((imageUri: string, imageMeta?: QueuedImageMeta) => {
    const draftId = buildPendingId('image')
    pendingDraftIdsRef.current.add(draftId)
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
          // Large captures: decode locally instead of fetch(data:) — fetch is
          // blocked by connect-src (no data: source) under Electron's CSP.
          // Async via microtask to avoid blocking the queue update on huge images.
          void Promise.resolve()
            .then(() => {
              const largeBase64 = imageUri.split(',')[1] ?? ''
              const largeMimeMatch = imageUri.match(/data:([^;]+);/)
              const largeMime = largeMimeMatch?.[1] ?? 'image/png'
              const largeBinary = atob(largeBase64)
              const largeLen = largeBinary.length
              const largeBytes = new Uint8Array(largeLen)
              for (let i = 0; i < largeLen; i++) largeBytes[i] = largeBinary.charCodeAt(i)
              return URL.createObjectURL(new Blob([largeBytes], { type: largeMime }))
            })
            .then((url) => {
              if (!pendingDraftIdsRef.current.has(draftId)) {
                URL.revokeObjectURL(url)
                return
              }
              setPendingAiItems((current) =>
                current.map((item) => (item.id === draftId ? { ...item, blobUrl: url } : item))
              )
            })
            .catch((err) => {
              // The composer renders a placeholder until blobUrl resolves, so a
              // failure here is only visible as a missing thumbnail. Report it
              // instead of swallowing it; the inline dataUrl still sends fine.
              reportSuppressedError('draftQueue.imageBlobUrlLarge', { cause: err })
            })
        }
      } catch (err) {
        reportSuppressedError('draftQueue.imageBlobUrl', { cause: err })
        // Keep dataUrl, leave blobUrl empty — send path will use dataUrl directly
        blobUrl = ''
      }
    } else {
      pendingDraftIdsRef.current.delete(draftId)
      return
    }

    setPendingAiItems((current) => {
      if (current.length >= MAX_QUEUE_SIZE) {
        const dropped = current[0]
        pendingDraftIdsRef.current.delete(dropped.id)
        revokeDraftItemBlob(dropped)
        Logger?.warn?.(`[DraftQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`)
        onDropRef.current?.()
        const trimmed = current.slice(1)
        return [
          ...trimmed,
          {
            id: draftId,
            type: 'image',
            ...(dataUrl ? { dataUrl } : {}),
            blobUrl,
            ...imageMeta,
            source: imageMeta?.source ?? null,
            createdAt: Date.now()
          }
        ]
      }
      return [
        ...current,
        {
          id: draftId,
          type: 'image',
          ...(dataUrl ? { dataUrl } : {}),
          blobUrl,
          ...imageMeta,
          source: imageMeta?.source ?? null,
          createdAt: Date.now()
        }
      ]
    })
  }, [])

  const removePendingAiItem = useCallback((id: string) => {
    setPendingAiItems((current) => {
      const removed = current.find((draft) => draft.id === id)
      if (removed) {
        pendingDraftIdsRef.current.delete(id)
        revokeDraftItemBlob(removed)
      }
      return current.filter((draft) => draft.id !== id)
    })
  }, [])

  const clearPendingAiItems = useCallback(() => {
    clearBrowserTextSelection()
    setPendingAiItems((current) => {
      revokeDraftBlobUrls(current)
      pendingDraftIdsRef.current.clear()
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
