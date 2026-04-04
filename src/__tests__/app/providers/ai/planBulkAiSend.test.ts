import { describe, expect, it } from 'vitest'
import { planBulkAiSend } from '@app/providers/ai/planBulkAiSend'
import type { AiDraftItem } from '@app/providers/ai/types'

function text(id: string, t: string): AiDraftItem {
  return { id, type: 'text', text: t }
}

function image(id: string, dataUrl: string): AiDraftItem {
  return { id, type: 'image', dataUrl }
}

describe('planBulkAiSend', () => {
  it('merges consecutive text into one trailing text segment', () => {
    const pending: AiDraftItem[] = [text('1', 'a'), text('2', 'b')]
    expect(planBulkAiSend(pending, 'Note')).toEqual([
      { kind: 'text', payload: 'Note\n\na\n\n---\n\nb' }
    ])
  })

  it('puts composer note only on the first segment', () => {
    const pending: AiDraftItem[] = [
      text('1', 'before'),
      image('i', 'data:image/png;base64,x'),
      text('2', 'after')
    ]
    expect(planBulkAiSend(pending, 'Do this')).toEqual([
      { kind: 'image', dataUrl: 'data:image/png;base64,x', promptText: 'Do this\n\nbefore' },
      { kind: 'text', payload: 'after' }
    ])
  })

  it('splits multiple images with empty buffers between', () => {
    const pending: AiDraftItem[] = [
      image('a', 'data:image/png;base64,one'),
      image('b', 'data:image/png;base64,two')
    ]
    expect(planBulkAiSend(pending, 'Intro')).toEqual([
      { kind: 'image', dataUrl: 'data:image/png;base64,one', promptText: 'Intro' },
      { kind: 'image', dataUrl: 'data:image/png;base64,two', promptText: undefined }
    ])
  })
})
