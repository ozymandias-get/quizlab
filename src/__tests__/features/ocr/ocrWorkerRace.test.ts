import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

// Mock tesseract.js dynamic import
const mockWorkers: { id: number; terminate: ReturnType<typeof vi.fn> }[] = []
let workerId = 0
let createWorkerShouldFail = false

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => {
    if (createWorkerShouldFail) throw new Error('local worker failed')
    const id = ++workerId
    const terminate = vi.fn(async () => {
      // simulate async termination delay
      await new Promise((r) => setTimeout(r, 20))
    })
    const w = {
      id,
      terminate,
      recognize: vi.fn(async () => ({ data: { text: 'hi', confidence: 90 } }))
    }
    mockWorkers.push({ id, terminate })
    return w as unknown as never
  })
}))

import {
  createTesseractProvider,
  forceTerminateWorker
} from '@features/ocr/providers/tesseractProvider'
import { OcrError } from '@features/ocr/types'

describe('tesseract worker termination race', () => {
  beforeEach(async () => {
    mockWorkers.length = 0
    workerId = 0
    createWorkerShouldFail = false
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
