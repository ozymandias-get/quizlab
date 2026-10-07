/**
 * Ownership of the native `PDFLoadingTask` / `PDFDocumentProxy` pair.
 *
 * ## Ownership
 *
 * The manager owns the loading task it creates, and the loading task owns the
 * document. This matters because PDF.js 6 changed the teardown shape: in 3.11.174
 * `PDFDocumentProxy` had its own `destroy()`, but in 6.4.299 the proxy exposes
 * only `cleanup()`, and `PDFDocumentLoadingTask.destroy()` is the call that
 * "aborts all network requests and destroys the worker". So everything in this
 * module tears down through the **loading task**, never through a document. That
 * includes capture: `captureDocument.ts` loads its isolated document through this
 * same manager, so there is no second document-lifecycle path left in the app.
 *
 * ## Superseding a load
 *
 * PDF loading is async and a user can switch documents while a large file is
 * still streaming, so two mechanisms cooperate:
 *
 *   1. starting a load disposes the previous one immediately — the superseded
 *      task is destroyed, which aborts its network requests, so an abandoned
 *      document is never decoded
 *   2. a generation counter covers the window where the promise has already
 *      settled before the abort lands; such a load resolves to `null` instead of
 *      publishing
 *
 * `disposeActiveDocument()` is the single owner of task teardown, and the
 * generation only ever advances immediately after it runs — so a task observed
 * as stale has already been destroyed and is not destroyed twice.
 *
 * Resolving to `null` mirrors how the capture path drops a stale render
 * (`usePdfCaptureActions`) rather than handing back a value nobody should use.
 *
 * ## Scope
 *
 * No React, no DOM, no viewer concerns. `activePdfDocumentRegistry` borrows the
 * document this manager owns and nothing here knows the registry exists, so the
 * capture path cannot introduce a second document lifecycle.
 */
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { getDocument } from 'pdfjs-dist'

import { createPageCache, type PdfPageCache } from './pageCache'
import { createPdfDocumentOptions, type PdfDocumentSource } from './pdfDocumentOptions'
import { initializeNativePdfWorker } from './pdfWorker'

export interface PdfDocumentManager {
  /**
   * Load a document, replacing whatever was active.
   *
   * Resolves to the active document, or `null` when this load was superseded
   * before it resolved (its task is destroyed).
   */
  load(source: PdfDocumentSource): Promise<PDFDocumentProxy | null>
  /** Re-load the most recently requested source. */
  reload(): Promise<PDFDocumentProxy | null>
  /** The active document, or `null` before the first load / after teardown. */
  getDocument(): PDFDocumentProxy | null
  /** Page proxy for `pageNumber` (1-based), served from the cache. */
  getPage(pageNumber: number): Promise<PDFPageProxy>
  /** Tear everything down. Safe to call repeatedly. */
  destroy(): void
  readonly destroyed: boolean
}

/** Tear down a loading task without letting a teardown failure escape. */
function disposeTask(task: PDFDocumentLoadingTask | null): void {
  if (!task) return
  void Promise.resolve(task.destroy()).catch(() => {
    // Best-effort: a failed destroy must not mask the caller's own error path or
    // leave the manager unusable.
  })
}

export function createPdfDocumentManager(): PdfDocumentManager {
  let generation = 0
  let loadingTask: PDFDocumentLoadingTask | null = null
  let activeDocument: PDFDocumentProxy | null = null
  let pageCache: PdfPageCache | null = null
  let lastSource: PdfDocumentSource | null = null
  let destroyed = false

  function disposeActiveDocument(): void {
    pageCache?.clear()
    pageCache = null
    activeDocument = null
    const task = loadingTask
    loadingTask = null
    disposeTask(task)
  }

  async function load(source: PdfDocumentSource): Promise<PDFDocumentProxy | null> {
    if (destroyed) {
      throw new Error('PdfDocumentManager: load() called after destroy()')
    }

    initializeNativePdfWorker()

    const myGeneration = ++generation
    lastSource = source
    // Abort whatever was active or in flight before starting the new load.
    disposeActiveDocument()

    const task = getDocument(createPdfDocumentOptions(source))
    loadingTask = task

    let resolved: PDFDocumentProxy
    try {
      resolved = await task.promise
    } catch (error) {
      // Only clear the slot if this task is still the current one; a newer load
      // has already installed its own.
      if (loadingTask === task) loadingTask = null
      throw error
    }

    if (destroyed || myGeneration !== generation) {
      // Superseded while loading.
      //
      // The task was already torn down by `disposeActiveDocument()` — the
      // generation only ever advances immediately after that call, so there is
      // no path that reaches here for a task which has not been destroyed. This
      // branch therefore only has to stop the document from being published;
      // destroying again would be redundant work and would obscure the invariant
      // that `disposeActiveDocument` is the single owner of task teardown.
      return null
    }

    activeDocument = resolved
    pageCache = createPageCache(resolved)
    return resolved
  }

  return {
    load,

    async reload(): Promise<PDFDocumentProxy | null> {
      if (lastSource === null) {
        throw new Error('PdfDocumentManager: reload() called before any load()')
      }
      return load(lastSource)
    },

    getDocument(): PDFDocumentProxy | null {
      return activeDocument
    },

    async getPage(pageNumber: number): Promise<PDFPageProxy> {
      if (!pageCache) {
        throw new Error('PdfDocumentManager: getPage() called with no active document')
      }
      return pageCache.getPage(pageNumber)
    },

    destroy(): void {
      if (destroyed) return
      destroyed = true
      // Invalidate any in-flight load so it cannot publish after teardown.
      generation += 1
      disposeActiveDocument()
    },

    get destroyed(): boolean {
      return destroyed
    }
  }
}
