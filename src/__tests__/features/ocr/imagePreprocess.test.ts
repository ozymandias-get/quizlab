import { grayscaleStretch } from '@features/ocr/lib/imagePreprocess'

import { describe, expect, it } from 'vitest'

function rgba(pixels: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return data
}

describe('grayscaleStretch', () => {
  it('maps a two-tone image to full black/white range', () => {
    // 50% mid-dark gray, 50% light gray — percentiles land exactly on them.
    const data = rgba([
      ...Array.from({ length: 50 }, () => [60, 60, 60] as [number, number, number]),
      ...Array.from({ length: 50 }, () => [200, 200, 200] as [number, number, number])
    ])
    grayscaleStretch(data)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(0)
    expect(data[2]).toBe(0)
    const last = data.length - 4
    expect(data[last]).toBe(255)
    expect(data[last + 1]).toBe(255)
    expect(data[last + 2]).toBe(255)
  })

  it('converts color pixels to luminance gray', () => {
    const data = rgba([
      ...Array.from({ length: 50 }, () => [255, 0, 0] as [number, number, number]),
      ...Array.from({ length: 50 }, () => [255, 255, 255] as [number, number, number])
    ])
    grayscaleStretch(data)
    // Every pixel is true gray after conversion.
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1])
      expect(data[i + 1]).toBe(data[i + 2])
    }
    // Red luminance (76) was the minimum, so it maps to black.
    expect(data[0]).toBe(0)
  })

  it('leaves uniform images untouched (no division by zero)', () => {
    const data = rgba([
      [100, 100, 100],
      [100, 100, 100]
    ])
    grayscaleStretch(data)
    expect(data[0]).toBe(100)
    expect(data[4]).toBe(100)
  })

  it('ignores empty input', () => {
    const data = new Uint8ClampedArray(0)
    expect(() => grayscaleStretch(data)).not.toThrow()
  })
})
