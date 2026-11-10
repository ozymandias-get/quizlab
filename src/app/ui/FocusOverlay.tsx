import type { AiViewSurfaceState } from '@features/ai/viewState'

import {
  focusBackdropReducedVariants,
  focusBackdropVariants,
  focusContentReducedVariants,
  focusContentVariants
} from '@app/ui/BottomBar/animations'
import { OVERLAY_FOCUS_TRANSFER_MS } from '@shared/constants/timingConstants'
import { InlineSpinner } from '@shared/ui/components/primitives'
import AestheticLoader from '@ui/components/AestheticLoader'
import ErrorBoundary from '@ui/components/ErrorBoundary'

import { motion, useReducedMotion, type Variants } from 'motion/react'
import {
  type CSSProperties,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef
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
  willChange: 'transform, opacity',
  transform: 'translateZ(0)',
  contain: 'layout paint size',
  border: '1px solid oklch(var(--border))',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-ambient-xl)',
  background: 'oklch(var(--background))'
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
      <motion.div
        key={`focus-content-${mode}`}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleShellClick}
        className="glass-tier-1 relative flex h-full w-full flex-col overflow-hidden"
        style={SHELL_STYLE}
      >
        {/* A real header row instead of a floating close button: the strip owns
            the top-right corner, so the PDF/AI toolbars underneath are neither
            covered nor unclickable. */}
        <header className="border-border/60 flex h-12 shrink-0 items-center justify-between border-b px-4">
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
