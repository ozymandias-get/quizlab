import type { AiDraftItem } from './types'

type BulkTextSegment = { kind: 'text'; payload: string; itemIds: string[] }

type BulkImageSegment = {
  kind: 'image'
  dataUrl?: string
  blobUrl?: string
  promptText?: string
  itemIds: string[]
}

export type BulkSegment = BulkTextSegment | BulkImageSegment

function mergeExcerpts(texts: string[]): string | undefined {
  const trimmed = texts.map((t) => t.trim()).filter(Boolean)
  if (trimmed.length === 0) {
    return undefined
  }
  if (trimmed.length === 1) {
    return trimmed[0]
  }
  return trimmed.join('\n\n---\n\n')
}

// Only ids of drafts that actually contribute content count as sent; a
// whitespace-only text draft is consumed by the plan but should never be
// reported as delivered.
function contributingIds(buffer: { id: string; text: string }[]): string[] {
  return buffer.filter((entry) => entry.text.trim().length > 0).map((entry) => entry.id)
}

/**
 * Builds ordered send segments from the user's queue: preserves text/image order,
 * merges consecutive text excerpts, and attaches the composer note only to the first segment.
 */
export function planBulkAiSend(pending: AiDraftItem[], composerNote?: string): BulkSegment[] {
  const segments: BulkSegment[] = []
  const normalizedNote = composerNote?.trim()
  let noteConsumed = false
  let textBuffer: { id: string; text: string }[] = []

  const consumeNoteWith = (text: string | undefined): string | undefined => {
    if (!noteConsumed && normalizedNote) {
      noteConsumed = true
      if (text) {
        return `${normalizedNote}\n\n${text}`
      }
      return normalizedNote
    }
    return text
  }

  for (const draft of pending) {
    if (draft.type === 'text') {
      textBuffer.push({ id: draft.id, text: draft.text })
    } else {
      const mergedTexts = textBuffer.map((entry) => entry.text)
      const bufferedIds = contributingIds(textBuffer)
      const merged = mergeExcerpts(mergedTexts)
      textBuffer = []
      const promptText = consumeNoteWith(merged)
      segments.push({
        kind: 'image',
        dataUrl: draft.dataUrl,
        blobUrl: draft.blobUrl,
        promptText,
        itemIds: [...bufferedIds, draft.id]
      })
    }
  }

  const tail = mergeExcerpts(textBuffer.map((entry) => entry.text))
  const tailPayload = consumeNoteWith(tail)
  if (tailPayload !== undefined && tailPayload.length > 0) {
    segments.push({ kind: 'text', payload: tailPayload, itemIds: contributingIds(textBuffer) })
  }

  return segments
}
