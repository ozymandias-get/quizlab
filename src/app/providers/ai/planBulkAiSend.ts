import type { AiDraftItem } from './types'

export type BulkTextSegment = { kind: 'text'; payload: string }

export type BulkImageSegment = { kind: 'image'; dataUrl: string; promptText?: string }

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

/**
 * Builds ordered send segments from the user's queue: preserves text/image order,
 * merges consecutive text excerpts, and attaches the composer note only to the first segment.
 */
export function planBulkAiSend(pending: AiDraftItem[], composerNote?: string): BulkSegment[] {
  const segments: BulkSegment[] = []
  const normalizedNote = composerNote?.trim()
  let noteConsumed = false
  let textBuffer: string[] = []

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

  for (const item of pending) {
    if (item.type === 'text') {
      textBuffer.push(item.text)
    } else {
      const merged = mergeExcerpts(textBuffer)
      textBuffer = []
      const promptText = consumeNoteWith(merged)
      segments.push({ kind: 'image', dataUrl: item.dataUrl, promptText })
    }
  }

  const tail = mergeExcerpts(textBuffer)
  const tailPayload = consumeNoteWith(tail)
  if (tailPayload !== undefined && tailPayload.length > 0) {
    segments.push({ kind: 'text', payload: tailPayload })
  }

  return segments
}
