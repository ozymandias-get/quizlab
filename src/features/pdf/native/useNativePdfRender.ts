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
 */
import { isRenderCancelled } from '@features/pdf/engine'
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
  /** Message for a genuine render failure; `null` while rendering or on cancel. */
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
  const [renderError, setRenderError] = useState<string | null>(null)

  const onRenderCommittedRef = useRef(onRenderCommitted)
  onRenderCommittedRef.current = onRenderCommitted

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled || status !== 'ready' || !canvas) return

    const engineInstance = engine()
    if (!engineInstance) return

    let cancelled = false
    // Clear eagerly so a failure from the previous page does not stay on screen
    // while the replacement page renders.
    setRenderError(null)

    void (async () => {
      try {
        const page = await engineInstance.manager.getPage(currentPage)
        // The identity may have moved on while the page proxy was resolving.
        if (cancelled) return
        // Canvas sizing is the engine's job: it derives width/height from the
        // page's own viewport at this scale, rotation included.
        await engineInstance.renderer.renderPage(page, canvas, { scale })
        if (cancelled) return
        // Last, and after the guard: the pixels are in the canvas, and a render nobody
        // is waiting for any more has already said so.
        onRenderCommittedRef.current?.(currentPage)
      } catch (error) {
        if (cancelled || isRenderCancelled(error)) return
        setRenderError(toRenderErrorMessage(error))
      }
    })()

    return () => {
      cancelled = true
      engineInstance.renderer.cancel()
    }
  }, [enabled, engine, status, canvasRef, currentPage, scale])

  return { renderError }
}
