/**
 * The native text layer: PDF.js's own `TextLayer`, mounted for the current page
 * at the current scale, inside the native boundary.
 *
 * ## Why PDF.js renders it, not us
 *
 * A text layer is not "put the words at roughly the right place". It is glyph
 * geometry: per-run font transforms, `--scale-x` horizontal stretching to match
 * the measured advance, rotation, `dir` for bidi, ascent compensation, and the
 * `markedContent` nesting a tagged PDF implies. PDF.js implements all of it in
 * `TextLayer`, and the browser's own selection + `Ctrl+C` copy only produce
 * correct results if that geometry is real. Re-implementing it would be a
 * rewrite, not a migration, so this phase ports QuizLab's *selection behaviour*
 * onto PDF.js's renderer instead — the same shape as Phase 4's canvas.
 *
 * ## The API that actually exists in 6.x
 *
 * Verified against `node_modules/pdfjs-6` (`pdfjs-dist@6.4.299`):
 *
 * ```js
 * new TextLayer({ textContentSource, container, viewport })
 * TextLayer#render(): Promise<void>   // resolves when the stream is drained
 * TextLayer#cancel(): void            // rejects render() with AbortException
 * TextLayer#update({ viewport }): void
 * ```
 *
 * `renderTextLayer(...)` — the pre-4.x function RPV still calls, and the reason
 * Phase 3 was blocked — does not exist here. `container` must be an
 * `HTMLElement`, which is why `TextLayer` lives in the native viewer boundary and
 * *not* in `features/pdf/engine`: the engine stays React- and DOM-free.
 *
 * ## One viewport, shared with the canvas
 *
 * The layer is built from `page.getViewport({ scale })` with the *same* scale the
 * canvas renderer is using, so canvas glyphs and selectable spans describe the
 * same box. Recomputing a scale here would silently misalign every selection
 * highlight, so the viewport comes from one call site and is passed straight
 * through. Rotation needs no handling of our own: `getViewport` and
 * `setLayerDimensions` already fold it in, and the native CSS mirrors PDF.js's
 * `data-main-rotation` contract.
 *
 * `update()` exists for a cheaper zoom — relayout the existing runs instead of
 * rebuilding them — and is deliberately not used yet. It is a second code path
 * whose correctness across the same three races would need its own proof, and
 * Phase 5 is about parity, not throughput. A full rebuild per scale change
 * satisfies the supersede contract exactly like the canvas does.
 *
 * ## Supersede, don't race
 *
 * The effect depends on `(enabled, engine, status, container, documentKey,
 * currentPage, scale)`. Any change, or unmount, cancels the live layer and
 * empties the container. `TextLayer#cancel()` rejects the in-flight `render()`
 * with an `AbortException` — recognised and dropped, never surfaced. Because every
 * await is followed by a `cancelled` check, a text-content lookup that settles
 * late cannot construct a layer over the new page's container, and cannot publish
 * state either. That is the whole of the document-switch, page-switch and zoom
 * protection; it is the mechanism `useNativePdfRender` already uses for the canvas.
 *
 * ## One `getTextContent()` per page, per document
 *
 * A zoom changes the scale, not the text, so the resolved `TextContent` is cached
 * for the current page for as long as the document identity holds. The cache
 * holds the *promise* and is written only when a lookup starts, so a slow page
 * cannot overwrite a newer entry by resolving late. It is cleared on document
 * identity change and on unmount. Nothing is cached globally and nothing survives
 * a document change — this is a page-level lifetime, not a global store.
 */
import type { NativePdfDocumentStatus } from '@features/pdf/native/useNativePdfDocument'
import type { NativePdfEngineHandle } from '@features/pdf/native/useNativePdfEngine'

import { type PDFPageProxy, TextLayer } from 'pdfjs-6'
import { type RefObject, useEffect, useRef, useState } from 'react'

/**
 * `pdfjs-6` exports `TextLayer` but not the `TextContent` shape, so the type is
 * derived from the only method that produces it. That also keeps the cache typed
 * by the real API instead of a hand-written mirror of it.
 */
type NativeTextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>

interface UseNativePdfTextLayerOptions {
  enabled: boolean
  engine: NativePdfEngineHandle
  status: NativePdfDocumentStatus
  /** The page's text-layer element; it exists only while the native viewer renders. */
  textLayerRef: RefObject<HTMLElement | null>
  /**
   * Document identity — `(pdfUrl, reloadKey)`. The text-content cache hangs off
   * it, so a reload or a different file starts clean even though the page number
   * is unchanged.
   */
  documentKey: string
  /** 1-based. */
  currentPage: number
  scale: number
}

export interface NativePdfTextLayerHandle {
  /**
   * Message for a genuine text-layer failure. `null` while rendering and while
   * the layer is torn down; cancellation is never an error.
   */
  textLayerError: string | null
}

/** Keep a text-layer failure to one safe line, as the canvas path does. */
function toTextLayerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}

/** PDF.js reports a cancelled text layer with `AbortException`, not a render failure. */
function isTextLayerAborted(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortException'
}

interface CachedTextContent {
  pageNumber: number
  promise: Promise<NativeTextContent>
}

export function useNativePdfTextLayer({
  enabled,
  engine,
  status,
  textLayerRef,
  documentKey,
  currentPage,
  scale
}: UseNativePdfTextLayerOptions): NativePdfTextLayerHandle {
  const [textLayerError, setTextLayerError] = useState<string | null>(null)
  const textContentRef = useRef<CachedTextContent | null>(null)

  // The text content belongs to the document, so it goes when the identity does.
  useEffect(() => {
    textContentRef.current = null
    return () => {
      textContentRef.current = null
    }
  }, [documentKey])

  useEffect(() => {
    const container = textLayerRef.current
    if (!enabled || status !== 'ready' || !container) return

    const engineInstance = engine()
    if (!engineInstance) return

    let cancelled = false
    // Owned by the effect, so teardown can reach the live instance. PDF.js's own
    // supersede mechanism is `cancel()`; the flag is this hook's UI-side guard.
    let layer: TextLayer | null = null
    // Drop the previous page's spans before the first await: a stale layer must
    // never stay selectable over the new page, and clearing here means the window
    // where it would be visible is empty rather than "until the new render".
    container.replaceChildren()
    setTextLayerError(null)

    void (async () => {
      try {
        const page = await engineInstance.manager.getPage(currentPage)
        if (cancelled) return

        // One viewport, one scale: exactly what the canvas renderer used.
        const viewport = page.getViewport({ scale })

        const cached = textContentRef.current
        const textContentPromise =
          cached?.pageNumber === currentPage
            ? cached.promise
            : (textContentRef.current = {
                pageNumber: currentPage,
                promise: page.getTextContent()
              }).promise
        if (cached?.pageNumber !== currentPage) {
          // A rejected lookup must not be reused; only real text is cached.
          void textContentPromise.catch(() => {
            if (textContentRef.current?.promise === textContentPromise) {
              textContentRef.current = null
            }
          })
        }

        const textContent = await textContentPromise
        if (cancelled) return

        layer = new TextLayer({ textContentSource: textContent, container, viewport })
        await layer.render()
      } catch (error) {
        // Teardown rejects the in-flight render; that is the expected way a
        // superseded layer stops, not something to show the user.
        if (cancelled || isTextLayerAborted(error)) return
        setTextLayerError(toTextLayerErrorMessage(error))
      }
    })()

    return () => {
      cancelled = true
      // The instance, not just the flag: `cancel()` is what stops PDF.js from
      // appending the rest of the stream into a container that is about to be
      // reused for another page.
      layer?.cancel()
      layer = null
      // And the DOM goes regardless — the canvas underneath is about to resize.
      container.replaceChildren()
    }
  }, [enabled, engine, status, textLayerRef, documentKey, currentPage, scale])

  return { textLayerError }
}
