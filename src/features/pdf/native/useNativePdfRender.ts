/**
 * Native page rendering: the current page at the current scale, into one canvas.
 *
 * ## Single page only
 *
 * One `<canvas>` exists in the DOM at a time and it always holds the current
 * page. `ViewMode.SinglePage` parity means there is no page stack, no
 * prefetch and no second canvas — the previous page's render is *superseded*, not
 * kept alive beside the new one.
 *
 * ## Supersede, don't race
 *
 * The effect depends on `(document, page, scale)`, so any of those changing, or
 * the viewer unmounting, runs its cleanup: `renderer.cancel()`. The engine
 * renderer also cancels before it starts, which covers a re-entry the effect
 * cannot see. A superseded render therefore rejects with the typed
 * `RenderingCancelledException` — recognised by identity through the engine's
 * `isRenderCancelled`, never by matching message text — and is dropped without
 * touching state, so cancellation produces neither a user-facing error nor
 * console noise.
 *
 * A *real* render failure is not swallowed: it is surfaced as `renderError` so
 * the viewer can show a fallback instead of a blank page.
 *
 * ## The one thing presentation is allowed to know
 *
 * `onRenderCommitted` fires after a live render has painted, with the page it painted.
 * It exists because the page transition has to wait for that moment: this viewer keeps
 * the previous page's pixels in the same canvas until the new ones land, so "the new
 * page is on screen" is only true once a render commits. Nothing about the render is
 * gated on it — the callback is called last, after the cancellation guard, so a
 * superseded render reports nothing and a turn that was already abandoned is never
 * presented.
 *
 * "Until the new ones land" is exact, not approximate: `pageRenderer` sizes the canvas
 * only when the size actually changes, so a same-size page turn does not reset the
 * backing store and the outgoing page stays painted for the whole interval. That is
 * what makes the commit a meaningful signal rather than a race.
 *
 * It is read through a ref so a new callback identity can never re-run the effect: a
 * presentation concern must not be able to cost an extra `getPage` or an extra render.
 *
 * ## The canvas's committed page
 *
 * Because the previous page's pixels deliberately stay on the canvas until a render
 * commits, the canvas cannot be captured for the page the viewer is merely *asking*
 * for. `data-native-pdf-canvas-page` is what makes the two distinguishable: this hook
 * removes it when a render starts and writes it back only once the render commits, so
 * `findNativePageCanvas` refuses the canvas for the whole interval and a capture falls
 * through to rendering the page from the document. On a turn that is the previous
 * page's image; on a zoom it is a resized, partly blanked backing store. Neither may
 * be sent to the AI under the new page's number.
 */
import { isRenderCancelled } from '@features/pdf/engine'
import { NATIVE_CANVAS_PAGE_ATTRIBUTE } from '@features/pdf/native/nativePdfDom'
import type { NativePdfDocumentStatus } from '@features/pdf/native/useNativePdfDocument'
import type { NativePdfEngineHandle } from '@features/pdf/native/useNativePdfEngine'

import { type RefObject, useEffect, useRef, useState } from 'react'

interface UseNativePdfRenderOptions {
  enabled: boolean
  engine: NativePdfEngineHandle
  status: NativePdfDocumentStatus
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** 1-based. Passed straight to `getPage`, which is also 1-based. */
  currentPage: number
  scale: number
  /**
   * Called after a live render has committed `pageNumber`'s pixels to the canvas.
   *
   * Never called for a superseded render, and never called for a failure.
   */
  onRenderCommitted?: (pageNumber: number) => void
}

export interface NativePdfRenderHandle {
  /**
   * Message for a genuine render failure; `null` while rendering, on cancel, and
   * whenever the failure belongs to a page or scale other than the current one.
   *
   * It is keyed rather than plain because the error shell replaces the canvas: a
   * failure left standing would keep the replacement page from ever mounting a
   * canvas to render into.
   */
  renderError: string | null
}

/** Keep a render failure to a single safe line — no PDF.js stack traces in the UI. */
function toRenderErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}

export function useNativePdfRender({
  enabled,
  engine,
  status,
  canvasRef,
  currentPage,
  scale,
  onRenderCommitted
}: UseNativePdfRenderOptions): NativePdfRenderHandle {
  const [renderError, setRenderError] = useState<{
    page: number
    scale: number
    message: string
  } | null>(null)

  const onRenderCommittedRef = useRef(onRenderCommitted)
  onRenderCommittedRef.current = onRenderCommitted

  useEffect(() => {
    // The error shell removes the canvas. Clear the old failure during a new
    // loading lifecycle so the ready frame can mount a canvas and render again.
    if (status !== 'ready') {
      setRenderError(null)
      return
    }
    const canvas = canvasRef.current
    if (!enabled || !canvas) return

    const engineInstance = engine()
    if (!engineInstance) return

    let cancelled = false
    // Clear eagerly so a failure from the previous page does not stay on screen
    // while the replacement page renders.
    setRenderError(null)
    // Down before the first await: until this render commits the canvas is still
    // showing the previous one, so it must stop claiming to hold this page.
    canvas.removeAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE)

    void (async () => {
      try {
        const page = await engineInstance.manager.getPage(currentPage)
        // The identity may have moved on while the page proxy was resolving.
        if (cancelled) return
        // Canvas sizing is the engine's job: it derives width/height from the
        // page's own viewport at this scale, rotation included.
        await engineInstance.renderer.renderPage(page, canvas, { scale })
        if (cancelled) return
        // The pixels are in the canvas, so it holds this page now. A superseded
        // render gets here too late to claim that.
        canvas.setAttribute(NATIVE_CANVAS_PAGE_ATTRIBUTE, String(currentPage))
        // Last, and after the guard: the pixels are in the canvas, and a render nobody
        // is waiting for any more has already said so.
        onRenderCommittedRef.current?.(currentPage)
      } catch (error) {
        if (cancelled || isRenderCancelled(error)) return
        setRenderError({ page: currentPage, scale, message: toRenderErrorMessage(error) })
      }
    })()

    return () => {
      cancelled = true
      engineInstance.renderer.cancel()
    }
  }, [enabled, engine, status, canvasRef, currentPage, scale])

  return {
    renderError:
      renderError?.page === currentPage && renderError.scale === scale ? renderError.message : null
  }
}
