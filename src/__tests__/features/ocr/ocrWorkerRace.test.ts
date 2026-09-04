import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

// Mock tesseract.js dynamic import
const mockWorkers: { id: number; terminate: ReturnType<typeof vi.fn> }[] = []
let workerId = 0
let createWorkerShouldFail = false
let createWorkerFailCount = 0
let lastCreatedWorker: { setParameters: ReturnType<typeof vi.fn> } | null = null
let mockRecognizeResult = { text: 'hi', confidence: 90 }

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => {
    if (createWorkerFailCount > 0) {
      createWorkerFailCount--
      throw new Error('local worker failed transiently')
    }
    if (createWorkerShouldFail) throw new Error('local worker failed')
    const id = ++workerId
    const terminate = vi.fn(async () => {
      // simulate async termination delay
      await new Promise((r) => setTimeout(r, 20))
    })
    const w = {
      id,
      terminate,
      setParameters: vi.fn(async () => {}),
      recognize: vi.fn(async () => ({ data: { ...mockRecognizeResult } }))
    }
    lastCreatedWorker = w
    mockWorkers.push({ id, terminate })
    return w as unknown as never
  })
}))

import {
  createTesseractProvider,
  forceTerminateWorker
} from '@features/ocr/providers/tesseractProvider'
import { OcrError } from '@features/ocr/types'
import { createWorker } from 'tesseract.js'

describe('tesseract worker termination race', () => {
  beforeEach(async () => {
    mockWorkers.length = 0
    workerId = 0
    createWorkerShouldFail = false
    createWorkerFailCount = 0
    lastCreatedWorker = null
    mockRecognizeResult = { text: 'hi', confidence: 90 }
    // ensure any idle worker terminated
    await forceTerminateWorker()
    vi.clearAllMocks()
  })

  it('local worker failure throws TESSERACT_NOT_AVAILABLE without CDN fallback', async () => {
    createWorkerShouldFail = true
    const p = createTesseractProvider()
    await expect(
      p.initialize({
        language: 'auto',
        quality: 'balanced',
        sensitivity: 'medium',
        forceOcr: false
      })
    ).rejects.toMatchObject({
      code: 'TESSERACT_NOT_AVAILABLE'
    } as Partial<OcrError>)
    // Ensure no CDN fallback was attempted that would succeed — we threw
    createWorkerShouldFail = false
  })

  it('transient worker creation failures recover via retry', async () => {
    // Fail the first two attempts, succeed on the third (max attempts).
    createWorkerFailCount = 2
    const p = createTesseractProvider()
    await expect(
      p.initialize({
        language: 'auto',
        quality: 'balanced',
        sensitivity: 'medium',
        forceOcr: false
      })
    ).resolves.toBeUndefined()
    expect(mockWorkers.length).toBe(1)
    // The worker must load its core from the bundled local directory so the
    // page CSP (no CDN in script-src) does not block engine startup.
    expect(vi.mocked(createWorker)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        corePath: expect.stringContaining('tesseract-core')
      })
    )
    await forceTerminateWorker()
  }, 15000)

  it('region jobs use PSM SINGLE_BLOCK, page jobs use PSM AUTO', async () => {
    const provider = createTesseractProvider()
    const baseJob = {
      id: 'test',
      pageNumber: 1,
      documentId: 'd',
      documentFingerprint: 'f',
      config: {
        language: 'en' as const,
        quality: 'balanced' as const,
        sensitivity: 'medium' as const,
        forceOcr: true
      },
      signal: new AbortController().signal
    }
    const blob = new Blob(['fake'], { type: 'image/png' })

    await provider.processPage({ ...baseJob, kind: 'region' as const }, blob)
    expect(lastCreatedWorker?.setParameters).toHaveBeenCalledWith({
      tessedit_pageseg_mode: '6'
    })

    await provider.processPage({ ...baseJob, kind: 'page' as const }, blob)
    expect(lastCreatedWorker?.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: '3'
    })

    await forceTerminateWorker()
  })

  it('region jobs keep low-confidence text instead of throwing no-text', async () => {
    // Mirrors the reported case: confidence 62 under high sensitivity.
    mockRecognizeResult = { text: 'low confidence reading', confidence: 62 }
    const provider = createTesseractProvider()
    const baseJob = {
      id: 'test',
      pageNumber: 1,
      documentId: 'd',
      documentFingerprint: 'f',
      config: {
        language: 'en' as const,
        quality: 'balanced' as const,
        sensitivity: 'high' as const,
        forceOcr: true
      },
      signal: new AbortController().signal
    }
    const blob = new Blob(['fake'], { type: 'image/png' })

    const regionResult = await provider.processPage({ ...baseJob, kind: 'region' as const }, blob)
    expect(regionResult.plainText).toContain('low confidence reading')
    expect(regionResult.confidence).toBe(62)

    // Page jobs keep the previous throw-to-hybrid behavior.
    await expect(
      provider.processPage({ ...baseJob, kind: 'page' as const }, blob)
    ).rejects.toMatchObject({ code: 'NO_TEXT_RECOGNIZED' } as Partial<OcrError>)

    await forceTerminateWorker()
  })

  it('Job A timeout termination does not wipe Job B worker created concurrently', async () => {
    const providerA = createTesseractProvider()
    await providerA.initialize({
      language: 'en',
      quality: 'balanced',
      sensitivity: 'medium',
      forceOcr: false
    })
    // At this point mockWorkers[0] is W1
    expect(mockWorkers.length).toBe(1)
    const w1 = mockWorkers[0]!

    // Start async termination of W1 without awaiting (simulates timeout void)
    const terminatePromise = forceTerminateWorker()

    // Immediately create second provider/worker while termination in flight
    const providerB = createTesseractProvider()
    const initB = providerB.initialize({
      language: 'en',
      quality: 'balanced',
      sensitivity: 'medium',
      forceOcr: false
    })

    // Both terminations/creations interleave; await both
    await Promise.all([terminatePromise, initB])

    // Give termination delay time to complete
    await new Promise((r) => setTimeout(r, 30))

    // W1 should have been terminated once, W2 created
    expect(w1.terminate).toHaveBeenCalledTimes(1)
    expect(mockWorkers.length).toBe(2)
    const w2 = mockWorkers[1]!
    // W2 must not have been terminated by W1's cleanup
    expect(w2.terminate).not.toHaveBeenCalled()

    // ProviderB should still be usable — process should not throw due to null worker
    const job = {
      id: 'test',
      pageNumber: 1,
      documentId: 'd',
      documentFingerprint: 'f',
      config: {
        language: 'en' as const,
        quality: 'balanced' as const,
        sensitivity: 'medium' as const,
        forceOcr: true
      },
      signal: new AbortController().signal,
      kind: 'page' as const
    }
    // Mock image: need to pass Blob
    const blob = new Blob(['fake'], { type: 'image/png' })
    // Need to mock recognize to succeed — our mock already does
    const result = await providerB.processPage(job, blob)
    expect(result.markdown).toBeTruthy()

    await forceTerminateWorker()
  })
})
