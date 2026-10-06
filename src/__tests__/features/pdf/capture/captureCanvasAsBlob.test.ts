/**
 * Regression tests for the canvas serializer behind the capture ladder.
 *
 * The format switch is a memory guard: a >12 MP canvas serialised as PNG is both
 * enormous and slow, so the helper switches to JPEG at quality 0.95. The
 * comparison is strict (`>`), which puts the boundary cases — just below, exactly
 * at, and just above the threshold — on distinct code paths. They are pinned
 * here because the threshold is duplicated as a literal in
 * `usePdfCaptureActions`, and a drift between the two would silently change the
 * encoding format of every full-page capture.
 */
import { captureCanvasAsBlob } from '@features/pdf/capture/captureCanvasAsBlob'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The default threshold production uses; kept in sync via the observed calls. */
const THRESHOLD = 12_000_000

let calls: { type: string | undefined; quality: unknown }[]
let restoreObjectUrls: () => void

function stubToBlob(result: 'blob' | 'null' = 'blob') {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: unknown
  ) {
    calls.push({ type, quality })
    callback(result === 'blob' ? new Blob(['x'], { type: type ?? 'image/png' }) : null)
  })
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'width', { configurable: true, value: width })
  Object.defineProperty(canvas, 'height', { configurable: true, value: height })
  return canvas
}

describe('captureCanvasAsBlob', () => {
  beforeEach(() => {
    calls = []
    stubToBlob('blob')
    let counter = 0
    const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:captured-${++counter}`)
    })
    restoreObjectUrls = () => {
      if (original) Object.defineProperty(URL, 'createObjectURL', original)
      else delete (URL as unknown as Record<string, unknown>).createObjectURL
    }
  })

  afterEach(() => {
    restoreObjectUrls()
  })

  describe('format selection at the 12 MP boundary', () => {
    it('uses PNG without a quality argument below the threshold', async () => {
      // 3000x3999 = 11 997 000 px — one row under the threshold.
      const canvas = makeCanvas(3000, 3999)
      expect(canvas.width * canvas.height).toBeLessThan(THRESHOLD)

      const result = await captureCanvasAsBlob(canvas)

      expect(calls).toEqual([{ type: 'image/png', quality: undefined }])
      expect(result.blob.type).toBe('image/png')
    })

    it('still uses PNG exactly at the threshold, because the comparison is strict', async () => {
      const canvas = makeCanvas(3000, 4000)
      expect(canvas.width * canvas.height).toBe(THRESHOLD)

      const result = await captureCanvasAsBlob(canvas)

      expect(calls).toEqual([{ type: 'image/png', quality: undefined }])
      expect(result.blob.type).toBe('image/png')
    })

    it('switches to JPEG at 0.95 one pixel above the threshold', async () => {
      const canvas = makeCanvas(3000, 4001)
      expect(canvas.width * canvas.height).toBeGreaterThan(THRESHOLD)

      const result = await captureCanvasAsBlob(canvas)

      expect(calls).toEqual([{ type: 'image/jpeg', quality: 0.95 }])
      expect(result.blob.type).toBe('image/jpeg')
    })

    it('switches to JPEG for a large square canvas too', async () => {
      const canvas = makeCanvas(4000, 4000)

      await captureCanvasAsBlob(canvas)

      expect(calls).toEqual([{ type: 'image/jpeg', quality: 0.95 }])
    })

    it('honours an explicit maxCanvasArea instead of the default', async () => {
      const canvas = makeCanvas(3000, 4001) // over the default threshold

      await captureCanvasAsBlob(canvas, { maxCanvasArea: 50_000_000 })

      // A raised budget puts this canvas back on the PNG path.
      expect(calls).toEqual([{ type: 'image/png', quality: undefined }])
    })
  })

  describe('explicit option overrides', () => {
    it('lets an explicit mimeType win over the automatic choice', async () => {
      const canvas = makeCanvas(4000, 4000) // would default to JPEG

      await captureCanvasAsBlob(canvas, { mimeType: 'image/png' })

      expect(calls).toEqual([{ type: 'image/png', quality: 0.95 }])
    })

    it('lets an explicit quality win over the automatic choice', async () => {
      const canvas = makeCanvas(4000, 4000)

      await captureCanvasAsBlob(canvas, { quality: 0.5 })

      expect(calls).toEqual([{ type: 'image/jpeg', quality: 0.5 }])
    })
  })

  describe('serialization failure', () => {
    it('rejects rather than hanging when toBlob yields no blob', async () => {
      stubToBlob('null')
      const canvas = makeCanvas(100, 100)

      await expect(captureCanvasAsBlob(canvas)).rejects.toThrow('Canvas toBlob failed')
    })

    it('does not allocate an object url when serialization failed', async () => {
      stubToBlob('null')
      const createObjectURL = vi.fn()
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURL
      })

      await expect(captureCanvasAsBlob(makeCanvas(10, 10))).rejects.toThrow()

      expect(createObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('result shape', () => {
    it('returns the blob together with a fresh object url', async () => {
      const blob = new Blob(['payload'], { type: 'image/png' })
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
        this: HTMLCanvasElement,
        callback: BlobCallback
      ) {
        callback(blob)
      })

      const result = await captureCanvasAsBlob(makeCanvas(100, 100))

      expect(result.blob).toBe(blob)
      expect(result.blobUrl).toMatch(/^blob:/)
    })

    it('allocates a distinct object url per capture', async () => {
      const first = await captureCanvasAsBlob(makeCanvas(10, 10))
      const second = await captureCanvasAsBlob(makeCanvas(10, 10))

      expect(first.blobUrl).not.toBe(second.blobUrl)
    })
  })
})
