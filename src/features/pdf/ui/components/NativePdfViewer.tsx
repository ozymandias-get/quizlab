/**
 * Native canvas PDF viewer — the first UI consumer of `features/pdf/engine`.
 *
 * ## Scope (Phase 4)
 *
 * Document load, one page, one canvas, page state, scale state, fit scale,
 * reload, render cancellation and cleanup. Everything else — text layer,
 * annotation layer, links, search, selection, capture, progress architecture —
 * is intentionally absent and stays on the legacy path.
 *
 * ## What this component deliberately does not do
 *
 *  - it emits no `rpv-*` class name and imports no `@react-pdf-viewer` type, so
 *    the legacy viewer CSS cannot accidentally style it and the native path has
 *    no dependency on the package it is replacing
 *  - it creates no document manager and no page renderer: `useNativePdfController`
 *    owns exactly one of each per mounted instance, so the count is a property of
 *    the controller rather than of the JSX
 *  - it does not register the loaded document with `activePdfDocumentRegistry`.
 *    That registry exists so the legacy capture path can reuse the live proxy;
 *    the native document has its own lifecycle owner and is not shared with it
 *
 * ## Stable hooks for the tests
 *
 * `data-native-pdf-canvas`, `data-native-pdf-loading` and `data-native-pdf-error`
 * are the test surface. They exist so tests can assert the single canvas, the
 * loading state and the error fallback without depending on layout or on any RPV
 * class name.
 *
 * ## CSS
 *
 * No stylesheet is touched. The wrapper reuses `pdf-canvas-container` — QuizLab's
 * own container class, not an RPV one — because it is the GPU-containment
 * mechanism the performance baseline depends on, and the rest is Tailwind
 * utilities. RPV's own DOM selectors are not applied to the native canvas.
 */
import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import { InlineSpinner } from '@shared/ui/components/primitives'

import type { RefObject } from 'react'

interface NativePdfViewerProps {
  controller: NativePdfController
  canvasRef: RefObject<HTMLCanvasElement | null>
  t: (key: string) => string
  tt: (key: string) => string
}

function NativePdfViewer({ controller, canvasRef, t, tt }: NativePdfViewerProps) {
  const { status, currentPage, loadError, renderError } = controller

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
      <canvas
        ref={canvasRef}
        data-native-pdf-canvas
        data-native-pdf-page={currentPage}
        className="shadow-lg"
      />
    </div>
  )
}

export default NativePdfViewer
