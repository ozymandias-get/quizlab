import React, { useEffect } from 'react'
import { create } from 'zustand'
import { Logger } from '@src/utils/logger'
import { translations, LANGUAGES, DEFAULT_LANGUAGE, VALID_LANGUAGES, LanguageInfo } from '@src/constants/translations'
import { STORAGE_KEYS } from '@src/constants/storageKeys'

interface LanguageState {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, params?: Record<string, string>) => string;
    languages: typeof LANGUAGES;
    currentLanguage: LanguageInfo;
}

const getInitialLanguage = (): string => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE)
        return saved && VALID_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE
    } catch (error) {
        Logger.warn('LocalStorage language init failed:', error)
        return DEFAULT_LANGUAGE
    }
}

export const useLanguage = create<LanguageState>((set, get) => ({
    language: getInitialLanguage(),
    languages: LANGUAGES,
    get currentLanguage() {
        return LANGUAGES[get().language] || LANGUAGES[DEFAULT_LANGUAGE]
    },

    setLanguage: (newLang: string) => {
        if (!VALID_LANGUAGES.includes(newLang)) return;

        try {
            localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, newLang)
        } catch (error) {
            Logger.warn('LocalStorage language save failed:', error)
        }

        const langConfig = LANGUAGES[newLang]
        document.documentElement.dir = langConfig?.dir || 'ltr'
        document.documentElement.lang = newLang

        set({ language: newLang })
    },

    t: (key: string, params: Record<string, string> = {}) => {
        const language = get().language;

        const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
            return path.split('.').reduce<unknown>((acc, part) => {
                if (acc && typeof acc === 'object' && part in acc) {
                    return (acc as Record<string, unknown>)[part];
                }
                return undefined;
            }, obj);
        };

        const translationData = (translations[language as keyof typeof translations] || translations[DEFAULT_LANGUAGE as keyof typeof translations]) as Record<string, unknown>;
        const defaultTranslationData = translations[DEFAULT_LANGUAGE as keyof typeof translations] as Record<string, unknown>;

        const rawTranslation = getNestedValue(translationData, key) ||
            getNestedValue(defaultTranslationData, key) ||
            key

        let translationText = typeof rawTranslation === 'string' ? rawTranslation : key

        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([k, v]) => {
                translationText = translationText.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
            })
        }

        return translationText
    }
}))

// For backward compatibility since it used to be a Provider wrapping the app
export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const language = useLanguage(state => state.language)

    // Ensure document lang and dir are set on mount and when language changes
    useEffect(() => {
        const langConfig = LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE]
        document.documentElement.dir = langConfig?.dir || 'ltr'
        document.documentElement.lang = language
    }, [language])

    return <>{children}</>
}

