/**
 * Pure pixel operations for OCR capture preprocessing.
 *
 * Dependency-free Canvas2D inputs: callers pass the raw RGBA buffer from
 * getImageData, this module mutates it in place. Monotonic transforms only
 * (information-preserving) so preprocessing can never destroy readable text.
 */

/** Histogram percentiles used for contrast stretching (outlier-robust). */
const STRETCH_LOW_Q = 0.01
const STRETCH_HIGH_Q = 0.99

/**
 * Converts RGBA pixels to grayscale and stretches contrast between the 1st
 * and 99th luminance percentiles. Scanned textbook pages usually sit on a
 * gray background with soft black text; stretching maps paper to white and
 * ink towards black, which is what the LSTM engine segments best.
 * Uniform images (low === high) are left untouched (no division by zero).
 */
export function grayscaleStretch(data: Uint8ClampedArray): void {
  const count = Math.floor(data.length / 4)
  if (count === 0) return

  const gray = new Uint8Array(count)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    gray[j] = (0.299 * r + 0.587 * g + 0.114 * b) | 0
  }

  const hist = new Uint32Array(256)
  for (let j = 0; j < count; j++) {
    const g = gray[j] ?? 0
    hist[g] = (hist[g] ?? 0) + 1
  }

  const low = percentile(hist, count, STRETCH_LOW_Q)
  const high = percentile(hist, count, STRETCH_HIGH_Q)
  if (high <= low) return

  const scale = 255 / (high - low)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const v = Math.round(((gray[j] ?? 0) - low) * scale)
    const clamped = v < 0 ? 0 : v > 255 ? 255 : v
    data[i] = clamped
    data[i + 1] = clamped
    data[i + 2] = clamped
  }
}

function percentile(hist: Uint32Array, total: number, q: number): number {
  const target = Math.max(1, Math.floor(total * q))
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v] ?? 0
    if (acc >= target) return v
  }
  return 255
}
