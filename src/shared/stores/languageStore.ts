import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { getStorageItem, removeStorageItem, setStorageItem } from '@shared/hooks/localStorageUtils'
import { Logger } from '@shared/lib/logger'

import i18next from 'i18next'
import { useEffect } from 'react'
import { create } from 'zustand'

export interface LanguageInfo {
  code: string
  name: string
  nativeName: string
  flag: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGES: Record<string, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '\u{1F1EC}\u{1F1E7}',
    dir: 'ltr'
  },
  tr: {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '\u{1F1F9}\u{1F1F7}',
    dir: 'ltr'
  }
} as const

export const DEFAULT_LANGUAGE = 'en'
const VALID_LANGUAGES = Object.keys(LANGUAGES)

interface LanguageState {
  language: string
  setLanguage: (lang: string) => void
  languages: typeof LANGUAGES
  _requestSeq: number
  lastError: string | null
  isOnboardingDone: boolean
  completeOnboarding: () => void
}

const getInitialLanguage = (): string => {
  const saved = getStorageItem(STORAGE_KEYS.APP_LANGUAGE)
  return saved && VALID_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE
}

export const getInitialOnboardingDone = (): boolean =>
  getStorageItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE) === 'true'

const persistOnboardingDone = (done: boolean): boolean =>
  done
    ? setStorageItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE, 'true')
    : removeStorageItem(STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE)

export const useLanguage = create<LanguageState>((set, get) => ({
  language: getInitialLanguage(),
  languages: LANGUAGES,
  _requestSeq: 0,
  lastError: null,
  isOnboardingDone: getInitialOnboardingDone(),
  setLanguage: async (newLang: string) => {
    if (!VALID_LANGUAGES.includes(newLang)) return
    const seq = get()._requestSeq + 1
    set({ _requestSeq: seq })
    if (!setStorageItem(STORAGE_KEYS.APP_LANGUAGE, newLang)) {
      Logger.warn('LocalStorage language save failed')
      set({ lastError: 'Language preference could not be saved persistently' })
    }
    await i18next.changeLanguage(newLang)
    if (get()._requestSeq === seq) {
      set({ language: newLang, lastError: get().lastError })
    }
  },
  completeOnboarding: () => {
    if (!persistOnboardingDone(true)) {
      Logger.warn('LocalStorage onboarding save failed')
    }
    set({ isOnboardingDone: true })
  }
}))

/** Syncs i18next language changes back to the Zustand store on first load. */
export function useLanguageInit() {
  useEffect(() => {
    const savedLang = getInitialLanguage()
    if (savedLang !== i18next.language) {
      i18next.changeLanguage(savedLang)
    }
    const handleChange = (lng: string) => {
      useLanguage.getState().language !== lng && useLanguage.setState({ language: lng })
    }
    i18next.on('languageChanged', handleChange)
    return () => {
      i18next.off('languageChanged', handleChange)
    }
  }, [])
}
