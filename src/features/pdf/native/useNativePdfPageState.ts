/**
 * Native page state: 1-based `currentPage`, clamped to the loaded document.
 *
 * ## Why the state machine here is a plain setter
 *
 * A navigation hook that does not own the page needs a
 * target/acknowledge/settle machine: an external reporter states the page it is
 * currently on, and a programmatic jump can emit a late callback for the page
 * being torn down, so a target is installed that only the matching callback may
 * acknowledge.
 *
 * This viewer owns the page outright — there is no external reporter that
 * can disagree — so the machine would be inert. Rapid navigation is instead made
 * safe where it actually happens: the render effect supersedes the previous
 * page's render, and a settled-but-stale render is dropped by its own guard.
 *
 * ## `initialPage` is consumed per document identity, not per prop change
 *
 * `initialPage` mirrors persisted reading progress and therefore changes on every
 * page turn. Consuming it on every change would reset the viewer to the saved
 * page mid-read, so it is applied once per `(pdfUrl, reloadKey)` identity.
 *
 * ## Reading progress
 *
 * Progress is reported through the existing `onReadingProgressChange` callback,
 * with the shape the persistence pipeline already expects. The pipeline itself is
 * untouched.
 */
import type { ReadingProgressUpdate } from '@features/pdf/hooks/types'
import { registerPendingReadingProgressSource } from '@features/pdf/hooks/useReadingProgressPersistence'
import { clampPdfPage } from '@features/pdf/native/nativePdfBounds'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Debounce so progress writes stay off the render path. */
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

interface NativePdfPageHandle {
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

  /**
   * The page report that is scheduled but not delivered yet.
   *
   * The path travels with the page: a document that is replaced inside the
   * debounce window must still write the page of the document it belonged to.
   */
  const pendingReportRef = useRef<{ path: string; page: number } | null>(null)

  useEffect(() => {
    if (!enabled || !pdfPath) return
    const report = { path: pdfPath, page: currentPage }
    pendingReportRef.current = report
    const timer = setTimeout(() => {
      if (pendingReportRef.current === report) pendingReportRef.current = null
      onReadingProgressChangeRef.current?.({
        path: report.path,
        page: report.page,
        lastOpenedAt: Date.now()
      })
    }, PROGRESS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [enabled, pdfPath, currentPage])

  /**
   * Delivers the report that is still waiting, if any.
   *
   * Closing the tab or replacing the document tears this hook down and the
   * timer above is cleared with it: without this the last page turn never
   * reached the store, and the saved position stayed where the reader was
   * before. A report that already went out is gone from the ref, so a later
   * close does not write the same page a second time.
   */
  const flushPendingReport = useCallback(() => {
    const pending = pendingReportRef.current
    if (!pending) return
    pendingReportRef.current = null
    onReadingProgressChangeRef.current?.({
      path: pending.path,
      page: pending.page,
      lastOpenedAt: Date.now()
    })
  }, [])

  // Declared after the timer effect so its cleanup runs after that timer was
  // cleared; a path change and an unmount both land here.
  useEffect(() => flushPendingReport, [pdfPath, flushPendingReport])

  // The window can close before either cleanup runs: a close tears the renderer
  // down without unmounting React. The store's teardown flush asks this source
  // for the page it is still holding, so that page is written with it.
  useEffect(
    () =>
      registerPendingReadingProgressSource(() => {
        const pending = pendingReportRef.current
        if (!pending) return null
        pendingReportRef.current = null
        return { path: pending.path, page: pending.page, lastOpenedAt: Date.now() }
      }),
    []
  )

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
