import { useEffect } from 'react'
import { useAppearance } from '../providers/AppearanceContext'
import { useLanguage } from '../providers/LanguageContext'
import { LANGUAGES, DEFAULT_LANGUAGE } from '@shared/i18n/translations'
import { hexToRgba } from '@shared/lib/uiUtils'
import { Logger } from '@shared/lib/logger'

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

export function AppEffects() {
  const language = useLanguage((state) => state.language)
  const selectionColor = useAppearance((state) => state.selectionColor)
  const setIsTourActive = useAppearance((state) => state.setIsTourActive)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    root.classList.remove('light')
  }, [])

  useEffect(() => {
    const langConfig = LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE]
    document.documentElement.dir = langConfig?.dir || 'ltr'
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    applySelectionColorTheme(selectionColor)
  }, [selectionColor])

  useEffect(() => {
    try {
      const hasSeenTour = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (!hasSeenTour) {
        const timer = setTimeout(() => setIsTourActive(true), 1500)
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
        return () => clearTimeout(timer)
      }
    } catch (error) {
      Logger.warn('LocalStorage onboarding check failed:', error)
    }
  }, [setIsTourActive])

  return null
}
