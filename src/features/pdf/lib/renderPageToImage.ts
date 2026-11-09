import {
  loadTemporaryCaptureDocument,
  type TemporaryCaptureDocument
} from '@features/pdf/engine/captureDocument'

import { Logger } from '@shared/lib/logger'

import { findPageCanvas } from '../capture/findPageCanvas'
import { type ActivePdfDocumentHandle, getActivePdfDocument } from './activePdfDocumentRegistry'

/**
 * Capture scale. The toolbar asks for 4.0 (~288 DPI) so text and photomicrograph
 * detail survive the trip to the AI; the default is what the last-resort rung uses.
 */
const PDF_RENDER_DEFAULT_SCALE = 2.0
/** Hard ceiling on the direct render's rasterized area. */
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
  /**
   * Cancels the in-flight render. Aborting calls `RenderTask#cancel()`, which
   * stops the rasterization itself rather than discarding a finished result.
   * The ladder resolves with `null` once aborted, so a superseded capture does
   * not fall through to a second, equally unneeded render.
   */
  signal?: AbortSignal
}

/**
 * Render a PDF page to a PNG Blob for high-DPI screenshot capture.
 *
 * ## The ladder
 *
 *  1. **direct high-DPI render** — real PDF.js detail, independent of the zoom
 *     and DPR the page happens to be displayed at
 *  2. **the mounted page canvas**, cloned at the same scale
 *  3. `null`, and the caller shows the capture-failed toast
 *
 * ## The document the direct render borrows
 *
 * `getActivePdfDocument(pdfUrl)` returns the mounted viewer's document when there
 * is one — a handle over the native `PdfDocumentManager`'s document — so a capture
 * reuses an already-decoded file instead of re-fetching a large one. **Borrowed
 * means borrowed:** a handle has no teardown, so nothing below can end the
 * viewer's document life, and no page `cleanup()` is called on a borrowed proxy
 * because that drops the viewer's shared decoded-object cache (`objs.clear()`) and
 * forces a font/image re-decode on its next repaint.
 *
 * With nothing to borrow — no viewer mounted, still loading, showing a different
 * file, or just reloaded — one isolated document is loaded for this capture alone
 * and destroyed through its **loading task** afterwards. PDF.js 6 removed
 * `PDFDocumentProxy#destroy()`, so `renderPageToImage.ts` holds no `destroy()` of
 * its own: `engine/captureDocument.ts` wraps a `PdfDocumentManager`, whose
 * `destroy()` is the PDF.js 6 teardown call (`PDFDocumentLoadingTask#destroy()`)
 * and whose `load()` is the single authoritative `getDocument` options + worker +
 * `enableScripting: false` path. That is also why capture reaches no PDF.js
 * runtime directly — the borrowed case loads nothing at all, and the temporary
 * case goes through the engine that already owns the security and asset policy.
 *
 * There is deliberately no cancellation *policy* here: capture supersession is
 * decided by the caller (`usePdfCaptureActions` stamps every request and drops
 * results from stale ones). What this module does own is the mechanism: when the
 * caller passes a `signal`, aborting it cancels the live `RenderTask`, so a
 * superseded high-DPI raster stops consuming CPU, GPU and memory instead of
 * finishing into a result nobody will use. That is `RenderTask#cancel()`, which
 * belongs to one render — it does not touch the borrowed document.
 *
 * ## 1-based pages
 *
 * `pageNumber` is passed straight to `getPage`, which is 1-based. Nothing here
 * converts it.
 */
