/**
 * Engine instance ownership for one mounted native viewer.
 *
 * ## One manager, one renderer, per mounted instance
 *
 * The native viewer holds exactly one `createPdfDocumentManager()` and one
 * `createPageRenderer()` for its whole mounted life. They are created in an
 * effect (not during render) and destroyed in that effect's cleanup, which is
 * what makes the pair StrictMode-safe and makes teardown idempotent: React runs
 * a cleanup once per mount, and both `renderer.cancel()` and
 * `manager.destroy()` are themselves safe to call when idle or twice.
 *
 * ## Why not created per render
 *
 * A manager owns a `PDFLoadingTask`, which owns the worker-backed document. A
 * renderer owns the current `RenderTask`, which holds the canvas exclusively.
 * Recreating either per render would abandon an in-flight load or render without
 * cancelling it — exactly the leak that produces "multiple render() operations"
 * and orphaned documents.
 *
 * ## Why the handle instead of the instances
 *
 * The instances only exist after the enabling effect has run, so they are read
 * through a stable accessor rather than carried as render values.
 *
 * Nothing here imports React into the engine: the dependency direction stays
 * `UI → engine → pdfjs-dist`.
 */
import {
  createPageRenderer,
  createPdfDocumentManager,
  type PdfDocumentManager,
  type PdfPageRenderer
} from '@features/pdf/engine'

import { useCallback, useEffect, useRef } from 'react'

interface NativePdfEngine {
  manager: PdfDocumentManager
  renderer: PdfPageRenderer
}

/**
 * Reads the live engine: `null` before the viewer is enabled, after it is
 * disabled, and after teardown.
 *
 * A function rather than the instance itself, because the instances only exist
 * once the enabling effect has run. Returning them as state would force an extra
 * render pass, and returning a possibly-null object as a render value would make
 * every downstream effect re-run on the null → instance transition. This
 * identity is stable for the component's life and is safe to read from an effect
 * body.
 */
export type NativePdfEngineHandle = () => NativePdfEngine | null

export function useNativePdfEngine(enabled: boolean): NativePdfEngineHandle {
  const engineRef = useRef<NativePdfEngine | null>(null)

  // Stable for the component's life: downstream effects depend on this
  // identity, and a fresh function every render would restart every one of them.
  const get = useCallback(() => engineRef.current, [])

  useEffect(() => {
    if (!enabled) return

    const engine: NativePdfEngine = {
      manager: createPdfDocumentManager(),
      renderer: createPageRenderer()
    }
    engineRef.current = engine

    return () => {
      // Drop the handle first so no effect can read a half-torn-down engine.
      engineRef.current = null
      // Order matters: cancel the render before destroying the document, so a
      // render in flight is stopped while its page proxy is still usable.
      engine.renderer.cancel()
      engine.manager.destroy()
    }
  }, [enabled])

  return get
}
