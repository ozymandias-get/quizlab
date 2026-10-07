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
 * PDF.js 6 exports, not by matching message strings — the global
 * `features/pdf/errors/pdfRenderErrors.ts` guard does string matching, because it
 * has to catch errors from anywhere in the app, including sources that never name
 * the exception type.
 *
 * ## The canvas is never cleared here
 *
 * Sizing is the one thing this module does to the canvas, and only when the size
 * actually changes: assigning `canvas.width`/`canvas.height` resets the backing
 * store unconditionally, so an unconditional assignment empties the canvas at
 * navigation time on every same-size page turn and hands the reader a white frame
 * — white because PDF.js's `beginDrawing` fills the page background before it
 * paints. Nothing else clears it, and nothing needs to: PDF.js fills the whole
 * canvas at the start of every render, so a size change overwrites the old page on
 * its own.
 *
 * ## Scope
 *
 * The canvas is supplied by the caller. This module neither creates DOM elements
 * nor touches React, so the viewer phase decides whether a page is a real
 * `<canvas>` in the document or an offscreen buffer.
 */
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { RenderingCancelledException } from 'pdfjs-dist'

interface RenderPageOptions {
  scale: number
  rotation?: number
}

interface RenderedPage {
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
      // Assigning `canvas.width`/`canvas.height` resets the backing store *unconditionally*
      // — the assignment is the reset, whether or not the value differs. So on a same-size
      // page turn (the common case: one A4 document at one scale) an unguarded assignment
      // blanked the canvas synchronously, at navigation time, before PDF.js had painted a
      // single operator of the new page. The reader got a white frame, and PDF.js's own
      // `beginDrawing` fills the page background `#ffffff` before it draws, so the blank
      // frame was white rather than merely empty.
      //
      // Guarding it means the outgoing page stays on screen for the whole interval between
      // the navigation and the new page's first paint, which is both a better-looking
      // answer to that interval and the same pixels `useNativePdfRender` relies on to know
      // whether the new page has committed. It is also a layout win: the canvas's intrinsic
      // size is its layout size, so skipping a redundant assignment skips a resize of the
      // page box and of the auto margins that centre it.
      //
      // When the size genuinely changes — a zoom, a refit, a differently shaped page — the
      // assignment happens and the reset is required: the new pixels are laid out for a
      // different box, and PDF.js's `beginDrawing` fills the whole canvas before painting,
      // so it overwrites whatever the old page left behind. Nothing needs clearing here.
      if (target.width !== width) target.width = width
      if (target.height !== height) target.height = height

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
