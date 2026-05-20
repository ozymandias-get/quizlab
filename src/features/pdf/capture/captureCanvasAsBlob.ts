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
  const useJpeg = canvasArea > maxCanvasArea
  const mimeType = options?.mimeType ?? (useJpeg ? 'image/jpeg' : 'image/png')
  const quality = options?.quality ?? (useJpeg ? 0.85 : undefined)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'))
          return
        }

        const blobUrl = URL.createObjectURL(blob)
        resolve({
          blob,
          blobUrl,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        })
      },
      mimeType,
      quality
    )
  })
}

export function revokeCaptureUrl(blobUrl: string): void {
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl)
  }
}
