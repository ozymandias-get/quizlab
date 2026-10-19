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
  it.each([
    ['4 base64 chars decode to 3 bytes', 'data:image/png;base64,AAAA', 3],
    [
      'a longer header does not change the payload length',
      'data:image/jpeg;charset=utf-8;base64,QUJD',
      3
    ],
    ['a string with no comma falls back to its whole length', 'abcd', 4]
  ])('%s', (_case, dataUrl, expected) => {
    expect(estimateDataUrlBytes(dataUrl)).toBe(expected)
  })
})

describe('needsDownscale', () => {
  it.each([
    ['a small image is left alone', 1000, 800, 600, false],
    ['the longest edge over the limit scales', 1000, MAX_UPLOAD_DIMENSION + 1, 600, true],
    ['the byte budget over the limit scales', MAX_UPLOAD_BYTES + 1, 800, 600, true],
    [
      'an image exactly at both limits is left alone',
      MAX_UPLOAD_BYTES,
      MAX_UPLOAD_DIMENSION,
      MAX_UPLOAD_DIMENSION,
      false
    ],
    ['unknown dimensions are ignored', MAX_UPLOAD_BYTES + 1, 0, 0, false]
  ])('%s', (_case, bytes, w, h, expected) => {
    expect(needsDownscale(bytes, w, h)).toBe(expected)
  })
})

describe('computeScale', () => {
  it.each([
    ['a small image is never upscaled', 400, 300, 1],
    ['the horizontal edge sets the scale', 4096, 2048, 0.5],
    ['the vertical edge sets the scale when it is longest', 2048, 4096, 0.5]
  ])('%s', (_case, w, h, expected) => {
    expect(computeScale(w, h, MAX_UPLOAD_DIMENSION)).toBe(expected)
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

  // Every failure on the way to a re-encoded image must degrade to the
  // original bytes rather than throwing or uploading something broken.
  it.each([
    [
      're-encoding does not shrink the image',
      () => {
        stubBitmap(8000, 4000)
        stubCanvas(() => 'data:image/jpeg;base64,' + 'Z'.repeat(2000))
      }
    ],
    [
      'the canvas cannot be created',
      () => {
        stubBitmap(8000, 4000)
        vi.spyOn(document, 'createElement').mockImplementation((() => ({
          width: 0,
          height: 0,
          getContext: () => null,
          toDataURL: () => ''
        })) as unknown as typeof document.createElement)
      }
    ],
    [
      'encoding throws (tainted canvas)',
      () => {
        stubBitmap(8000, 4000)
        stubCanvas(() => {
          throw new Error('tainted canvas')
        })
      }
    ],
    [
      'bitmap decoding fails',
      () => {
        vi.stubGlobal(
          'createImageBitmap',
          vi.fn(async () => {
            throw new Error('decode failed')
          })
        )
      }
    ]
  ])('returns the original when %s', async (_case, arrange) => {
    arrange()

    const original = 'data:image/png;base64,AAAA'
    await expect(prepareImageForUpload(original)).resolves.toBe(original)
  })
})
