import { usePdfOpenActions } from '@features/pdf/hooks/usePdfOpenActions'
import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { useReadingProgressPersistence } from '@features/pdf/hooks/useReadingProgressPersistence'
import type { ReadingProgressUpdate, ResumePdfResult } from '@features/pdf/types'

import { useTextSelection } from '@app/hooks/useTextSelection'
import { cn } from '@shared/lib/uiUtils'
import { buttonBaseClass } from '@shared/lib/uiUtils'
import AestheticLoader from '@ui/components/AestheticLoader'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import { XIcon } from '@ui/components/Icons'
import {
  focusBackdropReducedVariants,
  focusBackdropVariants,
  focusContentReducedVariants,
  focusContentVariants
} from '@ui/layout/BottomBar/animations'

import { type HTMLMotionProps, motion, useReducedMotion, type Variants } from 'motion/react'
import {
  type CSSProperties,
  forwardRef,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef
} from 'react'
import { useTranslation } from 'react-i18next'

const PdfTabStrip = lazy(() =>
  import('@features/pdf/viewer').then((m) => ({ default: m.PdfTabStrip }))
)
const PdfViewer = lazy(() => import('@features/pdf/viewer').then((m) => ({ default: m.PdfViewer })))
const AiWebview = lazy(() => import('@features/ai/webview').then((m) => ({ default: m.AiWebview })))

type FocusMode = 'pdf' | 'ai'

interface FocusOverlayProps {
  mode: FocusMode
  onClose: () => void
  // AI mode wiring
  isWebviewMounted: boolean
  isResizing: boolean
  isBarHovered: boolean
}

const SHELL_STYLE: Record<string, string> = {
  willChange: 'transform, opacity',
  transform: 'translateZ(0)',
  contain: 'layout paint size',
  boxShadow: `
    -8px 20px 60px -20px oklch(0 0 0 / 0.9),
    -4px 10px 40px -10px oklch(0 0 0 / 0.7),
    0 0 80px -30px oklch(1 0 0 / 0.04),
    inset 0 1px 0 oklch(1 0 0 / 0.06)
  `,
  borderRadius: '12px',
  '--selection-color-vivid': 'oklch(0.74 0.15 85 / 0.25)',
  '--selection-color-edge': 'oklch(1 0 0 / 0.08)',
  '--selection-color-glow': 'oklch(0.74 0.15 85 / 0.08)',
  '--selection-color-soft': 'oklch(0.74 0.15 85 / 0.07)'
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(0 0 0 / 0.65)',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  padding: 0
}

/** Static sizing and GPU hint for the close button */
const CLOSE_BUTTON_STYLE: CSSProperties = {
  width: '2.5rem',
  height: '2.5rem',
  transform: 'translateZ(0)',
  willChange: 'transform'
}

