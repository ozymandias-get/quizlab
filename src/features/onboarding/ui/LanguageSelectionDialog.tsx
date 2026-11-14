import { BlurFade } from '@app/components/ui/blur-fade'
import { DialogBackdrop } from '@app/components/ui/dialog'
import { MagicCard } from '@app/components/ui/magic-card'
import { useDialogBehavior } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { useLanguage } from '@shared/stores/languageStore'
import { BorderBeam } from '@shared/ui/components/BorderBeam'
import { Button } from '@shared/ui/components/primitives'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function LanguageSelectionDialog() {
  const { isOnboardingDone, languages, setLanguage, completeOnboarding } = useLanguage()
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [selectedLang, setSelectedLang] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleContinue = useCallback(async () => {
    if (!selectedLang) return
    await setLanguage(selectedLang)
    completeOnboarding()
  }, [selectedLang, setLanguage, completeOnboarding])

  const isVisible = !isOnboardingDone

  // Standardized focus-trap via useDialogBehavior — single source of truth for
  // all modals (dialog.tsx, SettingsModal, HistoryModal). Previously this dialog
  // had a bespoke useLayoutEffect + globalScrollLockCount + Tab handler that
  // diverged from the shared hook and allowed focus to escape to the embedded view
  // / PDF toolbar. Now it uses the same Escape-to-close, Tab trap, scroll lock
  // and focus-restore path as every other dialog.
  useDialogBehavior({
    isOpen: isVisible,
    onClose: () => {},
    dialogRef: dialogRef as React.RefObject<HTMLElement | null>,
    initialFocusRef: undefined
  })

  return (
    <AnimatePresence>
      {isVisible && (
        <DialogBackdrop key="language-onboarding">
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 12, scale: 0.98 }) }}
            animate={{ opacity: 1, ...(prefersReducedMotion ? {} : { y: 0, scale: 1 }) }}
            exit={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 6, scale: 0.98 }) }}
            transition={{ duration: DURATION.slow, ease: 'easeOut' }}
            className="mx-4 w-full max-w-md rounded-2xl border border-white/12 bg-zinc-950/95 p-6 text-center text-zinc-100 shadow-2xl backdrop-blur-xl outline-none"
          >
            <h2 id={titleId} className="text-ql-20 text-foreground font-semibold">
              {t('onboarding_language_title', { lng: 'en' })}
            </h2>
            <p className="text-ql-13 text-muted-foreground mt-1">
              {t('onboarding_language_title', { lng: 'tr' })}
            </p>

            <div
              className="mt-6 flex flex-col gap-2.5"
              role="radiogroup"
              aria-label={t('onboarding_language_title', { lng: 'en' })}
            >
              {Object.values(languages).map((lang, index) => {
                const isSelected = selectedLang === lang.code
                return (
                  <BlurFade key={lang.code} delay={index * 0.06} className="w-full">
                    <MagicCard
                      className="w-full rounded-xl border-white/[0.07]"
                      gradientColor="#18181b"
                      gradientOpacity={0.35}
                      gradientFrom="#27272a"
                      gradientTo="#18181b"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedLang(lang.code)}
                        className={`focus-visible:ring-ring/70 motion-normal group relative flex w-full items-center gap-3.5 overflow-hidden rounded-xl p-3 text-left transition-all focus-visible:ring-2 focus-visible:outline-none ${
                          isSelected
                            ? 'bg-primary/10 ring-primary/50 ring-1'
                            : 'bg-transparent hover:bg-white/5'
                        } `}
                      >
                        {isSelected && (
                          <BorderBeam
                            size={60}
                            duration={10}
                            borderWidth={1}
                            colorFrom="#a1a1aa"
                            colorTo="#3f3f46"
                          />
                        )}
                        <span className="text-ql-20 flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] transition-transform group-hover:scale-105">
                          {lang.flag}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-ql-13 text-foreground font-semibold">
                            {lang.nativeName}
                          </span>
                          <span className="text-ql-12 text-muted-foreground">{lang.name}</span>
                        </div>
                        {isSelected && (
                          <span className="bg-primary text-primary-foreground text-ql-11 ml-auto flex h-5 w-5 items-center justify-center rounded-full font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    </MagicCard>
                  </BlurFade>
                )
              })}
            </div>

            <Button
              type="button"
              onClick={handleContinue}
              disabled={!selectedLang}
              size="default"
              className="mt-6 w-full font-semibold"
            >
              {t('continue')} &rarr;
            </Button>
          </motion.div>
        </DialogBackdrop>
      )}
    </AnimatePresence>
  )
}

export default memo(LanguageSelectionDialog)
