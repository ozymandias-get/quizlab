import { Logger } from '@shared/lib/logger'

import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

import type { OcrQualityPreset } from '../types'
import { getRenderPreset, OCR_DEFAULT_SCALE, OCR_MAX_PIXELS } from '../types'
import { getActivePdfDocument } from './activePdfDocumentRegistry'

// Backward-compatible re-exports: registry lives in
// `./activePdfDocumentRegistry`; existing importers keep working.
export type { ActivePdfDocument } from './activePdfDocumentRegistry'
export {
  clearActivePdfDocument,
  getActivePdfDocumentFingerprint,
  setActivePdfDocument
} from './activePdfDocumentRegistry'

export interface RenderOptions {
  scale?: number
  maxPixels?: number
  quality?: OcrQualityPreset
}

/**
 * Render a PDF page to an ImageData/Blob for OCR.
 * Tries pdf.js direct render first for balanced/high quality to avoid fake 2x upscaling.
 * Falls back to canvas clone only for fast path when the exact page canvas is already mounted.
 * Returns a Blob (png) and an object URL — caller must revoke.
 */
export async function renderPageToImageFallback(
  pdfUrl: string,
  pageNumber: number,
  options: RenderOptions = {},
  signal?: AbortSignal
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number } | null> {
  if (signal?.aborted) return null

  // Resolve preset from quality if provided
  let scale = options.scale
  let maxPixels = options.maxPixels
  let preferDirectRender = true

  if (options.quality) {
    const preset = getRenderPreset(options.quality)
    scale = scale ?? preset.scale
    maxPixels = maxPixels ?? preset.maxPixels
    preferDirectRender = preset.useDirectPdfRender
  }
  scale = scale ?? OCR_DEFAULT_SCALE
  maxPixels = maxPixels ?? OCR_MAX_PIXELS

  // For balanced/high, direct PDF.js render gives true high-DPI detail — do it first
  if (preferDirectRender) {
    try {
      const offscreen = await renderWithPdfJs(pdfUrl, pageNumber, { scale, maxPixels }, signal)
      if (offscreen) return offscreen
    } catch (e) {
      Logger.warn('[OCR] pdfjs direct render failed, trying canvas clone fallback', e)
    }
    // Fallthrough to canvas clone as secondary
  }

  // Fast path: try exact page canvas clone (no arbitrary fallback)
  try {
    const canvas = findCurrentPageCanvas(pageNumber)
    if (canvas) {
      if (signal?.aborted) return null
      const result = await cloneCanvasAtScale(canvas, scale, maxPixels, signal)
      if (result) return result
    }
  } catch (e) {
    Logger.warn('[OCR] canvas clone failed', e)
  }

  // Finally try pdf.js if not already tried (fast quality secondary path, or after canvas miss)
  if (!preferDirectRender) {
    try {
      const offscreen = await renderWithPdfJs(pdfUrl, pageNumber, { scale, maxPixels }, signal)
      if (offscreen) return offscreen
    } catch (e) {
      Logger.warn('[OCR] pdfjs offscreen render failed', e)
    }
  }

  return null
}

/**
 * Find canvas for the *exact* requested page only.
 * Never returns an arbitrary canvas — that would OCR the wrong page.
 */
function findCurrentPageCanvas(pageNumber: number): HTMLCanvasElement | null {
  const virtualIndex = pageNumber - 1
  const selectors = [
    `.rpv-core__page-layer[data-page-number="${pageNumber}"]`,
    `.rpv-core__page-layer[data-virtual-index="${virtualIndex}"]`,
    `[data-testid="core__page-layer-${virtualIndex}"]`,
    `.pdf-page-wrapper[data-page-number="${pageNumber}"]`,
    `.pdf-page-wrapper[data-virtual-index="${virtualIndex}"]`
  ]
  for (const sel of selectors) {
    const layer = document.querySelector(sel)
    if (layer) {
      const c = layer.querySelector('canvas') as HTMLCanvasElement | null
      if (c && c.width > 0 && c.height > 0) return c
    }
  }
  return null
}

