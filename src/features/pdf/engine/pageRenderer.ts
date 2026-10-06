/**
 * Native page rendering: `PDFPageProxy` → viewport → canvas → `RenderTask`.
 *
 * ## RenderTask ownership
 *
 * A `RenderTask` holds the canvas exclusively until its promise settles, so a
 * second render into the same canvas while the first is still live is what
 * produces PDF.js's "multiple render() operations" error. The renderer therefore
 * keeps the current task and cancels it before starting the next one.
 *
 * Cancellation is detected with the typed `RenderingCancelledException` that
 * PDF.js 6 exports, not by matching message strings — the legacy
 * `features/pdf/errors/pdfRenderErrors.ts` guard exists precisely because string
 * matching was the only option on the 3.x surface.
 *
 * ## Scope
 *
 * The canvas is supplied by the caller. This module neither creates DOM elements
 * nor touches React, so the viewer phase decides whether a page is a real
 * `<canvas>` in the document or an offscreen buffer.
 */
import type { PDFPageProxy, RenderTask } from 'pdfjs-6'
import { RenderingCancelledException } from 'pdfjs-6'

export interface RenderPageOptions {
  scale: number
  rotation?: number
}

export interface RenderedPage {
  width: number
  height: number
}

/** True when the rejection is PDF.js cancelling a render we asked it to cancel. */
export function isRenderCancelled(error: unknown): boolean {
  return error instanceof RenderingCancelledException
}

export interface PdfPageRenderer {
  renderPage(
    page: PDFPageProxy,
    target: HTMLCanvasElement,
    options: RenderPageOptions
  ): Promise<RenderedPage>
  /** Cancel an in-flight render, if any. Safe to call when idle. */
  cancel(): void
  /** Whether a render is currently in flight. */
  readonly isRendering: boolean
}

export function createPageRenderer(): PdfPageRenderer {
  let currentTask: RenderTask | null = null

  function cancel(): void {
    if (!currentTask) return
    const task = currentTask
    currentTask = null
    task.cancel()
  }

  return {
    async renderPage(
      page: PDFPageProxy,
      target: HTMLCanvasElement,
      options: RenderPageOptions
    ): Promise<RenderedPage> {
      // Supersede whatever was drawing before taking the canvas.
      cancel()

      const viewport = page.getViewport({ scale: options.scale, rotation: options.rotation })
      const width = Math.max(1, Math.floor(viewport.width))
      const height = Math.max(1, Math.floor(viewport.height))
      target.width = width
      target.height = height

      const task = page.render({ canvas: target, viewport })
      currentTask = task

      try {
        await task.promise
        return { width, height }
      } finally {
        // Only clear the slot if it is still ours; a newer render may own it.
        if (currentTask === task) currentTask = null
      }
    },

    cancel,

    get isRendering(): boolean {
      return currentTask !== null
    }
  }
}
