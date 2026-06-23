export interface CaptureOptions {
  mimeType?: 'image/png' | 'image/jpeg'
  quality?: number
  maxCanvasArea?: number
}

export interface CaptureResult {
  blob: Blob
  blobUrl: string
}
