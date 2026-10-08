/**
 * Native canvas PDF viewer — the first UI consumer of `features/pdf/engine`.
 *
 * ## Scope (Phase 7)
 *
 * Document load, one page, one canvas, the PDF.js text layer and annotation layer over
 * it, search with its highlight overlay, internal and external links, page state, scale
 * state, fit scale, reload, cancellation and cleanup. Still absent, and deliberately so:
 * capture, progress architecture, context menu — all of which stay on the legacy path.
 *
 * ## The page box
 *
 * ```
 * data-native-pdf-scroll       flex items-start + overflow-auto — the real scroll container
 * └── data-native-pdf-page     position: relative + m-auto — the centering box
 *     ├── data-native-pdf-canvas
 *     ├── data-native-pdf-text-layer
 *     ├── data-native-pdf-annotation-layer
 *     └── data-native-pdf-search-layer
 * ```
 *
 * The first three are siblings inside one page box, in that order, because PDF.js sizes
 * text runs as percentages of the text layer and the layers as
 * `var(--total-scale-factor) * <page size>` — all of which only line up with the canvas
 * when they share a box sized by the same viewport. The order is PDF.js's own:
 * `LAYERS_ORDER` in `web/pdf_viewer.mjs` numbers a page's layers `canvasWrapper` 0,
 * `textLayer` 1, `annotationLayer` 2, and `PDFPageView#addLayer` inserts them in
 * exactly that sequence.
 *
 * The search layer is the fourth and is **not** a PDF.js layer: it is QuizLab's own
 * highlight overlay, since PDF.js's own find highlights need the web viewer's page views
 * (see `nativePdfSearch.ts`). It is declared last in the DOM and painted between the
 * text layer and the annotation layer by its `z-index`, which is asserted as a contract
 * in `NativePdfViewer.test.tsx` rather than left to render order. See
 * `nativePdfTextLayer.css`, `nativePdfAnnotationLayer.css` and
 * `nativePdfSearchLayer.css`.
 *
 * ## Vertical centering, and why it is an auto margin
 *
 * `[data-native-pdf-scroll]` is the real scroll container: a row flex box with
 * `overflow: auto` that fills `.pdf-canvas-container` and therefore already excludes
 * the bottom toolbar, which is a `shrink-0` flow sibling in `PdfViewerDocument`'s
 * column — not an overlay. Centering inside this box therefore centers against the
 * *available* PDF viewport, not against the window.
 *
 * It used to say `items-start justify-center`, which is horizontal centering only:
 * `align-items: flex-start` pins the page box to the cross-start edge, so a page
 * shorter than the viewport sat flush against the top with all the free space below it.
 *
 * The fix is `m-auto` on the **page box**, and it is deliberately not
 * `items-center` / `justify-center` on the scroll container:
 *
 *  - `align-items` / `justify-content: center` overflow **equally in both directions**
 *    when free space is negative (CSS Flexbox §8.2 `center`, §8.3 `center`). The
 *    start-side overflow then sits *before* the scroll container's scroll origin, so
 *    the top of a tall page — or the left edge of a wide one — cannot be scrolled to.
 *    That is the classic flex + overflow failure, and it is exactly what this viewer
 *    must not do.
 *  - An auto margin is resolved by the layout algorithm *before* alignment: positive
 *    free space is distributed into the margin (§9.5 main axis, §9.6 cross axis), and an
 *    **overflowing** item has its start auto margin set to zero and overflows in the end
 *    direction instead (§9.5 "Otherwise, set all auto margins to zero"; §8.1
 *    "Overflowing boxes ignore their auto margins and overflow in the end direction").
 *    So one declaration centers a short page on both axes and leaves a tall page's top
 *    edge — and a wide page's left edge — flush and scrollable.
 *
 * That is also why `justify-center` came off the scroll container: horizontal centering
 * is now the page box's `margin-inline: auto`, which produces the identical result while
 * the page fits and is the one that keeps the page's left edge reachable once it does
 * not. Centering the page in one place keeps the two axes from drifting apart.
 *
 * `align-items` stays `flex-start` for a second reason: `stretch` would make the page
 * box as tall as the container, which would leave the auto margins no free space to
 * absorb and would grow the box the text and search layers are `inset: 0` against.
 *
 * The margin is on the page wrapper, never on the canvas: canvas + `TextLayer` +
 * `AnnotationLayer` + `SearchLayer` are all children of that one box, so the whole
 * stack moves as a unit and their coordinates cannot drift apart. Nothing here is
 * measured in JavaScript, so zoom and resize are handled by the same layout pass that
 * always ran — a re-render or a refit changes the canvas size and the centering follows
 * it, with no jump and no separate state to fall out of sync.
 *
 * ## A failed layer is not a failed page
 *
 * The controller also carries `textLayerError`, `annotationLayerError` and
 * `searchError`, and all three are deliberately **not** folded into the error shell below.
 * A text-layer failure means the page is readable but not selectable; an
 * annotation-layer failure means it is readable and selectable but has no links; a search
 * failure means it is readable, selectable and linkable but has no results. In every case
 * the canvas is already painted and hiding it behind an error would take away a working
 * reader to report a degraded one. The values stay on the controller so the conditions are
 * observable (and asserted) instead of silent.
 *
 * ## Stable hooks for the tests
 *
 * `data-native-pdf-canvas`, `data-native-pdf-page`, `data-native-pdf-text-layer`,
 * `data-native-pdf-text-page`, `data-native-pdf-annotation-layer`,
 * `data-native-pdf-search-layer`, `data-native-pdf-loading` and `data-native-pdf-error`
 * are the test surface. They exist so tests can assert the single canvas, the single text
 * layer, the single annotation layer, the single search overlay, which page the text
 * layer holds, the loading state and the error fallback without depending on layout or
 * on any RPV class name.
 *
 * Page identity lives on the page container, and on the text layer alone. The canvas, the
 * annotation layer and the search overlay are addressed by their own attributes and take
 * their page from React state — the search overlay resolves it structurally by walking up
 * to the page box — so "the page element" is never ambiguous to a `querySelector`.
 *
 * ## CSS
 *
 * No shared stylesheet is touched. The wrapper reuses `pdf-canvas-container` —
 * QuizLab's own container class, not an RPV one — because it is the
 * GPU-containment mechanism the performance baseline depends on, and the rest is
 * Tailwind utilities. Each layer's layout contract ships next to its owner, as
 * `features/pdf/native/nativePdfTextLayer.css`,
 * `features/pdf/native/nativePdfAnnotationLayer.css` and
 * `features/pdf/native/nativePdfSearchLayer.css`, and is imported here beside the
 * elements they style; all three are scoped to `data-native-pdf-*` attributes, so none
 * can match the legacy viewer's markup.
 */
