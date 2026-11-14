import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/googleAiWebApps'
import type { PdfFile } from '@shared-core/types'

import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/hooks/types'

import { useAppToolActions } from '@app/providers/AppToolContext'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import GoogleDrivePanel from './GoogleDrivePanel'
import PdfPlaceholder from './PdfPlaceholder'
import PdfViewerDocument from './PdfViewerDocument'
import { PDF_SURFACE_CLOSE_FALLBACK_MS, playPdfSurfaceExit } from './pdfViewerSurfaceTransition'

interface PdfViewerProps {
  pdfFile: PdfFile | null
  activePdfTab?: PdfTab | null
  onSelectPdf: () => void
  t?: (key: string) => string
  initialPage?: number
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  lastReadingInfo?: LastReadingInfo[] | null
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

/**
 * The PDF shell: one document, one placeholder, and the surface transition between them.
 *
 * ## Closing is a handoff, opening is an arrival
 *
 * Closing mounts the placeholder underneath at once, so the document fades out over a
 * surface that is already fading in — a handoff, not a cut. Opening is the opposite
 * direction: the placeholder stays up until the document surface has mounted, and the
 * page itself is revealed only once it has actually painted.
 *
 * ## The document is kept mounted for its own reasons, not for an animation
 *
 * `persistentFile` exists because the shell needs a document to render before the
 * caller's next commit settles a tab switch, and because a file change should update the
 * mounted viewer instead of remounting it (the engine, zoom, page and scroll position all
 * live in that mount). The closing ramp borrows this same mount for 140 ms; it never
 * extends it, never snapshots it, and never asks PDF.js for another render.
 *
 * ## Closing, without the old stuck-UI failure mode
 *
 * The previous closing animation was removed because it made the UI feel stuck and
 * produced a momentary zoom glitch. Two properties of this implementation are the
 * answer, and both are enforced by `pdfViewerSurfaceTransition` rather than by timing
 * luck: the surface is faded with `opacity` only (no scale, so no page resample and no
 * zoom change), and it is hidden with a real unmount (never `display: none`, which
 * reported a 0×0 container to the refit observers and let a fit-scale pass run against a
 * surface nobody could see). A reopen cancels the ramp and the fallback timer, and the
 * document itself is untouched, so the same instance keeps its page, zoom and scroll.
 */
function PdfViewer({
  pdfFile,
  activePdfTab,
  onSelectPdf,
  t: propT,
  initialPage,
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
  onReadingProgressChange,
  lastReadingInfo,
  isInteractionBlocked = false,
  isPanelResizing = false
}: PdfViewerProps) {
  const { startScreenshot, offerFullPageCapture } = useAppToolActions()
  const { t: contextT } = useTranslation()
  const t = propT || contextT || ((k: string) => k)

  const [persistentFile, setPersistentFile] = useState<PdfFile | null>(null)
  const [persistentUrl, setPersistentUrl] = useState<string | null | undefined>(null)
  const [persistentInitialPage, setPersistentInitialPage] = useState<number | undefined>(undefined)
  const [hasEverLoaded, setHasEverLoaded] = useState(false)
  const lastAppliedFileKeyRef = useRef<string | null>(null)

  // The surface the closing ramp is applied to: the wrapper around both the PDF page
  // and its toolbar, so the whole document leaves as one layer.
  const surfaceRef = useRef<HTMLDivElement>(null)
  // Effect bodies read the latest values without the effect re-running on every tab or
  // document change: only `pdfFile` and the resume page may start or cancel a close.
  const persistentFileRef = useRef<PdfFile | null>(null)
  persistentFileRef.current = persistentFile
  const activeTabKindRef = useRef<PdfTab['kind'] | undefined>(undefined)
  activeTabKindRef.current = activePdfTab?.kind
  const exitAnimationRef = useRef<Animation | null>(null)
  const exitFallbackTimerRef = useRef<number | null>(null)

  // Canvas/GPU lifetime is owned by a single useCanvasGpuCleanup instance in
  // usePdfViewerState, which observes the viewer container that actually wraps
  // pdf.js' canvases. A second observer here covered a strictly larger subtree
  // and duplicated every release and pixel-budget pass on the same canvases.

  /** Drop a running exit ramp. The surface snaps back to its resting opacity. */
  const resetSurfaceExit = useCallback(() => {
    const hadExit = exitAnimationRef.current !== null || exitFallbackTimerRef.current !== null
    const animation = exitAnimationRef.current
    exitAnimationRef.current = null
    // `cancel()` is what restores the resting opacity: the ramp is created with
    // `fill: 'forwards'`, so leaving it in place would keep the surface invisible.
    animation?.cancel()
    if (exitFallbackTimerRef.current !== null) {
      window.clearTimeout(exitFallbackTimerRef.current)
      exitFallbackTimerRef.current = null
    }
    if (hadExit && surfaceRef.current) surfaceRef.current.style.pointerEvents = ''
  }, [])

  /** Release the document and let the placeholder be the only surface. */
  const finishSurfaceClose = useCallback(() => {
    resetSurfaceExit()
    lastAppliedFileKeyRef.current = null
    setPersistentFile(null)
    setPersistentUrl(null)
    setPersistentInitialPage(undefined)
  }, [resetSurfaceExit])

  useEffect(() => {
    if (pdfFile) {
      // A reopen during the exit owns the surface again: the ramp is cancelled, the
      // document is already mounted, and its page/zoom/scroll are left exactly as they
      // were. That is why a rapid close → open does not flash or reload.
      resetSurfaceExit()

      const fileKey = pdfFileKey(pdfFile)
      // initialPage reflects the live reading progress and therefore changes
      // on every page turn. Only a new (or re-opened) document may consume
      // it — otherwise the resume jump key changes mid-viewing and the
      // viewer re-applies the resume zoom/jump on every saved page turn.
      if (lastAppliedFileKeyRef.current !== fileKey) {
        lastAppliedFileKeyRef.current = fileKey
        setPersistentInitialPage(initialPage)
      }

      setPersistentFile(pdfFile)
      setPersistentUrl(pdfFile.streamUrl)
      setHasEverLoaded(true)
      return
    }

    // A Drive tab is a native surface above this document: the viewer is hidden, not
    // animated, and no document outlives the switch. Nothing to present either when no
    // document was ever mounted.
    if (activeTabKindRef.current === 'drive' || !persistentFileRef.current) {
      finishSurfaceClose()
      return
    }

    // The same close seen by a second effect run (the resume page settling, for example)
    // must not stack a second ramp on the layer that is already leaving.
    if (exitAnimationRef.current) return

    const surface = surfaceRef.current
    const animation = surface ? playPdfSurfaceExit(surface) : null
    // No ramp for a surface with nothing usable on it (still loading, failed, reduced
    // motion, or no Web Animations API): release it now rather than leave an empty
    // layer waiting on a timer.
    if (!surface || !animation) {
      finishSurfaceClose()
      return
    }

    surface.style.pointerEvents = 'none'
    exitAnimationRef.current = animation

    const finalize = () => {
      // A cancelled ramp (a reopen) has already cleared the ref; its rejection must not
      // unmount the document the reader just asked for.
      if (exitAnimationRef.current !== animation) return
      finishSurfaceClose()
    }
    void animation.finished.then(finalize, finalize)
    // One bounded fallback, cleared by `resetSurfaceExit`. A dropped or paused
    // animation must never leave an invisible layer over the placeholder.
    exitFallbackTimerRef.current = window.setTimeout(finalize, PDF_SURFACE_CLOSE_FALLBACK_MS)
  }, [finishSurfaceClose, initialPage, pdfFile, resetSurfaceExit])

  // A ramp in flight when the shell goes away must not outlive it.
  useEffect(() => () => resetSurfaceExit(), [resetSurfaceExit])

  const isDriveActive = activePdfTab?.kind === 'drive'
  const isViewerVisible = !!pdfFile && !isDriveActive
  // The persistent surface is mounted one commit after a file arrives. The placeholder
  // has to stay up for that commit: unmounting it as soon as `pdfFile` is non-null left
  // one frame of bare panel between the placeholder and the loaded document.
  const isSurfaceMounted = hasEverLoaded && !!persistentFile && !!persistentUrl

  return (
    <div className="relative h-full w-full">
      {isSurfaceMounted && (
        <div
          ref={surfaceRef}
          className="absolute inset-0 z-10 h-full w-full"
          // `display` is only for the native Drive surface, which covers this layer.
          // Closing never uses it: the exit is a real unmount, so a hidden container
          // can never be measured at 0×0 and trigger a refit.
          style={{ display: isDriveActive ? 'none' : 'block' }}
        >
          <PdfViewerDocument
            pdfFile={persistentFile}
            pdfUrl={persistentUrl}
            activePdfTab={activePdfTab}
            t={t}
            initialPage={persistentInitialPage}
            onReadingProgressChange={onReadingProgressChange}
            isInteractionBlocked={isInteractionBlocked || !pdfFile}
            startScreenshot={startScreenshot}
            onFullPageCapture={offerFullPageCapture}
            isPanelResizing={isPanelResizing}
          />
        </div>
      )}

      {isDriveActive && (
        <GoogleDrivePanel
          tabId={activePdfTab.id}
          webviewUrl={activePdfTab.webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
          title={GOOGLE_DRIVE_WEB_APP.name}
          description={t('gdrive_pdf_desc')}
          reloadLabel={t('ctx_reload')}
          isInteractionBlocked={isInteractionBlocked}
        />
      )}

      {/* The placeholder fades itself in. Its wrapper carries no animation of its own:
          two stacked fades on the same surface made the opening read as a stutter, and
          the inner one is the one that owns the design system's zoom-in-98. */}
      {!isDriveActive && (!isViewerVisible || !isSurfaceMounted) && (
        <div className="bg-background absolute inset-0 h-full w-full">
          <PdfPlaceholder
            onSelectPdf={onSelectPdf}
            onResumePdf={onResumePdf}
            onClearResumePdf={onClearResumePdf}
            onRestoreResumePdf={onRestoreResumePdf}
            onRelinkPdf={onRelinkPdf}
            lastReadingInfo={lastReadingInfo}
          />
        </div>
      )}
    </div>
  )
}

function pdfFileKey(a: PdfFile | null): string | null {
  return a ? `${a.path}::${a.streamUrl}::${a.name}::${a.size}` : null
}

export default memo(PdfViewer, (prev, next) => {
  const prevKey = pdfFileKey(prev.pdfFile)
  const nextKey = pdfFileKey(next.pdfFile)
  if (prevKey !== nextKey) return false
  if (prev.activePdfTab?.kind !== next.activePdfTab?.kind) return false
  if (prev.isInteractionBlocked !== next.isInteractionBlocked) return false
  if (prev.isPanelResizing !== next.isPanelResizing) return false

  const isSameVisiblePdf =
    prevKey !== null && prev.activePdfTab?.kind !== 'drive' && next.activePdfTab?.kind !== 'drive'
  if (!isSameVisiblePdf) {
    if (prev.initialPage !== next.initialPage) return false
    if (prev.lastReadingInfo !== next.lastReadingInfo) return false
  }
  return true
})
