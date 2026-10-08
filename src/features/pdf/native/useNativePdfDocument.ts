/**
 * Native document lifecycle: URL + reload signal → a ready document, a page
 * count and the first page's size.
 *
 * ## What is the document identity
 *
 * `(pdfUrl, reloadKey)`, the identity every layer keys on. A different file is a
 * different identity, and so is Reload of the *same* file: the URL is unchanged
 * but the user asked for a fresh document, so it must go through a new load
 * rather than reuse the live one.
 *
 * ## Stale work cannot publish
 *
 * Two independent guards, because they cover different windows:
 *
 *   - the engine's generation counter makes a superseded `load()` resolve to
 *     `null` and destroys the abandoned task
 *   - this hook's per-effect `cancelled` flag drops anything that settles after
 *     the identity changed or the viewer went away, including the `getPage(1)`
 *     that measures the page
 *
 * The first is the engine's invariant; the second is the UI-side identity guard,
 * and without it a slow `getPage` on a superseded document would still set state
 * for the new one.
 *
 * ## No state update after unmount
 *
 * Every `await` is followed by a `cancelled` check, so a load that settles after
 * teardown updates nothing.
 */
import type { NativePdfEngineHandle } from '@features/pdf/native/useNativePdfEngine'

import { useEffect, useState } from 'react'

/** `idle` = no document requested (flag off, or no URL); `ready` = a page can be fetched. */
export type NativePdfDocumentStatus = 'idle' | 'loading' | 'ready' | 'error'

interface NativePdfPageDimensions {
  width: number
  height: number
  /**
   * The page's `/UserUnit`, as PDF.js reports it on `PageViewport#userUnit`.
   *
   * `PageViewport` multiplies the requested scale by it before computing the page's
   * size, so this is the same factor the canvas is painted at — which is why it
   * cannot be left out of the page box's `--total-scale-factor`. Read from the first
   * page: `/UserUnit` is a per-page entry but exporters set it document-wide, and it
   * is the only place a fit-scale input already comes from.
   */
  userUnit: number
}

interface UseNativePdfDocumentOptions {
  enabled: boolean
  engine: NativePdfEngineHandle
  pdfUrl: string
  /** Bumped by Reload; same URL, new document lifecycle. */
  reloadKey: number
}

interface UseNativePdfDocumentResult {
  status: NativePdfDocumentStatus
  totalPages: number
  /** First page at scale 1 — the input to the shared fit-scale calculation. */
  pageDimensions: NativePdfPageDimensions | null
  /** Human-readable load failure, already reduced to a safe message. */
  loadError: string | null
}

/**
 * Reduce a load failure to a message safe to show.
 *
 * PDF.js errors carry a stack trace and internal names (`PasswordException`,
 * `InvalidPDFException`, …). None of that belongs in the UI, so only `message`
 * is kept, and it is bounded in length.
 */
function toLoadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}

export function useNativePdfDocument({
  enabled,
  engine,
  pdfUrl,
  reloadKey
}: UseNativePdfDocumentOptions): UseNativePdfDocumentResult {
  const [status, setStatus] = useState<NativePdfDocumentStatus>('idle')
  const [totalPages, setTotalPages] = useState(0)
  const [pageDimensions, setPageDimensions] = useState<NativePdfPageDimensions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const identity = `${pdfUrl}::${reloadKey}`
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !pdfUrl) {
      setStatus('idle')
      setTotalPages(0)
      setPageDimensions(null)
      setLoadError(null)
      setLoadedIdentity(null)
      return
    }

    const engineInstance = engine()
    // The enabling effect that creates the engine is declared before this one,
    // so it has already run. A null here means the viewer was disabled again in
    // the same commit; there is nothing to load into.
    if (!engineInstance) return

    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    setTotalPages(0)
    setPageDimensions(null)

    void (async () => {
      try {
        const document_ = await engineInstance.manager.load(pdfUrl)
        if (cancelled) return
        // `null` means the engine superseded this load (a newer document won).
        if (!document_) return

        const firstPage = await engineInstance.manager.getPage(1)
        if (cancelled) return
        const viewport = firstPage.getViewport({ scale: 1 })

        setTotalPages(document_.numPages)
        setPageDimensions({
          width: viewport.width,
          height: viewport.height,
          userUnit: viewport.userUnit
        })
        setLoadedIdentity(identity)
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setLoadError(toLoadErrorMessage(error))
        setLoadedIdentity(identity)
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
    // `reloadKey` is the reload signal: it is what makes the same URL start a
    // new document lifecycle even though nothing else in the closure changed.
  }, [enabled, engine, pdfUrl, reloadKey, identity])

  // Hide the outgoing document's metadata during the identity-changing render,
  // before effects consume the new resume page and initial fit exactly once.
  if (loadedIdentity !== identity) {
    return {
      status: enabled && pdfUrl ? 'loading' : 'idle',
      totalPages: 0,
      pageDimensions: null,
      loadError: null
    }
  }
  return { status, totalPages, pageDimensions, loadError }
}
