import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { translations, LANGUAGES, DEFAULT_LANGUAGE, VALID_LANGUAGES, LanguageInfo } from '../constants/translations'
import { STORAGE_KEYS } from '../constants/storageKeys'

interface LanguageContextType {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, params?: Record<string, string>) => string;
    languages: typeof LANGUAGES;
    currentLanguage: LanguageInfo;
}

export const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE)
            return saved && VALID_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE
        } catch (error) {
            console.warn('LocalStorage language init failed:', error)
            return DEFAULT_LANGUAGE
        }
    })

    // Dil değiştirme fonksiyonu
    const setLanguage = useCallback((newLang: string) => {
        if (VALID_LANGUAGES.includes(newLang)) {
            setLanguageState(newLang)
            try {
                localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, newLang)
            } catch (error) {
                console.warn('LocalStorage language save failed:', error)
            }

            // RTL diller için document direction ayarla
            const langConfig = LANGUAGES[newLang]
            document.documentElement.dir = langConfig?.dir || 'ltr'
            document.documentElement.lang = newLang
        }
    }, [])

    // İlk yüklemede direction ayarla
    useEffect(() => {
        const langConfig = LANGUAGES[language]
        document.documentElement.dir = langConfig?.dir || 'ltr'
        document.documentElement.lang = language
    }, [language])

    // Çeviri fonksiyonu
    const t = useCallback((key: string, params: Record<string, string> = {}) => {
        // Dot notation desteği (Örn: toast.info.title)
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

        // Eğer sonuç bir obje ise (eksik anahtar), key'i geri dön
        let translationText = typeof rawTranslation === 'string' ? rawTranslation : key

        // Parametreleri yerleştir (Interpolation)
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([k, v]) => {
                translationText = translationText.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
            })
        }

        return translationText
    }, [language])

    // Context value'yu memoize ederek gereksiz re-render'ları önle
    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
        currentLanguage: LANGUAGES[language]
    }), [language, setLanguage, t])

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}

export default LanguageContext
