import { InlineSpinner } from '@shared/ui/components/primitives'
import AestheticLoader from '@ui/components/AestheticLoader'
import ErrorBoundary from '@ui/components/ErrorBoundary'
import {
  focusBackdropReducedVariants,
  focusBackdropVariants,
  focusContentReducedVariants,
  focusContentVariants
} from '@ui/layout/BottomBar/animations'

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
                  <InlineSpinner size="xl" className="border-border border-t-primary" />
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
