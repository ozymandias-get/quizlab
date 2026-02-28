import { useEffect } from 'react'
import { useAppearance } from './providers/AppearanceContext'
import { useLanguage } from './providers/LanguageContext'
import { LANGUAGES, DEFAULT_LANGUAGE } from '@src/constants/translations'
import { hexToRgba } from '@src/utils/uiUtils'
import { Logger } from '@src/utils/logger'

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
        const langConfig = LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE]
        document.documentElement.dir = langConfig?.dir || 'ltr'
        document.documentElement.lang = language
    }, [language])

    useEffect(() => {
        const rgba = hexToRgba(selectionColor, 0.8)
        document.documentElement.style.setProperty('--selection-color', rgba)
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

