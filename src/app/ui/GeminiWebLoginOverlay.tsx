import { GoogleIcon, LoaderIcon } from '@ui/components/Icons'

import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export type GeminiWebLoginOverlayMode = 'login' | 'refreshing' | 'hidden'

/**
 * Global scroll-lock state shared across all overlay instances.
 * Prevents conflicting overflow styles when multiple overlays are
 * mounted simultaneously or rapidly toggled.
 */
let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

interface GeminiWebLoginOverlayProps {
  /**
   * Current overlay mode.
   *  - 'login': an interactive login is in progress; the user must
   *    complete it. The overlay can be dismissed locally without aborting
   *    the backend flow (renderer-side safety).
   *  - 'refreshing': a silent background refresh is running. We show an
   *    informational overlay (not blocking) so the user understands why
   *    session state may briefly look stale.
   *  - 'hidden': do not render.
   */
  mode: GeminiWebLoginOverlayMode
  /**
   * Called when the user actively dismisses the overlay (Dismiss button or
   * Escape key). The backend flow is unaffected; the renderer just stops
   * tracking it.
   */
  onDismiss?: () => void
}

function GeminiWebLoginOverlay({ mode, onDismiss }: GeminiWebLoginOverlayProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isVisible = mode !== 'hidden'
  const isInteractive = mode === 'login'

  const handleDismiss = useCallback(() => {
    onDismiss?.()
  }, [onDismiss])

  useLayoutEffect(() => {
    if (isVisible) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null

      if (globalScrollLockCount === 0) {
        globalScrollLockOriginal = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      globalScrollLockCount += 1

      const focusFrame = requestAnimationFrame(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
        )
        ;(firstFocusable ?? dialog).focus()
      })

      return () => {
        cancelAnimationFrame(focusFrame)

        globalScrollLockCount -= 1
        if (globalScrollLockCount <= 0) {
          document.body.style.overflow = globalScrollLockOriginal ?? ''
          globalScrollLockOriginal = null
        }

        if (restoreFocusTimeoutRef.current !== null) {
          clearTimeout(restoreFocusTimeoutRef.current)
        }

        const prevFocus = previouslyFocusedRef.current
        if (prevFocus) {
          restoreFocusTimeoutRef.current = setTimeout(() => {
            try {
              if (document.body.contains(prevFocus)) {
                prevFocus.focus?.()
              }
            } catch {
              // Silently ignore focus on detached element
            }
          }, 250)
        }
      }
    }
  }, [isVisible])

  // Escape key: only meaningful for the interactive login state. For the
  // silent refresh state the modal is informational and we keep the existing
  // focus behavior (no dismiss).
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && isInteractive) {
        const target = event.target as Node | null
        const dialog = dialogRef.current
        if (dialog && target && !dialog.contains(target)) return
        event.preventDefault()
        event.stopPropagation()
        handleDismiss()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleDismiss, isInteractive, isVisible])

  // Focus trap for Tab key navigation
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
        )
      ].filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
      if (focusables.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible])

  const titleText =
    mode === 'refreshing' ? t('gws_overlay_refresh_title') : t('gws_overlay_login_title')
  const descriptionText =
    mode === 'refreshing'
      ? t('gws_overlay_refresh_description')
      : t('gws_overlay_login_description')

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="gemini-web-session-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="z-modal fixed inset-0 flex items-center justify-center bg-[rgba(2,6,12,0.72)] backdrop-blur-xl"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy="true"
            tabIndex={-1}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass-tier-1 glass-tier-card mx-6 w-full max-w-xl rounded-[2rem] px-8 py-10 text-center outline-none"
          >
            <div
              aria-hidden="true"
              className="glass-tier-3 mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border-emerald-400/20 bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(255,255,255,0.04))] text-emerald-200"
            >
              <div className="relative flex items-center justify-center">
                <GoogleIcon className="h-8 w-8" />
                <LoaderIcon className="absolute -top-4 -right-4 h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <p
              aria-hidden="true"
              className="text-ql-12 tracking-ql-kicker mt-6 font-semibold text-emerald-200/70 uppercase"
            >
              {t('gws_toolbar_title')}
            </p>
            <h2 id={titleId} className="text-ql-28 mt-3 font-semibold text-white">
              {titleText}
            </h2>
            <p id={descriptionId} className="text-ql-14 mt-3 leading-7 text-white/70">
              {descriptionText}
            </p>
            <div
              aria-hidden="true"
              className="glass-tier-3 glass-tier-control text-ql-12 mt-6 inline-flex items-center gap-2 rounded-full border-white/[0.12] px-4 py-2 text-white/62"
            >
              <LoaderIcon className="h-3.5 w-3.5" />
              <span>{t('gws_overlay_badge')}</span>
            </div>
            {isInteractive && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-ql-12 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none"
                  aria-label={t('gws_overlay_dismiss_btn')}
                >
                  {t('gws_overlay_dismiss_btn')}
                </button>
                <p className="text-ql-11 text-white/45">{t('gws_overlay_dismiss_hint')}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(GeminiWebLoginOverlay)