import '@features/pdf/native/nativePdfAnnotationLayer.css'
import '@features/pdf/native/nativePdfSearchLayer.css'
import '@features/pdf/native/nativePdfTextLayer.css'

import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { InlineSpinner } from '@shared/ui/components/primitives'

import type { CSSProperties, RefObject } from 'react'

interface NativePdfViewerProps {
  controller: NativePdfController
  canvasRef: RefObject<HTMLCanvasElement | null>
  textLayerRef: RefObject<HTMLDivElement | null>
  annotationLayerRef: RefObject<HTMLDivElement | null>
  searchLayerRef: RefObject<HTMLDivElement | null>
  t: (key: string) => string
  tt: (key: string) => string
}

/**
 * PDF.js sizes the text layer and the annotation layer as
 * `--total-scale-factor × <page size in points>`, so this custom property has to carry
 * the *viewport* scale — the same number `pageRenderer` hands to `page.render()`. That
 * is what keeps a selected span's box, and a link's hitbox, on what the canvas painted,
 * at every zoom level and every rotation.
 *
 * `userUnit` is part of that number, not a separate factor: PDF.js's `PageViewport`
 * does `scale *= userUnit` before sizing, so a document declaring `/UserUnit 2` is
 * painted at `2 × scale` while the layers would otherwise be laid out at `1 × scale` —
 * every word at half size in the top-left quadrant of the page. PDF.js's own viewer
 * publishes the same product as `--total-scale-factor: calc(var(--scale-factor) *
 * var(--user-unit))` for exactly this reason.
 */
function totalScaleFactorStyle(scale: number, userUnit: number): CSSProperties {
  return { '--total-scale-factor': String(scale * userUnit) } as CSSProperties
}

function NativePdfViewer({
  controller,
  canvasRef,
  textLayerRef,
  annotationLayerRef,
  searchLayerRef,
  t,
  tt
}: NativePdfViewerProps) {
  const { status, currentPage, scale, pageUserUnit, loadError, renderError } = controller

  // Null-checked rather than truthiness-checked: a failure with an empty message
  // must still render the error shell, with the unknown-error copy standing in
  // for the missing text.
  const errorMessage = loadError !== null ? loadError : renderError

  if (errorMessage !== null) {
    // Deterministic and non-crashing: the same translations the legacy viewer's
    // `renderError` uses, plus the reduced reason. The PDF.js stack trace stays
    // in the console, never in the UI.
    return (
      <div
        data-native-pdf-error
        className="flex h-full items-center justify-center bg-stone-950/50 p-8 text-center text-red-500 backdrop-blur-sm"
      >
        <p>
          {t('pdf_load_error')}: {errorMessage || t('error_unknown_error')}
        </p>
      </div>
    )
  }

  if (status !== 'ready') {
    return (
      <div
        data-native-pdf-loading
        className="flex h-full min-h-[12rem] w-full items-center justify-center bg-transparent"
      >
        <InlineSpinner
          size="xl"
          className="border-amber-500/25 border-t-amber-500"
          aria-label={tt('loading')}
        />
      </div>
    )
  }

  return (
    <div data-native-pdf-scroll className="pdf-canvas-container flex items-start overflow-auto">
      {/*
        `m-auto` is the whole centering contract, and it lives on the page wrapper
        rather than on the canvas: an auto margin absorbs the free space only when there
        *is* free space and collapses to zero when the page overflows, so a short page
        centers and a tall page keeps its top edge scrollable. Centering the scroll
        container itself would overflow in both directions and strand the page's start
        edge above the scroll origin. See the module note.
      */}
      <div
        data-native-pdf-page={currentPage}
        className="m-auto"
        style={totalScaleFactorStyle(scale, pageUserUnit)}
      >
        <canvas ref={canvasRef} data-native-pdf-canvas className="block shadow-lg" />
        <div
          ref={textLayerRef}
          data-native-pdf-text-layer
          data-native-pdf-text-page={currentPage}
        />
        <div ref={annotationLayerRef} data-native-pdf-annotation-layer />
        {/* Always present, even with no query: one overlay whose children come and go,
            so the DOM contract does not change shape with the search state. */}
        <div ref={searchLayerRef} data-native-pdf-search-layer />
      </div>
    </div>
  )
}

export default NativePdfViewer
