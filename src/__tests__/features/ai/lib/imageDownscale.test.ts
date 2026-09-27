import {
  computeScale,
  estimateDataUrlBytes,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_DIMENSION,
  needsDownscale,
  prepareImageForUpload
} from '@features/ai/lib/imageDownscale'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

interface FakeCanvas {
  width: number
  height: number
}

/** Fake canvas surface: records the sizes it was asked to draw into. */
function stubCanvas(toDataURL: (type: string, quality?: number) => string) {
  const drawImage = vi.fn()
  const canvases: FakeCanvas[] = []
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') throw new Error(`unexpected element: ${tag}`)
    const canvas: FakeCanvas & Record<string, unknown> = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL
    }
    canvases.push(canvas)
    return canvas
  }) as unknown as typeof document.createElement)
  return { drawImage, canvases }
}

function stubBitmap(width: number, height: number) {
  const close = vi.fn()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close }))
  )
  return close
}

describe('estimateDataUrlBytes', () => {
  it('decodes the base64 payload length', () => {
    // 4 base64 chars -> 3 bytes
    expect(estimateDataUrlBytes('data:image/png;base64,AAAA')).toBe(3)
  })

  it('accounts for the data URL header', () => {
    const withoutComma = estimateDataUrlBytes('data:image/png;base64,QUJD')
    const withLongerHeader = estimateDataUrlBytes('data:image/jpeg;charset=utf-8;base64,QUJD')
    expect(withLongerHeader).toBe(withoutComma)
  })

  it('falls back to the whole string when there is no comma', () => {
    expect(estimateDataUrlBytes('abcd')).toBe(4)
  })
})

describe('needsDownscale', () => {
  it('leaves a small image alone', () => {
    expect(needsDownscale(1000, 800, 600)).toBe(false)
  })

  it('scales an image that exceeds the longest edge', () => {
    expect(needsDownscale(1000, MAX_UPLOAD_DIMENSION + 1, 600)).toBe(true)
  })

  it('scales an image that exceeds the byte budget', () => {
    expect(needsDownscale(MAX_UPLOAD_BYTES + 1, 800, 600)).toBe(true)
  })

  it('leaves an image exactly at the limits alone', () => {
    expect(needsDownscale(MAX_UPLOAD_BYTES, MAX_UPLOAD_DIMENSION, MAX_UPLOAD_DIMENSION)).toBe(false)
  })

  it('ignores images with unknown dimensions', () => {
    expect(needsDownscale(MAX_UPLOAD_BYTES + 1, 0, 0)).toBe(false)
  })
})

describe('computeScale', () => {
  it('never upscales a small image', () => {
    expect(computeScale(400, 300, MAX_UPLOAD_DIMENSION)).toBe(1)
  })

  it('scales the longest edge down to the limit', () => {
    expect(computeScale(4096, 2048, MAX_UPLOAD_DIMENSION)).toBe(0.5)
  })

  it('scales based on the vertical edge when it is longest', () => {
    expect(computeScale(2048, 4096, MAX_UPLOAD_DIMENSION)).toBe(0.5)
  })
})

describe('prepareImageForUpload', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a non-image source untouched', async () => {
    await expect(prepareImageForUpload('https://example.com/a.png')).resolves.toBe(
      'https://example.com/a.png'
    )
  })

  it('returns a within-budget image untouched without touching a canvas', async () => {
    const close = stubBitmap(800, 600)
    const createElement = vi.spyOn(document, 'createElement')

    await expect(prepareImageForUpload(PNG)).resolves.toBe(PNG)
    expect(createElement).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('downsizes an oversized capture to the dimension limit', async () => {
    stubBitmap(8000, 4000)
    const { drawImage, canvases } = stubCanvas(() => 'data:image/jpeg;base64,SMALL')

    const result = await prepareImageForUpload('data:image/png;base64,' + 'A'.repeat(1000))

    expect(result).toBe('data:image/jpeg;base64,SMALL')
    // 8000x4000 halved onto the 2048 longest-edge limit.
    expect(canvases[0]).toMatchObject({ width: MAX_UPLOAD_DIMENSION, height: 1024 })
    expect(drawImage).toHaveBeenCalledTimes(1)
  })

  it('returns the original when re-encoding does not shrink it', async () => {
    stubBitmap(8000, 4000)
    stubCanvas(() => 'data:image/jpeg;base64,' + 'Z'.repeat(2000))

    const original = 'data:image/png;base64,AAAA'
    await expect(prepareImageForUpload(original)).resolves.toBe(original)
  })

  it('returns the original when the canvas cannot be created', async () => {
    stubBitmap(8000, 4000)
    vi.spyOn(document, 'createElement').mockImplementation((() => ({
      width: 0,
      height: 0,
      getContext: () => null,
      toDataURL: () => ''
    })) as unknown as typeof document.createElement)

    const original = 'data:image/png;base64,AAAA'
    await expect(prepareImageForUpload(original)).resolves.toBe(original)
  })

  it('returns the original when encoding throws', async () => {
    stubBitmap(8000, 4000)
    stubCanvas(() => {
      throw new Error('tainted canvas')
    })

    const original = 'data:image/png;base64,AAAA'
    await expect(prepareImageForUpload(original)).resolves.toBe(original)
  })

  it('returns the original when bitmap decoding fails', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed')
      })
    )

    const original = 'data:image/png;base64,AAAA'
    await expect(prepareImageForUpload(original)).resolves.toBe(original)
  })
})
