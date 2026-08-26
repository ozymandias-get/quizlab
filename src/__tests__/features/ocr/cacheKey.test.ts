import { createDocumentFingerprint, createOcrCacheKey } from '@features/ocr/lib/cacheKey'
import { OCR_CACHE_SCHEMA_VERSION, OCR_ENGINE_VERSION } from '@features/ocr/types'

import { describe, expect, it } from 'vitest'

describe('createDocumentFingerprint', () => {
  it('creates stable fingerprint from file', () => {
    const f1 = createDocumentFingerprint({
      path: '/a/b.pdf',
      size: 12345,
      streamUrl: 'local-pdf://abc'
    })
    const f2 = createDocumentFingerprint({
      path: '/a/b.pdf',
      size: 12345,
      streamUrl: 'local-pdf://abc'
    })
    expect(f1).toBe(f2)
  })

  it('differs by size', () => {
    const a = createDocumentFingerprint({ path: '/a/b.pdf', size: 1 })
    const b = createDocumentFingerprint({ path: '/a/b.pdf', size: 2 })
    expect(a).not.toBe(b)
  })
})

describe('createOcrCacheKey', () => {
  it('produces versioned key', () => {
    const key = createOcrCacheKey({
      fingerprint: 'fp1',
      pageNumber: 3,
      engine: 'hybrid',
      config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: false }
    })
    expect(key).toContain(`ocr:v${OCR_CACHE_SCHEMA_VERSION}:`)
    expect(key).toContain(':3:')
    expect(key).toContain('hybrid')
    expect(key).toContain(OCR_ENGINE_VERSION)
  })

  it('different config yields different key', () => {
    const base = { fingerprint: 'fp', pageNumber: 1, engine: 'hybrid' } as const
    const k1 = createOcrCacheKey({
      ...base,
      config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: false }
    })
    const k2 = createOcrCacheKey({
      ...base,
      config: { language: 'tr', quality: 'balanced', sensitivity: 'medium', forceOcr: false }
    })
    expect(k1).not.toBe(k2)
  })

  it('different page yields different key', () => {
    const k1 = createOcrCacheKey({
      fingerprint: 'fp',
      pageNumber: 1,
      engine: 'hybrid',
      config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: false }
    })
    const k2 = createOcrCacheKey({
      fingerprint: 'fp',
      pageNumber: 2,
      engine: 'hybrid',
      config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: false }
    })
    expect(k1).not.toBe(k2)
  })
})