export async function renderPageToImageFallback(
  pdfUrl: string,
  pageNumber: number,
  options: RenderOptions = {}
): Promise<RenderedPageImage | null> {
  const scale = options.scale ?? PDF_RENDER_DEFAULT_SCALE
  const maxPixels = options.maxPixels ?? PDF_RENDER_MAX_PIXELS
  const { signal } = options

  if (signal?.aborted) return null

  // Direct PDF.js render gives true high-DPI detail — try it first.
  try {
    const offscreen = await renderWithPdfJs(pdfUrl, pageNumber, { scale, maxPixels, signal })
    if (offscreen) return offscreen
  } catch (e) {
    // An aborted render is a cancellation, not a failure to fall back from.
    if (signal?.aborted) return null
    Logger.warn('[RenderPage] pdfjs direct render failed, trying canvas clone fallback', e)
  }

  if (signal?.aborted) return null

  // Fast path: clone the exact page canvas (no arbitrary fallback)
  try {
    const canvas = findPageCanvas(pageNumber)
    if (canvas) {
      const result = await cloneCanvasAtScale(canvas, scale, maxPixels)
      if (result) return result
    }
  } catch (e) {
    if (signal?.aborted) return null
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

/**
 * Render one page straight from PDF.js at `scale`, inside the pixel budget.
 *
 * The budget arithmetic is deliberately the pre-existing one, epsilon and all:
 * the ratio is derived from the **rounded** viewport, then the rescaled
 * dimensions are rounded again *without* re-checking. An A0 page at scale 4
 * therefore lands at 20 001 639 px against a 20 MP cap — 0.008 % over. Re-checking
 * would be a behaviour change, not a fix, and this path is pinned by regression
 * tests with an explicit tolerance.
 */
async function renderWithPdfJs(
  pdfUrl: string,
  pageNumber: number,
  options: { scale: number; maxPixels: number; signal?: AbortSignal }
): Promise<RenderedPageImage | null> {
  const borrowed = getActivePdfDocument(pdfUrl)
  let temporary: TemporaryCaptureDocument | null = null
  let handle: ActivePdfDocumentHandle | null = borrowed

  if (!handle) {
    temporary = await loadTemporaryCaptureDocument(pdfUrl)
    handle = temporary.handle
  }

  try {
    const page = await handle.getPage(pageNumber)
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

    // High-zoom fast path. When the viewer already rasterized this page at a
    // resolution at least as high as the target, that canvas *is* the 4x render:
    // copying it is one draw instead of a second full PDF.js raster plus a PNG
    // encode of up to 20 MP. Never upscales, so no detail is invented.
    if (borrowed) {
      const mounted = findPageCanvas(pageNumber)
      if (mounted && mounted.width > 0 && mounted.height > 0) {
        if (mounted.width * mounted.height >= w * h) {
          const reused = await cloneCanvasAtScale(mounted, w / mounted.width, maxPixels)
          if (reused) {
            Logger.info(
              `[RenderPage] Reused the ${mounted.width}x${mounted.height} mounted canvas for page ${pageNumber}`
            )
            return reused
          }
        }
      }
    }

    if (options.signal?.aborted) return null

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
    await awaitRenderTask(
      page.render({ canvasContext: ctx, viewport: renderViewport }),
      options.signal
    )
    if (options.signal?.aborted) return null
    const blob = await canvasToBlob(canvas)
    if (!blob) return null
    Logger.info(
      `[RenderPage] Rendered page ${pageNumber} PNG: ${w}x${h}, size: ${(blob.size / 1024).toFixed(1)} KB`
    )
    const blobUrl = URL.createObjectURL(blob)
    return { blob, blobUrl, width: canvas.width, height: canvas.height }
  } finally {
    // Only tear down a document this call loaded itself, and only through its
    // loading task. A borrowed handle exposes no teardown at all, so this cannot
    // reach the viewer's document even by mistake.
    temporary?.release()
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

/**
 * Wait for a PDF.js render, cancelling the task itself when `signal` aborts.
 *
 * `RenderTask#cancel()` rejects the promise with `RenderingCancelledException`;
 * the caller recognises the abort and returns `null` instead of logging it as a
 * render failure.
 */
function awaitRenderTask(
  task: { promise: Promise<unknown>; cancel?: () => void },
  signal?: AbortSignal
): Promise<void> {
  if (!signal) return task.promise.then(() => undefined)

  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      task.cancel?.()
    }

    const onAbort = () => task.cancel?.()
    signal.addEventListener('abort', onAbort, { once: true })

    task.promise.then(
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}
