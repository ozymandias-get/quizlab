import { Logger } from '@shared/lib/logger'

import type * as PdfJs from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

import { findPageCanvas } from '../capture/findPageCanvas'
import { type ActivePdfDocument, getActivePdfDocument } from './activePdfDocumentRegistry'

const PDF_RENDER_DEFAULT_SCALE = 2.0
const PDF_RENDER_MAX_PIXELS = 16_000_000

/** Shape `renderPageToImageFallback` resolves to. The caller must revoke `blobUrl`. */
export interface RenderedPageImage {
  blob: Blob
  blobUrl: string
  width: number
  height: number
}

export interface RenderOptions {
  scale?: number
  maxPixels?: number
}

/**
 * Render a PDF page to a PNG Blob for high-DPI screenshot capture.
 *
 * Prefers the viewer's live `PDFDocumentProxy` (via `getActivePdfDocument`) so a
 * capture reuses the already-decoded document instead of re-fetching a large
 * file, and falls back to cloning the mounted page canvas at the same scale.
 *
 * There is deliberately no cancellation argument: capture supersession is
 * decided by the caller (`usePdfCaptureActions` stamps every request and drops
 * results from stale ones), and the previous `AbortSignal` parameter was never
 * passed by any caller, so its abort listener and render-task cancel were dead.
 */
export async function renderPageToImageFallback(
  pdfUrl: string,
  pageNumber: number,
  options: RenderOptions = {}
): Promise<RenderedPageImage | null> {
  const scale = options.scale ?? PDF_RENDER_DEFAULT_SCALE
  const maxPixels = options.maxPixels ?? PDF_RENDER_MAX_PIXELS

  // Direct PDF.js render gives true high-DPI detail — try it first.
  try {
    const offscreen = await renderWithPdfJs(pdfUrl, pageNumber, { scale, maxPixels })
    if (offscreen) return offscreen
  } catch (e) {
    Logger.warn('[RenderPage] pdfjs direct render failed, trying canvas clone fallback', e)
  }

  // Fast path: clone the exact page canvas (no arbitrary fallback)
  try {
    const canvas = findPageCanvas(pageNumber)
    if (canvas) {
      const result = await cloneCanvasAtScale(canvas, scale, maxPixels)
      if (result) return result
    }
  } catch (e) {
    Logger.warn('[RenderPage] canvas clone failed', e)
  }

  return null
}

async function cloneCanvasAtScale(
  source: HTMLCanvasElement,
  scale: number,
  maxPixels: number
): Promise<RenderedPageImage | null> {
  const srcW = source.width
  const srcH = source.height
  if (srcW === 0 || srcH === 0) return null

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

  const blob = await canvasToBlob(offscreen)
  if (!blob) return null

  const blobUrl = URL.createObjectURL(blob)
  return { blob, blobUrl, width: targetW, height: targetH }
}

async function renderWithPdfJs(
  pdfUrl: string,
  pageNumber: number,
  options: { scale: number; maxPixels: number }
): Promise<RenderedPageImage | null> {
  let pdf: ActivePdfDocument | null = null
  let shouldDestroy = false

  const reusedDocument = getActivePdfDocument(pdfUrl)
  if (reusedDocument) {
    pdf = reusedDocument
  } else {
    // pdfjs-dist 3.x ships a UMD bundle, so Vite's CJS interop can expose the
    // API under `default` instead of as named exports. Keep the interop shim.
    const pdfjsModule = (await import('pdfjs-dist')) as typeof PdfJs & { default?: typeof PdfJs }
    const pdfjsLib = pdfjsModule.default ?? pdfjsModule
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
    }

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, isEvalSupported: false })
    // ActivePdfDocument mirrors the subset of PDFDocumentProxy this path uses.
    pdf = (await loadingTask.promise) as unknown as ActivePdfDocument
    shouldDestroy = true
  }

  if (!pdf) return null

  try {
    const page = await pdf.getPage(pageNumber)
    const scale = options.scale
    const maxPixels = options.maxPixels

    let renderViewport = page.getViewport({ scale })
    let w = Math.round(renderViewport.width)
    let h = Math.round(renderViewport.height)
    const area = w * h
    if (area > maxPixels) {
      const ratio = Math.sqrt(maxPixels / area)
      renderViewport = page.getViewport({ scale: scale * ratio })
      w = Math.round(renderViewport.width)
      h = Math.round(renderViewport.height)
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, w)
    canvas.height = Math.max(1, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    Logger.info(
      `[RenderPage] Rendering PDF page ${pageNumber} via PDF.js: ${w}x${h} at scale ${scale}`
    )
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise
    const blob = await canvasToBlob(canvas)
    if (!blob) return null
    Logger.info(
      `[RenderPage] Rendered page ${pageNumber} PNG: ${w}x${h}, size: ${(blob.size / 1024).toFixed(1)} KB`
    )
    const blobUrl = URL.createObjectURL(blob)
    return { blob, blobUrl, width: canvas.width, height: canvas.height }
  } finally {
    // Only tear down the document this call loaded itself. When the proxy came
    // from getActivePdfDocument() it belongs to the mounted <Viewer>, and
    // PDFPageProxy.cleanup() drops that page's shared decoded-object cache
    // (objs.clear()), forcing a re-decode of fonts and images on the viewer's
    // next repaint. Captures do not leak page proxies: PDFDocumentProxy caches
    // them per page number, so a repeat capture of the same page reuses the
    // proxy the viewer already owns.
    if (shouldDestroy && pdf) {
      try {
        void pdf.destroy()
      } catch {}
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}
