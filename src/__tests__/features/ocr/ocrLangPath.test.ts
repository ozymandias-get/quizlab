import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

// Fail worker creation while a bundled langPath is used (simulates a packaged
// build whose bundled file is missing); succeed for the CDN default.
let failBundledSource = false

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async (_lang: string, _oem: number, opts: { langPath?: string }) => {
    if (failBundledSource && opts?.langPath) {
      throw new Error('fetch local-ocr://tessdata failed')
    }
    return {
      setParameters: vi.fn(async () => {}),
      recognize: vi.fn(async () => ({ data: { text: 'hi', confidence: 90 } })),
      terminate: vi.fn(async () => {})
    } as unknown as never
  })
}))

import {
  createTesseractProvider,
  forceTerminateWorker,
  getBundledTessdataUrl,
  getOcrLangPathCandidates,
  OCR_BUNDLED_SCHEME_TESSDATA_URL
} from '@features/ocr/providers/tesseractProvider'
import { createWorker } from 'tesseract.js'

const balancedConfig = {
  language: 'en' as const,
  quality: 'balanced' as const,
  sensitivity: 'medium' as const,
  forceOcr: false
}

describe('tesseract language-data sources (offline exe fix)', () => {
  beforeEach(async () => {
    failBundledSource = false
    await forceTerminateWorker()
    vi.clearAllMocks()
  })

  it('prefers the bundled tessdata directory and keeps the CDN default as fallback', () => {
    const candidates = getOcrLangPathCandidates()
    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toContain('tessdata')
    expect(candidates[1]).toBeUndefined()
  })

  it('uses the local-ocr scheme for the bundled URL on file:// renderers', () => {
    // jsdom runs on http(s)://, so the default must be a same-origin URL…
    expect(getBundledTessdataUrl()).toContain('tessdata')
    expect(getBundledTessdataUrl()).not.toBe(OCR_BUNDLED_SCHEME_TESSDATA_URL)
    // …while the packaged constant targets the fetch-capable custom scheme.
    expect(OCR_BUNDLED_SCHEME_TESSDATA_URL).toBe('local-ocr://tessdata')
  })

  it('passes the bundled langPath to createWorker', async () => {
    const provider = createTesseractProvider()
    await provider.initialize(balancedConfig)

    expect(createWorker).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        corePath: expect.stringContaining('tesseract-core'),
        langPath: expect.stringContaining('tessdata'),
        gzip: true
      })
    )
    await forceTerminateWorker()
  })

  it('falls back to the CDN default when the bundled source fails', async () => {
    failBundledSource = true
    const provider = createTesseractProvider()
    await provider.initialize(balancedConfig)

    const calls = vi.mocked(createWorker).mock.calls
    // First attempts target the bundled directory…
    expect(calls[0]?.[2]).toEqual(
      expect.objectContaining({ langPath: expect.stringContaining('tessdata') })
    )
    // …the final (successful) attempt uses the CDN default (no langPath).
    const lastCall = calls[calls.length - 1]?.[2] as Record<string, unknown>
    expect(lastCall).not.toHaveProperty('langPath')
    await forceTerminateWorker()
  }, 30000)
})
