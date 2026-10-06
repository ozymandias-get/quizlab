/**
 * Native page state: 1-based `currentPage`, clamped to the loaded document.
 *
 * ## Why the state machine here is a plain setter
 *
 * `usePdfNavigation` needs a target/acknowledge/settle machine because it does
 * not own the page: `@react-pdf-viewer` reports the page it is currently on, and
 * a programmatic jump can emit a late callback for the page being torn down, so
 * the hook installs a target that only the matching callback may acknowledge.
 *
 * The native viewer owns the page outright — there is no external reporter that
 * can disagree — so the machine would be inert. Rapid navigation is instead made
 * safe where it actually happens: the render effect supersedes the previous
 * page's render, and a settled-but-stale render is dropped by its own guard.
 *
 * ## `initialPage` is consumed per document identity, not per prop change
 *
 * `initialPage` mirrors persisted reading progress and therefore changes on every
 * page turn. Consuming it on every change would reset the viewer to the saved
 * page mid-read, so it is applied once per `(pdfUrl, reloadKey)` identity — the
 * same rule the legacy resume flow uses.
 *
 * ## Reading progress
 *
 * The native path reports progress through the existing
 * `onReadingProgressChange` callback with the same shape the legacy navigation
 * hook emits. The persistence pipeline itself is untouched; this only keeps the
 * feature working on the native path.
 */
import type { ReadingProgressUpdate } from '@features/pdf/hooks/types'
import { clampPdfPage } from '@features/pdf/native/nativePdfBounds'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Mirrors the legacy debounce so progress writes stay off the render path. */
const PROGRESS_DEBOUNCE_MS = 300

interface UseNativePdfPageStateOptions {
  enabled: boolean
  pdfUrl: string
  reloadKey: number
  totalPages: number
  initialPage?: number
  /** Used only as the progress key; no path is persisted when absent. */
  pdfPath: string | null
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
}

export interface NativePdfPageHandle {
  /** 1-based page currently shown. */
  currentPage: number
  goToPreviousPage: () => void
  goToNextPage: () => void
  jumpToPage: (page: number) => void
}

export function useNativePdfPageState({
  enabled,
  pdfUrl,
  reloadKey,
  totalPages,
  initialPage,
  pdfPath,
  onReadingProgressChange
}: UseNativePdfPageStateOptions): NativePdfPageHandle {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPagesRef = useRef(totalPages)
  totalPagesRef.current = totalPages

  const onReadingProgressChangeRef = useRef(onReadingProgressChange)
  onReadingProgressChangeRef.current = onReadingProgressChange

  const identity = `${pdfUrl}:${reloadKey}`
  const consumedIdentityRef = useRef<string | null>(null)

  // Consume `initialPage` once per document identity. The clamp runs here too,
  // so a resume page saved against a shorter revision of the file cannot push
  // the viewer past the end before `numPages` is known and clamped below.
  useEffect(() => {
    if (!enabled) return
    if (consumedIdentityRef.current === identity) return
    consumedIdentityRef.current = identity
    setCurrentPage(clampPdfPage(initialPage ?? 1, totalPages))
  }, [enabled, identity, initialPage, totalPages])

  // Clamp against the page count as soon as it is known: the resume page may
  // exceed it, and a document switch can shrink the document under the viewer.
  useEffect(() => {
    setCurrentPage((page) => {
      const clamped = clampPdfPage(page, totalPages)
      return clamped === page ? page : clamped
    })
  }, [totalPages])

  useEffect(() => {
    if (!enabled || !pdfPath) return
    const timer = setTimeout(() => {
      onReadingProgressChangeRef.current?.({
        path: pdfPath,
        page: currentPage,
        lastOpenedAt: Date.now()
      })
    }, PROGRESS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [enabled, pdfPath, currentPage])

  useEffect(() => {
    if (!enabled || !pdfPath || totalPages <= 0) return
    onReadingProgressChangeRef.current?.({
      path: pdfPath,
      totalPages,
      lastOpenedAt: Date.now()
    })
  }, [enabled, pdfPath, totalPages])

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((page) => clampPdfPage(page - 1, totalPagesRef.current))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage((page) => clampPdfPage(page + 1, totalPagesRef.current))
  }, [])

  const jumpToPage = useCallback((page: number) => {
    setCurrentPage((current) => {
      // Jump is relative to nothing: the requested page is absolute, but an
      // unparseable request must not move the viewer off the current page.
      if (!Number.isFinite(page)) return current
      return clampPdfPage(page, totalPagesRef.current)
    })
  }, [])

  return { currentPage, goToPreviousPage, goToNextPage, jumpToPage }
}
