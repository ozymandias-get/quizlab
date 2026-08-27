import { ocrCache } from '@features/ocr/lib/ocrCache'
import type { OcrPageResult } from '@features/ocr/types'

import { beforeEach, describe, expect, it } from 'vitest'

function fakeResult(over: Partial<OcrPageResult> = {}): OcrPageResult {
  return {
    pageNumber: 1,
    documentId: 'doc1',
    markdown: '# Hello',
    plainText: 'Hello',
    language: 'auto',
    blocks: [{ text: 'Hello', kind: 'heading' }],
    tables: [],
    formulas: [],
    engine: 'hybrid',
    engineVersion: '1.0.0',
    createdAt: Date.now(),
    config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: false },
    isNativeText: true,
    readingOrder: 'single-column',
    ...over
  }
}

describe('ocrCache', () => {
  beforeEach(() => {
    localStorage.clear()
    ocrCache.clear()
  })

  it('sets and gets', () => {
    const r = fakeResult()
    ocrCache.set('ocr:v1:fp:1:hybrid:abc:1.0.0', r)
    const got = ocrCache.get('ocr:v1:fp:1:hybrid:abc:1.0.0')
    expect(got?.markdown).toBe('# Hello')
  })

  it('returns null for miss', () => {
    expect(ocrCache.get('missing')).toBeNull()
  })

  it('has works', () => {
    ocrCache.set('ocr:v1:fp:1:hybrid:abc:1.0.0', fakeResult())
    expect(ocrCache.has('ocr:v1:fp:1:hybrid:abc:1.0.0')).toBe(true)
    expect(ocrCache.has('other')).toBe(false)
  })

  it('clear removes all', () => {
    ocrCache.set('ocr:v1:fp:1:hybrid:abc:1.0.0', fakeResult())
    ocrCache.clear()
    expect(ocrCache.size()).toBe(0)
  })
})
