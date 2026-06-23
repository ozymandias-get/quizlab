/**
 * Tests for planBulkAiSend — converts a list of queued drafts (text +
 * images) into ordered send segments. Consecutive text excerpts are
 * merged, and the composer note is attached only to the first segment.
 */
import { describe, expect, it } from 'vitest'

import { planBulkAiSend } from '../../../../app/providers/ai/planBulkAiSend'

function textItem(text: string) {
  return { id: `txt-${text.slice(0, 8)}`, type: 'text' as const, text }
}

function imageItem(dataUrl = 'data:image/png;base64,AAA') {
  return {
    id: `img-${dataUrl.slice(-6)}`,
    type: 'image' as const,
    dataUrl,
    blobUrl: undefined as string | undefined
  }
}

describe('planBulkAiSend - basic', () => {
  it('returns empty array for empty input', () => {
    expect(planBulkAiSend([])).toEqual([])
  })

  it('returns a single text segment for one text item', () => {
    const result = planBulkAiSend([textItem('hello')])
    expect(result).toEqual([{ kind: 'text', payload: 'hello' }])
  })

  it('returns a single image segment for one image item', () => {
    const result = planBulkAiSend([imageItem('data:AAA')])
    expect(result).toEqual([
      { kind: 'image', dataUrl: 'data:AAA', blobUrl: undefined, promptText: undefined }
    ])
  })

  it('preserves the order of mixed input', () => {
    const result = planBulkAiSend([textItem('A'), imageItem('data:X')])
    // Text gets merged into the image's promptText
    expect(result.length).toBe(1)
    expect(result[0].kind).toBe('image')
    if (result[0].kind === 'image') {
      expect(result[0].promptText).toBe('A')
    }
  })
})

describe('planBulkAiSend - text merging', () => {
  it('merges consecutive text excerpts into one segment with --- separator', () => {
    const result = planBulkAiSend([
      textItem('First excerpt'),
      textItem('Second excerpt'),
      textItem('Third excerpt')
    ])
    expect(result.length).toBe(1)
    expect(result[0]).toEqual({
      kind: 'text',
      payload: 'First excerpt\n\n---\n\nSecond excerpt\n\n---\n\nThird excerpt'
    })
  })

  it('trims whitespace from each excerpt', () => {
    const result = planBulkAiSend([textItem('  First  '), textItem('\n  Second  \n')])
    expect(result[0].kind).toBe('text')
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('First\n\n---\n\nSecond')
    }
  })

  it('skips empty text excerpts', () => {
    const result = planBulkAiSend([textItem('A'), textItem('   '), textItem(''), textItem('B')])
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('A\n\n---\n\nB')
    }
  })

  it('merges text across image boundaries only if adjacent', () => {
    // text, text, image, text, text → [image(promptText=A+B), text(C+D)]
    // (text before image is merged into the image's promptText)
    const result = planBulkAiSend([
      textItem('A'),
      textItem('B'),
      imageItem('data:X'),
      textItem('C'),
      textItem('D')
    ])
    expect(result.length).toBe(2)
    expect(result[0].kind).toBe('image')
    expect(result[1].kind).toBe('text')
    if (result[0].kind === 'image') {
      expect(result[0].promptText).toBe('A\n\n---\n\nB')
    }
    if (result[1].kind === 'text') {
      expect(result[1].payload).toBe('C\n\n---\n\nD')
    }
  })
})

describe('planBulkAiSend - composer note', () => {
  it('attaches the composer note to the first segment with a blank line', () => {
    const result = planBulkAiSend([textItem('A')], 'Note')
    expect(result[0].kind).toBe('text')
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('Note\n\nA')
    }
  })

  it('attaches the note to the first image segment if no text precedes it', () => {
    const result = planBulkAiSend([imageItem('data:X')], 'Note')
    expect(result[0].kind).toBe('image')
    if (result[0].kind === 'image') {
      expect(result[0].promptText).toBe('Note')
    }
  })

  it('attaches the note to the first image segment even if text comes after', () => {
    const result = planBulkAiSend([imageItem('data:X'), textItem('A')], 'Note')
    // image gets the note, text does not
    if (result[0].kind === 'image') {
      expect(result[0].promptText).toBe('Note')
    }
    if (result[1].kind === 'text') {
      expect(result[1].payload).toBe('A')
    }
  })

  it('does not attach the note to subsequent segments', () => {
    const result = planBulkAiSend([textItem('A'), textItem('B')], 'Note')
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('Note\n\nA\n\n---\n\nB')
    }
  })

  it('skips an empty/whitespace-only composer note', () => {
    const result = planBulkAiSend([textItem('A')], '   ')
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('A')
    }
  })

  it('skips an undefined composer note', () => {
    const result = planBulkAiSend([textItem('A')], undefined)
    if (result[0].kind === 'text') {
      expect(result[0].payload).toBe('A')
    }
  })
})

describe('planBulkAiSend - edge cases', () => {
  it('drops trailing empty text', () => {
    const result = planBulkAiSend([textItem('A'), textItem('')])
    expect(result.length).toBe(1)
  })

  it('only image items, no note → all images have no promptText', () => {
    const result = planBulkAiSend([imageItem('A'), imageItem('B')])
    expect(result.length).toBe(2)
    for (const seg of result) {
      if (seg.kind === 'image') {
        expect(seg.promptText).toBeUndefined()
      }
    }
  })

  it('only image items, with note → first image has note, others do not', () => {
    const result = planBulkAiSend([imageItem('A'), imageItem('B')], 'Note')
    if (result[0].kind === 'image') {
      expect(result[0].promptText).toBe('Note')
    }
    if (result[1].kind === 'image') {
      expect(result[1].promptText).toBeUndefined()
    }
  })

  it('preserves dataUrl and blobUrl on image segments', () => {
    const result = planBulkAiSend([imageItem('data:AAA')], undefined)
    if (result[0].kind === 'image') {
      expect(result[0].dataUrl).toBe('data:AAA')
    }
  })
})
