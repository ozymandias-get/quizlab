/**
 * The native annotation layer: PDF.js's own `AnnotationLayer`, mounted for the
 * current page at the current scale, inside the native boundary.
 *
 * ## Why PDF.js renders it, not us
 *
 * An annotation is not "a rectangle somewhere". `AnnotationLayer` resolves the
 * annotation's PDF-space rectangle into the viewport, applies the page's rotation and
 * the annotation's own `noRotate`/`rotation`, builds the widget's DOM (a real
 * `<textarea>` for a multiline text field, a `<select>` for a choice), draws border
 * styles, honours hidden and optional-content entries, and turns a link annotation
 * into an anchor wired to a link service. Re-implementing any of that is a rewrite,
 * not a migration — so, exactly as with `TextLayer`, QuizLab renders the *behaviour
 * around* the layer and lets PDF.js render the geometry.
 *
 * ## The API that actually exists in 6.x
 *
 * Verified against `node_modules/pdfjs-dist` (`pdfjs-dist@6.4.299`) —
 * `types/src/display/annotation_layer.d.ts` and `build/pdf.mjs`:
 *
 * ```js
 * new AnnotationLayer({ div, page, viewport, linkService })   // + optional managers
 * AnnotationLayer#render({ annotations, renderForms, enableScripting, hasJSActions })
 * AnnotationLayer#update({ viewport })
 * AnnotationLayer#destroy()
 * ```
 *
 * There is **no `cancel()`**. That is the one place this hook must not copy the text
 * layer's shape: `TextLayer` streams into a container and has to be stopped
 * mid-stream, while `AnnotationLayer.render()` builds every element synchronously and
 * awaits only the (empty, when there is no struct tree) aria pass. So the guards here
 * are the `cancelled` flag plus `destroy()`, not a cancellation signal.
 *
 * `div` must be an `HTMLDivElement` and `page` must be the `PDFPageProxy` — the
 * element factory reads `page.view` when it normalises annotation points. That is
 * also why the layer lives in the viewer boundary and *not* in `features/pdf/engine`,
 * which stays React- and DOM-free.
 *
 * ## One viewport, shared with the canvas and the text layer
 *
 * The layer is built from `page.getViewport({ scale })` with the *same* scale the
 * canvas renderer used, in the same `[data-native-pdf-page]` box. PDF.js's
 * `setLayerDimensions` then sizes the layer from `--total-scale-factor` and writes
 * `data-main-rotation`, so rotation is folded in by the library rather than by us.
 *
 * ## `renderForms: false`, `enableScripting: false`
 *
 * - `renderForms: false` means a widget with a baked-in appearance is **not**
 *   re-created as an input. The canvas already shows what the form looked like when
 *   the file was authored, so the page reads correctly and cannot be edited. That is
 *   the honest Phase 6 position: display, not form editing. Form state, focus,
 *   `annotationStorage` writes and saving are all out of scope.
 * - `enableScripting: false` matches the document-level `enableScripting: false` in
 *   `pdfDocumentOptions.ts`. It is what keeps `LinkAnnotationElement` from binding a
 *   JavaScript action (`_bindJSAction` needs *both* `enableScripting` and
 *   `hasJSActions`), and a document `OpenAction` has no runner here at all.
 *
 * ## Supersede, don't race
 *
 * The effect depends on `(enabled, engine, status, container, documentKey,
 * currentPage, scale)`. Any change, or unmount, destroys the live layer and empties
 * the container. Every DOM-touching call is guarded by `cancelled` **before** it
 * happens — never after — because the layer div outlives the effect: a late append
 * from a superseded run would land in the *new* page's box, and clearing the div from
 * a stale run would erase the page that is currently on screen.
 *
 * ## Degradation
 *
 * A failure becomes `annotationLayerError` on the controller and is deliberately not
 * the error shell: the canvas is already painted and the text layer already mounted,
 * so a lost annotation layer costs links and annotation chrome, not the document. That
 * is the same trade `textLayerError` makes, and the error is still observable.
 */
import type { NativePdfDocumentStatus } from '@features/pdf/native/useNativePdfDocument'
import type { NativePdfEngineHandle } from '@features/pdf/native/useNativePdfEngine'

import { AnnotationLayer } from 'pdfjs-dist'
import { type RefObject, useEffect, useRef, useState } from 'react'

import {
  createNativePdfLinkService,
  type NativePdfLinkService,
  openNativeExternalPdfLink
} from './nativePdfLinkService'

interface UseNativePdfAnnotationLayerOptions {
  enabled: boolean
  engine: NativePdfEngineHandle
  status: NativePdfDocumentStatus
  /** The page's annotation-layer element; it exists only while the native viewer renders. */
  annotationLayerRef: RefObject<HTMLElement | null>
  /**
   * Document identity — `(pdfUrl, reloadKey)`. Listed so a reload supersedes the
   * layer and discards the previous document's link service even though the page
   * number is unchanged.
   */
  documentKey: string
  /** 1-based. */
  currentPage: number
  scale: number
  /** The native page navigation an internal destination resolves through. */
  jumpToPage: (pageNumber: number) => void
}

export interface NativePdfAnnotationLayerHandle {
  /**
   * Message for a genuine annotation-layer failure. `null` while rendering, while the
   * layer is torn down, and for a superseded run.
   */
  annotationLayerError: string | null
}

