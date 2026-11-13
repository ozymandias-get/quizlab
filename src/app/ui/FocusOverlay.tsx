import type { AiViewSurfaceState } from '@features/ai/viewState'

import { Kbd } from '@app/components/ui/kbd'
import {
  focusBackdropReducedVariants,
  focusBackdropVariants,
  focusContentReducedVariants,
  focusContentVariants
} from '@app/ui/BottomBar/animations'
import { OVERLAY_FOCUS_TRANSFER_MS } from '@shared/constants/timingConstants'
import { InlineSpinner } from '@shared/ui/components/primitives'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import PanelLoadingPlaceholder from '@ui/components/PanelLoadingPlaceholder'

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import {
  type CSSProperties,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import FocusCloseButton from './focus/FocusCloseButton'
import FocusPdfBody from './focus/FocusPdfBody'

const AiViewSurface = lazy(() =>
  import('@features/ai/aiViewSurface').then((m) => ({ default: m.AiViewSurface }))
)

type FocusMode = 'pdf' | 'ai'

interface FocusOverlayProps {
  mode: FocusMode
  onClose: () => void
  // AI mode wiring
  isAiSurfaceMounted: boolean
  isResizing: boolean
  isAiSurfaceActive: boolean
  aiViewSurfaceState: AiViewSurfaceState
}

const SHELL_STYLE: CSSProperties = {
  contain: 'layout paint size',
  border: '1px solid oklch(1 0 0 / 0.07)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-ambient-xl)',
  background: '#060608'
}

const BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(0.04 0.003 285.8 / 0.85)',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  padding: 0
}

function FocusOverlay({
  mode,
  onClose,
  isAiSurfaceMounted,
  isResizing,
  isAiSurfaceActive,
  aiViewSurfaceState
}: FocusOverlayProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  // `will-change` is a promise to the compositor, not a permanent style: it is
  // dropped as soon as the reveal finishes so the panel is rasterised normally.
  const [isRevealSettled, setIsRevealSettled] = useState(false)
  const [showEscHint, setShowEscHint] = useState(true)

  useEffect(() => {
    setIsRevealSettled(false)
    setShowEscHint(true)
  }, [mode])

  // The shortcut is discoverable for the first two seconds, then gets out of
  // the way; the close button remains for anyone who missed it.
  useEffect(() => {
    const timer = window.setTimeout(() => setShowEscHint(false), 2000)
    return () => window.clearTimeout(timer)
  }, [mode])

  const shellStyle = useMemo<CSSProperties>(
    () => ({
      ...SHELL_STYLE,
      willChange: isRevealSettled ? undefined : 'opacity, clip-path'
    }),
    [isRevealSettled]
  )

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
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      OVERLAY_FOCUS_TRANSFER_MS
    )
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
  const focusTitle = mode === 'pdf' ? t('pdf_documents') : t('api_chat_title')

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
      aria-label={focusTitle}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleBackdropClick}
      className="z-modal"
      style={backdropStyle}
    >
      <AnimatePresence>
        {showEscHint && (
          <motion.div
            key="esc-hint"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className="text-foreground shadow-ambient-md text-ql-11 pointer-events-none absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/[0.07] bg-zinc-950/80 px-3 py-1.5 font-medium backdrop-blur-xl"
          >
            <Kbd size="xs">ESC</Kbd>
            <span>{t('focus_esc_hint')}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        key={`focus-content-${mode}`}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onAnimationComplete={() => setIsRevealSettled(true)}
        onClick={handleShellClick}
        className="glass-tier-1 relative flex h-full w-full flex-col overflow-hidden"
        style={shellStyle}
      >
        {/* A real header row instead of a floating close button: the strip owns
            the top-right corner, so the PDF/AI toolbars underneath are neither
            covered nor unclickable. */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] bg-zinc-950/40 px-4 backdrop-blur-xl">
          <span className="text-ql-12 text-muted-foreground min-w-0 truncate font-medium">
            {focusTitle}
          </span>
          <FocusCloseButton ref={closeButtonRef} onClick={onClose} label={closeLabel} />
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ErrorBoundary title={t('error_pdf_handler')}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <InlineSpinner size="xl" className="border-border border-t-primary" />
                </div>
              }
            >
              {mode === 'pdf' ? (
                <FocusPdfBody />
              ) : isAiSurfaceMounted ? (
                <AiViewSurface
                  isResizing={isResizing}
                  isSurfaceActive={isAiSurfaceActive}
                  surfaceState={aiViewSurfaceState}
                />
              ) : (
                <PanelLoadingPlaceholder />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default memo(FocusOverlay)