function FocusOverlay({
  mode,
  onClose,
  isWebviewMounted,
  isResizing,
  isBarHovered
}: FocusOverlayProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  const backdropVariants: Variants = reducedMotion
    ? focusBackdropReducedVariants
    : focusBackdropVariants
  const contentVariants: Variants = reducedMotion
    ? focusContentReducedVariants
    : focusContentVariants

  // Use a ref to avoid re-registering the event listener every time onClose
  // reference changes (which happens on every parent re-render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return
      }
      onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    lastFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 80)
    return () => {
      window.clearTimeout(focusTimer)
      const previous = lastFocusedRef.current
      if (previous && typeof previous.focus === 'function' && document.body.contains(previous)) {
        previous.focus()
      }
    }
  }, [])

  const handleBackdropClick = useCallback(() => {
    onCloseRef.current()
  }, [])
  const handleShellClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }, [])

  const closeLabel = t('focus_close_aria')

  const backdropStyle = useMemo(
    () => ({
      ...BACKDROP_STYLE,
      backdropFilter: reducedMotion ? undefined : 'blur(6px)',
      WebkitBackdropFilter: reducedMotion ? undefined : 'blur(6px)'
    }),
    [reducedMotion]
  )

  return (
    <motion.div
      key="focus-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleBackdropClick}
      className="z-modal"
      style={backdropStyle}
    >
      <motion.div
        key={`focus-content-${mode}`}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleShellClick}
        className="glass-tier-1 relative h-full w-full overflow-hidden"
        style={SHELL_STYLE}
      >
        <FocusCloseButton ref={closeButtonRef} onClick={onClose} label={closeLabel} />

        <div className="absolute inset-0 flex min-h-0 flex-col pt-12">
          <ErrorBoundary title={t('error_pdf_handler')}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-500/60" />
                </div>
              }
            >
              {mode === 'pdf' ? (
                <FocusPdfBody />
              ) : isWebviewMounted ? (
                <AiWebview isResizing={isResizing} isBarHovered={isBarHovered} />
              ) : (
                <AestheticLoader />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default memo(FocusOverlay)

interface FocusCloseButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  label: string
}

const FocusCloseButton = forwardRef<HTMLButtonElement, FocusCloseButtonProps>(
  ({ label, className, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        whileHover={{
          scale: 1.08,
          rotate: 90,
          transition: { type: 'spring', stiffness: 420, damping: 22, mass: 0.6 }
        }}
        whileTap={{ scale: 0.92, transition: { duration: 0.1 } }}
        className={cn(
          buttonBaseClass,
          'absolute top-4 right-4 z-20 flex items-center justify-center rounded-full',
          'border border-white/15 bg-black/55 backdrop-blur-md',
          'shadow-[0_8px_24px_-8px_oklch(0_0_0/0.6)]',
          'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none',
          'text-white/80 hover:text-white',
          className
        )}
        style={CLOSE_BUTTON_STYLE}
        {...rest}
      >
        <XIcon className="h-4 w-4" />
      </motion.button>
    )
  }
)
FocusCloseButton.displayName = 'FocusCloseButton'

const FocusPdfBody = memo(function FocusPdfBody() {
  const { t } = useTranslation()
  const { handleTextSelection } = useTextSelection()

  /* ── Granular tab store subscriptions ── */
  const pdfTabs = usePdfTabStore((s) => s.pdfTabs)
  const activePdfTabId = usePdfTabStore((s) => s.activePdfTabId)
  const setActivePdfTab = usePdfTabStore((s) => s.setActivePdfTab)
  const closePdfTab = usePdfTabStore((s) => s.closePdfTab)
  const renamePdfTab = usePdfTabStore((s) => s.renamePdfTab)
  const addEmptyPdfTab = usePdfTabStore((s) => s.addEmptyPdfTab)
  const goToPdfHome = usePdfTabStore((s) => s.goToPdfHome)

  const activePdfTab = useMemo(() => {
    if (!activePdfTabId) return null
    return pdfTabs.find((tab) => tab.id === activePdfTabId) || null
  }, [pdfTabs, activePdfTabId])

  const pdfFile = useMemo(() => {
    return activePdfTab?.kind === 'drive' ? null : activePdfTab?.file || null
  }, [activePdfTab])

  /* ── Reading progress ── */
  const {
    recentReadingInfo,
    updateReadingProgress,
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    clearLastReading,
    restoreRecentReading,
    recentReadingInfoRef
  } = useReadingProgressPersistence()

  const { handleSelectPdf, resumeLastPdf } = usePdfOpenActions({
    openPdfInTab: usePdfTabStore((s) => s.openPdfInTab),
    upsertLastReadingInfo,
    flushPendingReadingProgress,
    recentReadingInfoRef
  })

  const readingHistoryRef = useRef(recentReadingInfo)
  readingHistoryRef.current = recentReadingInfo

  const activeTabInitialPage = useMemo(() => {
    if (!activePdfTabId) return undefined
    if (activePdfTab?.kind !== 'pdf' || !activePdfTab?.file) return undefined

    const file = activePdfTab.file
    if (file.path) {
      const existing = (readingHistoryRef.current || []).find((entry) => entry.path === file.path)
      return existing?.page
    }
    return undefined
  }, [activePdfTabId, activePdfTab])

  const lastReadingInfoRef = readingHistoryRef

  const handleResumePdf = useCallback(
    async (path?: string): Promise<ResumePdfResult> => {
      const current = lastReadingInfoRef.current
      const target = path ? current.find((entry) => entry.path === path) : current[0]
      if (target) {
        return await resumeLastPdf(target.path)
      }
      return await resumeLastPdf(path)
    },
    [resumeLastPdf]
  )

  const handleClearResumePdf = useCallback(
    (path?: string) => {
      clearLastReading(path)
    },
    [clearLastReading]
  )

  const handleReadingProgressChange = useCallback(
    (update: ReadingProgressUpdate) => {
      updateReadingProgress(update)
    },
    [updateReadingProgress]
  )

  return (
    <>
      {pdfTabs.length > 0 && (
        <PdfTabStrip
          tabs={pdfTabs}
          activeTabId={activePdfTabId}
          onSetActiveTab={setActivePdfTab}
          onCloseTab={closePdfTab}
          onRenameTab={renamePdfTab}
          onAddTab={addEmptyPdfTab || handleSelectPdf}
          onHome={goToPdfHome}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary title={t('error_pdf_viewer')}>
          <PdfViewer
            pdfFile={pdfFile}
            activePdfTab={activePdfTab}
            onSelectPdf={handleSelectPdf}
            onTextSelection={handleTextSelection}
            t={t}
            initialPage={activeTabInitialPage}
            onResumePdf={handleResumePdf}
            onClearResumePdf={handleClearResumePdf}
            onRestoreResumePdf={restoreRecentReading}
            onReadingProgressChange={handleReadingProgressChange}
            lastReadingInfo={recentReadingInfo}
            isInteractionBlocked={false}
            isPanelResizing={false}
          />
        </ErrorBoundary>
      </div>
    </>
  )
})
