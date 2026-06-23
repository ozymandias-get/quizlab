/**
 * Captures a canvas element as a Blob with automatic format selection
 * and memory-safe ObjectURL lifecycle management.
 */
import type { CaptureOptions, CaptureResult } from './types'

const DEFAULT_MAX_CANVAS_AREA = 16_000_000

export function captureCanvasAsBlob(
  canvas: HTMLCanvasElement,
  options?: CaptureOptions
): Promise<CaptureResult> {
  const maxCanvasArea = options?.maxCanvasArea ?? DEFAULT_MAX_CANVAS_AREA
  const canvasArea = canvas.width * canvas.height
  const shouldUseJpeg = canvasArea > maxCanvasArea
  const mimeType = options?.mimeType ?? (shouldUseJpeg ? 'image/jpeg' : 'image/png')
  const quality = options?.quality ?? (shouldUseJpeg ? 0.85 : undefined)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'))
          return
        }

        resolve({
          blob,
          blobUrl: URL.createObjectURL(blob)
        })
      },
      mimeType,
      quality
    )
  })
}
