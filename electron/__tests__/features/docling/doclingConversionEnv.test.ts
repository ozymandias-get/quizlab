import { describe, expect, it } from 'vitest'

import { buildConverterEnv } from '../../../features/docling/doclingConversionEnv.js'

describe('buildConverterEnv', () => {
  it('maps every pref to its env contract', () => {
    const env = buildConverterEnv({
      doOcr: true,
      ocrLang: 'en,tr',
      detectTables: true,
      fastTables: false,
      documentTimeout: 300,
      numThreads: 8
    })
    expect(env.DOCLING_DO_OCR).toBe('1')
    expect(env.DOCLING_OCR_LANG).toBe('en,tr')
    expect(env.DOCLING_FAST_TABLES).toBe('0')
    expect(env.DOCLING_DOCUMENT_TIMEOUT).toBe('300')
    expect(env.DOCLING_NUM_THREADS).toBe('8')
  })

  it('never forwards a GPU device – CPU-only build', () => {
    const env = buildConverterEnv({ device: 'cuda' } as never)
    expect(Object.keys(env)).not.toContain('DOCLING_DEVICE')
  })

  it('clamps hostile numeric values into shared bounds', () => {
    const env = buildConverterEnv({
      numThreads: 9999,
      ocrBatchSize: 0,
      layoutBatchSize: Number.NaN,
      tableBatchSize: 10_000,
      queueMaxSize: 999_999,
      imagesScale: 42,
      documentTimeout: 86_400
    })
    expect(env.DOCLING_NUM_THREADS).toBe('16')
    expect(env.DOCLING_OCR_BATCH_SIZE).toBe('1')
    expect(env.DOCLING_LAYOUT_BATCH_SIZE).toBe('4')
    expect(env.DOCLING_TABLE_BATCH_SIZE).toBe('16')
    expect(env.DOCLING_QUEUE_MAX_SIZE).toBe('500')
    expect(env.DOCLING_IMAGES_SCALE).toBe('3')
    // Document timeout can never exceed the shared hard cap (540s).
    expect(env.DOCLING_DOCUMENT_TIMEOUT).toBe('540')
  })

  it('treats non-positive timeouts as "no Docling-side timeout"', () => {
    expect(buildConverterEnv({ documentTimeout: 0 }).DOCLING_DOCUMENT_TIMEOUT).toBe('')
    expect(buildConverterEnv({ documentTimeout: null }).DOCLING_DOCUMENT_TIMEOUT).toBe('')
  })
})
