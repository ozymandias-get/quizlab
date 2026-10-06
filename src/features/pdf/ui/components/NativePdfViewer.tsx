/**
 * Native canvas PDF viewer — the first UI consumer of `features/pdf/engine`.
 *
 * ## Scope (Phase 5)
 *
 * Document load, one page, one canvas, the PDF.js text layer over it, page state,
 * scale state, fit scale, reload, cancellation and cleanup. Still absent, and
 * deliberately so: annotation layer, links, search, capture, progress
 * architecture, context menu — all of which stay on the legacy path.
 *
 * ## The page box
 *
 * ```
 * pdf-canvas-container          scroll + GPU containment (QuizLab's own class)
 * └── data-native-pdf-page     position: relative — the layer's positioning box
 *     ├── data-native-pdf-canvas
 *     └── data-native-pdf-text-layer
 * ```
 *
 * The canvas and the text layer are siblings inside one page box because PDF.js
 * positions text runs as percentages of the layer and the layer as
 * `var(--total-scale-factor) * <page size>` — both of which only line up with the
 * canvas when they share a box sized by the same viewport. See
 * `nativePdfTextLayer.css`.
 *
 * ## A failed text layer is not a failed page
 *
 * The controller also carries `textLayerError`, and it is deliberately **not**
 * folded into the error shell below. A text-layer failure means the page is
 * readable but not selectable and not extractable — the canvas is already painted
 * and hiding it behind an error would take away a working reader to report a
 * degraded one. The value stays on the controller so the condition is observable
 * (and asserted) instead of silent; when annotation-level capability reporting
 * arrives, that is where it surfaces.
 *
 * ## Stable hooks for the tests
 *
 * `data-native-pdf-canvas`, `data-native-pdf-page`, `data-native-pdf-text-layer`,
 * `data-native-pdf-text-page`, `data-native-pdf-loading` and
 * `data-native-pdf-error` are the test surface. They exist so tests can assert the
 * single canvas, the single text layer, which page each of them holds, the
 * loading state and the error fallback without depending on layout or on any RPV
 * class name.
 *
 * Page identity lives on the page container only. The canvas and the text layer
 * are addressed by their own attributes, so "the page element" is never ambiguous
 * to a `querySelector`.
 *
 * ## CSS
 *
 * No shared stylesheet is touched. The wrapper reuses `pdf-canvas-container` —
 * QuizLab's own container class, not an RPV one — because it is the
 * GPU-containment mechanism the performance baseline depends on, and the rest is
 * Tailwind utilities. The text layer's layout contract ships next to the layer's
 * owner, as `features/pdf/native/nativePdfTextLayer.css`, and is imported here
 * beside the element it styles; it is scoped to `data-native-pdf-*` attributes,
 * so it cannot match the legacy viewer's markup.
 */
import '@features/pdf/native/nativePdfTextLayer.css'

import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { InlineSpinner } from '@shared/ui/components/primitives'

import type { CSSProperties, RefObject } from 'react'

interface NativePdfViewerProps {
  controller: NativePdfController
  canvasRef: RefObject<HTMLCanvasElement | null>
  textLayerRef: RefObject<HTMLDivElement | null>
  t: (key: string) => string
  tt: (key: string) => string
}

/**
 * PDF.js sizes the text layer as `--total-scale-factor × <page size in points>`,
 * so this custom property has to carry the *viewport* scale — the same number
 * `pageRenderer` hands to `page.render()`. That is what keeps a selected span's
 * box on the glyph the canvas painted, at every zoom level.
 */
function totalScaleFactorStyle(scale: number): CSSProperties {
  return { '--total-scale-factor': String(scale) } as CSSProperties
}

function NativePdfViewer({ controller, canvasRef, textLayerRef, t, tt }: NativePdfViewerProps) {
  const { status, currentPage, scale, loadError, renderError } = controller

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
    <div className="pdf-canvas-container flex items-start justify-center overflow-auto">
      <div data-native-pdf-page={currentPage} style={totalScaleFactorStyle(scale)}>
        <canvas ref={canvasRef} data-native-pdf-canvas className="block shadow-lg" />
        <div
          ref={textLayerRef}
          data-native-pdf-text-layer
          data-native-pdf-text-page={currentPage}
        />
      </div>
    </div>
  )
}

export default NativePdfViewer