async function cloneCanvasAtScale(
  source: HTMLCanvasElement,
  scale: number,
  maxPixels: number,
  signal?: AbortSignal
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number } | null> {
  if (signal?.aborted) return null
  const srcW = source.width
  const srcH = source.height
  if (srcW === 0 || srcH === 0) return null

  // Avoid fake upscaling: if source already covers the requested scale, don't blow up beyond 1.1x
  // We keep scale param but clamp upscale to avoid 2x pixel waste without new detail.
  // For fast path, allow moderate upscale; for true high quality we already used pdfjs direct render.
  let targetW = Math.round(srcW * scale)
  let targetH = Math.round(srcH * scale)
  const area = targetW * targetH
  if (area > maxPixels) {
    const ratio = Math.sqrt(maxPixels / area)
    targetW = Math.max(1, Math.round(targetW * ratio))
    targetH = Math.max(1, Math.round(targetH * ratio))
  }

  const offscreen = document.createElement('canvas')
  offscreen.width = targetW
  offscreen.height = targetH
  const ctx = offscreen.getContext('2d')
  if (!ctx) return null

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(source, 0, 0, targetW, targetH)

  if (signal?.aborted) return null

  const blob = await canvasToBlob(offscreen, 'image/png')
  if (!blob) return null

  const blobUrl = URL.createObjectURL(blob)
  return { blob, blobUrl, width: targetW, height: targetH }
}

async function renderWithPdfJs(
  pdfUrl: string,
  pageNumber: number,
  options: { scale: number; maxPixels: number },
  signal?: AbortSignal
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number } | null> {
  if (signal?.aborted) return null

  // Try to reuse active PdfDocumentProxy to avoid reloading large PDFs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js types vary by version
  let pdf: any = null
  let shouldDestroy = false

  const reusedDocument = getActivePdfDocument(pdfUrl)
  if (reusedDocument) {
    pdf = reusedDocument as unknown as never
  } else {
    try {
      const pdfjs = await import('pdfjs-dist')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib: any = (pdfjs as any).default ?? pdfjs
      if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
      }
      const getDocument = pdfjsLib.getDocument
      if (!getDocument) return null

      const loadingTask = getDocument({ url: pdfUrl, isEvalSupported: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaded = (await (loadingTask as { promise: Promise<any> }).promise) as any
      pdf = loaded
      shouldDestroy = true
    } catch (loadError) {
      Logger.warn('[OCR] Direct PDF.js document load failed:', loadError)
      return null
    }
  }

  if (!pdf) return null

  let renderTask: { promise: Promise<void>; cancel?: () => void } | null = null
  const onAbort = () => {
    try {
      renderTask?.cancel?.()
    } catch {}
  }
  if (signal?.aborted) return null
  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (await (pdf as any).getPage(pageNumber)) as {
      getViewport: (o: { scale: number }) => { width: number; height: number }
      render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
        promise: Promise<void>
        cancel?: () => void
      }
    }
    const scale = options.scale
    const maxPixels = options.maxPixels

    // Compute viewport with correct adjusted scale when maxPixels exceeded — previously stored in adjViewport but not used (P0-1)
    let renderViewport = page.getViewport({ scale })
    let w = Math.round(renderViewport.width)
    let h = Math.round(renderViewport.height)
    const area = w * h
    if (area > maxPixels) {
      const ratio = Math.sqrt(maxPixels / area)
      const adjScale = scale * ratio
      renderViewport = page.getViewport({ scale: adjScale })
      w = Math.round(renderViewport.width)
      h = Math.round(renderViewport.height)
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, w)
    canvas.height = Math.max(1, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (signal?.aborted) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    Logger.info(
      `[RenderPage] Rendering PDF page ${pageNumber} via PDF.js: ${w}x${h} at scale ${scale}`
    )
    renderTask = page.render({ canvasContext: ctx, viewport: renderViewport })
    await renderTask!.promise
    if (signal?.aborted) return null
    const blob = await canvasToBlob(canvas, 'image/png')
    if (!blob) return null
    Logger.info(
      `[RenderPage] Rendered page ${pageNumber} PNG: ${w}x${h}, size: ${(blob.size / 1024).toFixed(1)} KB`
    )
    const blobUrl = URL.createObjectURL(blob)
    return { blob, blobUrl, width: canvas.width, height: canvas.height }
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
    if (shouldDestroy && pdf) {
      try {
        ;(pdf as { destroy: () => void }).destroy()
      } catch {}
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type)
  })
}
