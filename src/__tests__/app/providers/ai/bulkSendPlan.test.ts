import { describe, expect, it } from 'vitest'

import { planSingleMessageSend } from '../../../../app/providers/ai/bulkSendPlan'
import type { AiDraftItem } from '../../../../app/providers/ai/types'

function textItem(id: string, text: string, page = 11): AiDraftItem {
  return {
    id,
    type: 'text',
    text,
    source: {
      docId: 'doc',
      page,
      totalPages: 59,
      captureKind: 'text-selection',
      createdAt: 1
    }
  }
}

function imageItem(id: string, page = 13): AiDraftItem {
  return {
    id,
    type: 'image',
    dataUrl: 'data:image/png;base64,AAA',
    source: {
      docId: 'doc',
      page,
      totalPages: 59,
      captureKind: 'area-image',
      createdAt: 1
    }
  }
}

describe('planSingleMessageSend', () => {
  it('returns null for empty input', () => {
    expect(planSingleMessageSend([])).toBeNull()
  })

  it('plans a single text with its source header', () => {
    const plan = planSingleMessageSend([textItem('t1', 'hello', 13)])
    expect(plan?.combinedBody).toBe('[PDF Kaynağı — Metin — Sayfa 13/59]\nhello')
    expect(plan?.itemIds).toEqual(['t1'])
    expect(plan?.images).toHaveLength(0)
  })

  it('plans three images as one message with three attachments', () => {
    const plan = planSingleMessageSend([
      imageItem('i1', 11),
      imageItem('i2', 12),
      imageItem('i3', 13)
    ])
    expect(plan?.images).toHaveLength(3)
    expect(plan?.images.map((i) => i.id)).toEqual(['i1', 'i2', 'i3'])
    expect(plan?.itemIds).toEqual(['i1', 'i2', 'i3'])
    // Görsel başlıkları gövdede ilişkilendirilmiş.
    expect(plan?.combinedBody).toContain('Sayfa 11/59')
    expect(plan?.combinedBody).toContain('Sayfa 12/59')
    expect(plan?.combinedBody).toContain('Sayfa 13/59')
  })

  it('preserves mixed text+image order', () => {
    const plan = planSingleMessageSend([
      textItem('t1', 'A', 11),
      imageItem('i1', 13),
      textItem('t2', 'B', 12)
    ])
    expect(plan?.orderedParts).toHaveLength(3)
    expect(plan?.itemIds).toEqual(['t1', 'i1', 't2'])
    // Sıra korunur: A, görsel başlığı, B.
    expect(plan?.orderedParts[0]).toContain('A')
    expect(plan?.orderedParts[1]).toContain('Görsel')
    expect(plan?.orderedParts[2]).toContain('B')
  })

  it('skips whitespace-only texts without reporting them as sent', () => {
    const plan = planSingleMessageSend([textItem('t1', '   '), textItem('t2', 'B', 12)])
    expect(plan?.itemIds).toEqual(['t2'])
  })

  it('keeps different pages associated with their content', () => {
    const plan = planSingleMessageSend([textItem('t1', 'A', 11), textItem('t2', 'B', 12)])
    expect(plan?.combinedBody).toContain('Sayfa 11/59')
    expect(plan?.combinedBody).toContain('Sayfa 12/59')
  })
})
