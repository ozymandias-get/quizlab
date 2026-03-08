import { useEffect } from 'react'
import { useAppearance } from '../providers/AppearanceContext'
import { useLanguage } from '../providers/LanguageContext'
import { LANGUAGES, DEFAULT_LANGUAGE } from '@shared/i18n/translations'
import { hexToRgba } from '@shared/lib/uiUtils'
import { Logger } from '@shared/lib/logger'

const ONBOARDING_STORAGE_KEY = 'has_seen_tour_v1'

/**
 * Global side-effects that used to live in wrapper providers.
 * Keeps provider tree flat while preserving behavior.
 */
export function AppEffects() {
    const language = useLanguage(state => state.language)
    const selectionColor = useAppearance(state => state.selectionColor)
    const setIsTourActive = useAppearance(state => state.setIsTourActive)

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
        const rgba = hexToRgba(selectionColor, 0.8)
        document.documentElement.style.setProperty('--selection-color', rgba)
        document.documentElement.style.setProperty('--selection-color-soft', hexToRgba(selectionColor, 0.22))
        document.documentElement.style.setProperty('--selection-color-strong', hexToRgba(selectionColor, 0.7))
        document.documentElement.style.setProperty('--selection-color-vivid', hexToRgba(selectionColor, 0.84))
        document.documentElement.style.setProperty('--selection-color-glow', hexToRgba(selectionColor, 0.48))
        document.documentElement.style.setProperty('--selection-color-edge', hexToRgba('#ffffff', 0.2))
        document.documentElement.style.setProperty('--selection-color-ink', 'rgba(24, 24, 27, 0.96)')
        document.documentElement.style.setProperty('--accent-color', selectionColor)
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



