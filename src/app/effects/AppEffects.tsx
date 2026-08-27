import { useTutorialStore } from '@features/tutorial/store/tutorialStore'

import { getStorageItem, removeStorageItem } from '@shared/hooks/localStorageUtils'
import { hexToRgba } from '@shared/lib/uiUtils'
import { useAppearance } from '@shared/stores/appearanceStore'
import { DEFAULT_LANGUAGE, LANGUAGES, useLanguage } from '@shared/stores/languageStore'

import i18next from 'i18next'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

const ONBOARDING_STORAGE_KEY = 'has_seen_tour_v1'

function applySelectionColorTheme(color: string) {
  const root = document.documentElement
  root.style.setProperty('--selection-color', hexToRgba(color, 0.8))
  root.style.setProperty('--selection-color-soft', hexToRgba(color, 0.22))
  root.style.setProperty('--selection-color-strong', hexToRgba(color, 0.7))
  root.style.setProperty('--selection-color-vivid', hexToRgba(color, 0.84))
  root.style.setProperty('--selection-color-glow', hexToRgba(color, 0.48))
  root.style.setProperty('--selection-color-edge', hexToRgba('#ffffff', 0.2))
  root.style.setProperty('--selection-color-ink', 'rgba(24, 24, 27, 0.96)')
  root.style.setProperty('--accent-color', color)
}

function pauseAmbientAnimations(paused: boolean) {
  const bg = document.querySelector('.app-ambient-background')
  if (!bg) return
  ;(bg as HTMLElement).style.setProperty('--ambient-paused', paused ? 'paused' : 'running')
}

function AppEffects() {
  const language = useLanguage((state) => state.language)
  const selectionColor = useAppearance((state) => state.selectionColor)
  const { onboardingDone, startTutorial, markOnboardingDone } = useTutorialStore(
    useShallow((s) => ({
      onboardingDone: s.onboardingDone,
      startTutorial: s.startTutorial,
      markOnboardingDone: s.markOnboardingDone
    }))
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    root.classList.remove('light')

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hwConcurrency =
      (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency ?? 8
    const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
    const isLowEnd = prefersReducedMotion || hwConcurrency <= 4 || deviceMemory <= 4

    if (isLowEnd) root.classList.add('low-perf')
    else root.classList.remove('low-perf')
  }, [])

  useEffect(() => {
    function applyLang(lng: string) {
      const langConfig = LANGUAGES[lng] || LANGUAGES[DEFAULT_LANGUAGE]
      document.documentElement.dir = langConfig?.dir || 'ltr'
      document.documentElement.lang = lng
    }
    applyLang(language)
    i18next.on('languageChanged', applyLang)
    return () => {
      i18next.off('languageChanged', applyLang)
    }
  }, [language])

  useEffect(() => {
    applySelectionColorTheme(selectionColor)
  }, [selectionColor])

  useEffect(() => {
    const legacySeen = getStorageItem(ONBOARDING_STORAGE_KEY)

    if (!onboardingDone && !legacySeen) {
      const timer = setTimeout(() => {
        startTutorial('general')
        markOnboardingDone()
      }, 1500)
      return () => clearTimeout(timer)
    }

    if (legacySeen && !onboardingDone) {
      markOnboardingDone()
      // best-effort cleanup of the legacy key
      removeStorageItem(ONBOARDING_STORAGE_KEY)
    }
  }, [onboardingDone, startTutorial, markOnboardingDone])

  // Remove legacy `useCustomPdfEngine` key from Custom PDF Viewer experiment
  useEffect(() => {
    removeStorageItem('useCustomPdfEngine')
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      pauseAmbientAnimations(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return null
}

export default AppEffects
