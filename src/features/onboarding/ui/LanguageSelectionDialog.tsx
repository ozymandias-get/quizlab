import { useLanguage } from '@shared/stores/languageStore'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

export function LanguageSelectionDialog() {
  const { isOnboardingDone, languages, setLanguage, completeOnboarding } = useLanguage()
  const prefersReducedMotion = useReducedMotion()
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleContinue = useCallback(async () => {
    if (!selectedLang) return
    await setLanguage(selectedLang)
    completeOnboarding()
  }, [selectedLang, setLanguage, completeOnboarding])

  const isVisible = !isOnboardingDone

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

  const handleKeyDown = useCallback((event: globalThis.KeyboardEvent) => {
    if (event.key === 'Tab') {
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
  }, [])

  useEffect(() => {
    if (!isVisible) return
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isVisible])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="language-onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="z-modal bg-background/60 fixed inset-0 flex items-center justify-center backdrop-blur-md"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 12, scale: 0.98 }) }}
            animate={{ opacity: 1, ...(prefersReducedMotion ? {} : { y: 0, scale: 1 }) }}
            exit={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 6, scale: 0.98 }) }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="border-border bg-popover text-popover-foreground shadow-ambient-xl mx-4 w-full max-w-md rounded-2xl border p-6 text-center outline-none"
          >
            <h2 id={titleId} className="text-ql-20 text-foreground font-semibold">
              Select Your Language
            </h2>
            <p className="text-ql-13 text-muted-foreground mt-1">Dilinizi Seçin</p>

            <div className="mt-6 flex flex-col gap-2.5">
              {Object.values(languages).map((lang) => {
                const isSelected = selectedLang === lang.code
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`focus-visible:ring-ring/40 flex items-center gap-3.5 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      isSelected
                        ? 'border-ring bg-accent/30 shadow-xs'
                        : 'border-border bg-card hover:border-border hover:bg-muted/60'
                    } `}
                  >
                    <span className="border-border/60 bg-muted flex h-10 w-10 items-center justify-center rounded-lg border text-xl">
                      {lang.flag}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-ql-14 text-foreground font-semibold">
                        {lang.nativeName}
                      </span>
                      <span className="text-ql-12 text-muted-foreground">{lang.name}</span>
                    </div>
                    {isSelected && (
                      <span className="bg-primary text-primary-foreground ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedLang}
              className="text-ql-13 focus-visible:ring-ring/40 enabled:bg-primary enabled:text-primary-foreground enabled:hover:bg-primary/90 mt-6 inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue &rarr;
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(LanguageSelectionDialog)