/** Keep an annotation-layer failure to one safe line, as the canvas path does. */
function toAnnotationLayerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}

/** The annotations and options `AnnotationLayer#render` actually reads. */
type AnnotationLayerRenderOptions = {
  annotations: unknown[]
  renderForms?: boolean
  enableScripting?: boolean
  hasJSActions?: boolean
}

/**
 * PDF.js's published `render()` parameter type is the whole constructor payload — it
 * demands `div: HTMLDivElement`, `page`, `viewport` and a `linkService: PDFLinkService`,
 * the class this viewer deliberately does not use — while its implementation destructures
 * only `annotations`, `optionalContentConfig` and a handful of options. One assertion, at
 * one call site, is the honest cost of that type bug: an `as any` would take the checking
 * off the keys that do matter, and echoing the inert keys in would be a lie about what
 * `render()` is being given.
 */
function annotationLayerRenderOptions(
  options: AnnotationLayerRenderOptions
): Parameters<AnnotationLayer['render']>[0] {
  return options as unknown as Parameters<AnnotationLayer['render']>[0]
}

/**
 * The collaborators `AnnotationLayer` accepts but a headless viewer has no use for.
 *
 * PDF.js's generated declaration types *every* key its implementation destructures as
 * required — including the accessibility, structure-tree, comment, editor and canvas-map
 * managers that belong to the full `web/pdf_viewer` stack — so a minimal call site
 * fails to type-check. The alternatives were an `as any`, which would disable checking
 * on the four keys that do matter, or an intersection type plus a cast, which is the
 * same trade.
 *
 * `null` is safe for all six: the class defaults them itself
 * (`this.#commentManager = commentManager || null`, `structTreeLayer || null`) and every
 * other read of them is optional-chained or guarded by an early return.
 */
const ANNOTATION_LAYER_MANAGERS: Omit<
  ConstructorParameters<typeof AnnotationLayer>[0],
  'div' | 'page' | 'viewport' | 'linkService'
> = {
  accessibilityManager: null,
  annotationCanvasMap: null,
  annotationEditorUIManager: null,
  annotationStorage: null,
  commentManager: null,
  structTreeLayer: null
}

export function useNativePdfAnnotationLayer({
  enabled,
  engine,
  status,
  annotationLayerRef,
  documentKey,
  currentPage,
  scale,
  jumpToPage
}: UseNativePdfAnnotationLayerOptions): NativePdfAnnotationLayerHandle {
  const [annotationLayerError, setAnnotationLayerError] = useState<string | null>(null)

  // Read through a ref so the effect below does not have to re-run — and therefore
  // rebuild the layer — when the navigation callback identity changes.
  const jumpToPageRef = useRef(jumpToPage)
  jumpToPageRef.current = jumpToPage

  // The link service belongs to the layer that can actually emit a click, so it is
  // created and disposed with the layer rather than held in a longer-lived ref. It
  // holds no state of its own, and disposing it is what stops an in-flight named
  // destination from moving the page after the layer it was rendered into is gone.
  useEffect(() => {
    const container = annotationLayerRef.current
    if (!enabled || status !== 'ready' || !container) return

    const engineInstance = engine()
    if (!engineInstance) return

    let cancelled = false
    let layer: AnnotationLayer | null = null
    let linkService: NativePdfLinkService | null = null

    // A superseded layer must not leave a clickable link over the new page before the
    // replacement exists, so the container goes first — before the first await.
    container.replaceChildren()
    setAnnotationLayerError(null)

    void (async () => {
      try {
        const page = await engineInstance.manager.getPage(currentPage)
        if (cancelled) return

        // One viewport, one scale: exactly what the canvas renderer used.
        const viewport = page.getViewport({ scale })
        // `display` is the intent this viewer means: it is what the canvas painted.
        // The print-only annotations are never seen here.
        const annotations = await page.getAnnotations({ intent: 'display' })
        if (cancelled) return

        linkService = createNativePdfLinkService({
          getPdfDocument: () => engineInstance.manager.getDocument(),
          jumpToPage: (pageNumber) => jumpToPageRef.current(pageNumber),
          openExternal: openNativeExternalPdfLink
        })

        layer = new AnnotationLayer({
          div: container,
          page,
          viewport,
          linkService,
          ...ANNOTATION_LAYER_MANAGERS
        })
        // Everything from here to the end of this function is synchronous in PDF.js
        // 6 apart from an empty aria pass, so the elements are in `container` before
        // `render()` resolves. Nothing after the await may touch `container`.
        await layer.render(
          annotationLayerRenderOptions({
            annotations,
            renderForms: false,
            enableScripting: false,
            hasJSActions: false
          })
        )
      } catch (error) {
        // A superseded run is not a failure, and neither is a destroyed engine.
        if (cancelled) return
        setAnnotationLayerError(toAnnotationLayerErrorMessage(error))
      }
    })()

    return () => {
      cancelled = true
      // `destroy()` empties the div and drops every element the layer built; the
      // explicit `replaceChildren()` covers the window before the layer was
      // constructed, and is harmless afterwards.
      layer?.destroy()
      layer = null
      linkService?.dispose()
      linkService = null
      container.replaceChildren()
    }
  }, [enabled, engine, status, annotationLayerRef, documentKey, currentPage, scale])

  return { annotationLayerError }
}
