import { useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import type { AiDraftItem, AiDraftImageItem } from '@app/providers/ai/types'

interface UseNoteKeyboardHandlerOptions {
  hasNoteText: boolean
  isSubmitting: boolean
  totalItems: number
  onNoteTextChange: (value: string) => void
  onSubmit: (options?: { autoSend?: boolean; forceAutoSend?: boolean }) => void
}

export function useNoteKeyboardHandler({
  hasNoteText,
  isSubmitting,
  totalItems,
  onNoteTextChange,
  onSubmit
}: UseNoteKeyboardHandlerOptions) {
  return useCallback(
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
}

export function getImageLabel(
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

export function getImagePreviewSrc(item: AiDraftImageItem) {
  return item.blobUrl ?? item.dataUrl
}

interface QueueItemData {
  id: string
  type: 'text' | 'image'
  ordinal: number
}

export function useQueueItemOrdinals(items: AiDraftItem[]) {
  return useMemo(() => {
    const result: Map<string, QueueItemData> = new Map()

    let textOrdinal = 0
    let imageIndex = 0

    for (const item of items) {
      if (item.type === 'text') {
        textOrdinal += 1
        result.set(item.id, { id: item.id, type: 'text', ordinal: textOrdinal })
      } else {
        result.set(item.id, { id: item.id, type: 'image', ordinal: imageIndex })
        imageIndex += 1
      }
    }

    return result
  }, [items])
}
