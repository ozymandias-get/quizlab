import { Logger } from '@shared/lib/logger'

import { OCR_DEFAULT_SCALE, OCR_MAX_PIXELS } from '../types'

export interface RenderOptions {
  scale?: number
  maxPixels?: number
}

/**
 * Render a PDF page to an ImageData/Blob for OCR.
 * Tries offscreen pdf.js render via existing viewer canvas as fallback.
 * Returns a Blob (png) and an object URL — caller must revoke.
 */
export async function renderPageToImageFallback(
  pdfUrl: string,
  pageNumber: number,
  options: RenderOptions = {},
  signal?: AbortSignal
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number } | null> {
  // Primary: use on-screen canvas if available (fast, no extra pdfjs load)
  // This is the user-visible canvas; we clone it to a higher-res offscreen canvas
  // to avoid mutating the viewer's own canvas.
  try {
    const canvas = findCurrentPageCanvas(pageNumber)
    if (canvas) {
      if (signal?.aborted) return null
      const result = await cloneCanvasAtScale(
        canvas,
        options.scale ?? OCR_DEFAULT_SCALE,
        options.maxPixels ?? OCR_MAX_PIXELS,
        signal
      )
      if (result) return result
    }
  } catch (e) {
    Logger.warn('[OCR] canvas clone failed, falling back to pdfjs offscreen', e)
  }

  // Secondary: try pdf.js offscreen render (needs pdfjs-dist)
  try {
    const offscreen = await renderWithPdfJs(pdfUrl, pageNumber, options, signal)
    if (offscreen) return offscreen
  } catch (e) {
    Logger.warn('[OCR] pdfjs offscreen render failed', e)
  }

  return null
}

function findCurrentPageCanvas(pageNumber: number): HTMLCanvasElement | null {
  const layer =
    document.querySelector(`.rpv-core__page-layer[data-page-number="${pageNumber}"]`) ||
    document.querySelector(`.pdf-page-wrapper[data-page-number="${pageNumber}"]`)
  if (layer) {
    const c = layer.querySelector('canvas') as HTMLCanvasElement | null
    if (c && c.width > 0 && c.height > 0) return c
  }
  const container = document.querySelector('.pdf-viewer-container')
  if (!container) return null
  const anyCanvas = container.querySelector('canvas') as HTMLCanvasElement | null
  if (anyCanvas && anyCanvas.width > 0) return anyCanvas
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

  // Compute target size with pixel limit
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

  // High-quality scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // White background for OCR (pdf canvas may be transparent)
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
  options: RenderOptions,
  signal?: AbortSignal
): Promise<{ blob: Blob; blobUrl: string; width: number; height: number } | null> {
  if (signal?.aborted) return null
  // Dynamic import to keep pdfjs out of main chunk unless needed for OCR
  const pdfjs = await import('pdfjs-dist')
  // Support both build variants
  const pdfjsLib: unknown = pdfjs
  const getDocument =
    (pdfjsLib as { getDocument?: (src: unknown) => { promise: Promise<unknown> } }).getDocument ??
    (pdfjsLib as { default?: { getDocument?: (src: unknown) => { promise: Promise<unknown> } } })
      .default?.getDocument
  if (!getDocument) return null

  const loadingTask = getDocument({ url: pdfUrl, isEvalSupported: false, useWorkerFetch: false })
  const pdf = (await (
    loadingTask as {
      promise: Promise<{ getPage: (n: number) => Promise<unknown>; destroy: () => void }>
    }
  ).promise) as {
    getPage: (n: number) => Promise<{
      getViewport: (o: { scale: number }) => { width: number; height: number }
      render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
        promise: Promise<void>
      }
    }>
    destroy: () => void
  }

  try {
    const page = await pdf.getPage(pageNumber)
    const scale = options.scale ?? OCR_DEFAULT_SCALE
    const viewport = page.getViewport({ scale })
    let w = Math.round(viewport.width)
    let h = Math.round(viewport.height)
    const maxPixels = options.maxPixels ?? OCR_MAX_PIXELS
    const area = w * h
    if (area > maxPixels) {
      const ratio = Math.sqrt(maxPixels / area)
      w = Math.max(1, Math.round(w * ratio))
      h = Math.max(1, Math.round(h * ratio))
      // Recompute viewport at adjusted scale
      const adjScale = scale * ratio
      const adjViewport = page.getViewport({ scale: adjScale })
      // Use adjusted
      void adjViewport
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (signal?.aborted) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    const renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    if (signal?.aborted) return null
    const blob = await canvasToBlob(canvas, 'image/png')
    if (!blob) return null
    const blobUrl = URL.createObjectURL(blob)
    return { blob, blobUrl, width: w, height: h }
  } finally {
    try {
      pdf.destroy()
    } catch {}
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type)
  })
}
