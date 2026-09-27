/**
 * Client-side preparation for images bound for an OpenAI-compatible vision
 * endpoint.
 *
 * PDF page captures (4x scale, up to 20 MP) and screen crops routinely encode
 * to tens of megabytes. Base64 inflates that by a further ~33%, so the main
 * process rejects the whole request with "Request body too large" and the image
 * never reaches the model. Downscaling here keeps attachments inside the
 * provider budget.
 *
 * The function is intentionally fail-soft: any decoding, canvas or encoding
 * problem returns the original data URL. Losing the user's attachment is worse
 * than sending an oversized one, which at least surfaces a real API error.
 */

/** Longest edge kept when an image has to be rescaled. */
export const MAX_UPLOAD_DIMENSION = 2048

/**
 * Target ceiling for a single encoded attachment. Chosen so several images
 * still fit inside the 20 MB request body enforced by the main process.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Quality used when re-encoding a downscaled image. */
const REENCODE_QUALITY = 0.9

/**
 * Approximate decoded byte count of a base64 data URL without decoding it.
 * Base64 is ASCII, so the string length equals the encoded byte count and the
 * decoded size is 3/4 of that (ignoring padding).
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return dataUrl.length
  const payload = dataUrl.length - commaIndex - 1
  return Math.floor((payload * 3) / 4)
}

/**
 * Pure sizing decision, kept separate so it can be reasoned about (and tested)
 * without a canvas.
 */
export function needsDownscale(encodedBytes: number, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false
  if (Math.max(width, height) > MAX_UPLOAD_DIMENSION) return true
  return encodedBytes > MAX_UPLOAD_BYTES
}

/** Scale factor that brings both edges within `maxDimension`, never upscaling. */
export function computeScale(width: number, height: number, maxDimension: number): number {
  const longest = Math.max(width, height)
  if (longest <= maxDimension) return 1
  return maxDimension / longest
}

/**
 * Upper bound on waiting for an image to decode. Without it a `load` event
 * that never fires (headless DOM, blocked resource, revoked URL) would hang the
 * composer and the send with it. Failing soft returns the original image.
 */
const DECODE_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = DECODE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(fallback)
    }, ms)
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}

interface DecodedSize {
  width: number
  height: number
}

async function decodeSize(dataUrl: string): Promise<DecodedSize | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(new Blob([dataUrl]))
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return size
    } catch {
      // fall through to the <img> path
    }
  }

  if (typeof Image !== 'function') return null
  return withTimeout(
    new Promise<DecodedSize | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    }),
    null
  )
}

async function decodeToCanvas(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return null

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(new Blob([dataUrl]))
      context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
      bitmap.close?.()
      return canvas
    }
  } catch {
    return null
  }

  return withTimeout(
    new Promise<HTMLCanvasElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        context.drawImage(img, 0, 0, targetWidth, targetHeight)
        resolve(canvas)
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    }),
    null
  )
}

/**
 * Returns a data URL safe to attach. Images already within budget are returned
 * untouched; oversized ones are downscaled and re-encoded as JPEG.
 */
export async function prepareImageForUpload(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return dataUrl

  const size = await decodeSize(dataUrl)
  if (!size) return dataUrl
  if (!needsDownscale(estimateDataUrlBytes(dataUrl), size.width, size.height)) {
    return dataUrl
  }

  const scale = computeScale(size.width, size.height, MAX_UPLOAD_DIMENSION)
  const targetWidth = Math.max(1, Math.round(size.width * scale))
  const targetHeight = Math.max(1, Math.round(size.height * scale))

  const canvas = await decodeToCanvas(dataUrl, targetWidth, targetHeight)
  if (!canvas) return dataUrl

  let encoded: string
  try {
    encoded = canvas.toDataURL('image/jpeg', REENCODE_QUALITY)
  } catch {
    return dataUrl
  }

  if (!encoded.startsWith('data:image/')) return dataUrl
  // Re-encoding must actually help; otherwise keep the original.
  return encoded.length < dataUrl.length ? encoded : dataUrl
}
