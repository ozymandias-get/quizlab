import en from '../locales/en.json'
import tr from '../locales/tr.json'

/**
 * Dil çevirileri yapılandırması
 * Desteklenen diller: İngilizce, Türkçe
 */

export interface LanguageInfo {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    dir: string;
}

export const LANGUAGES: Record<string, LanguageInfo> = {
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        dir: 'ltr'
    },
    tr: {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe',
        flag: '🇹🇷',
        dir: 'ltr'
    }
} as const

export const translations = {
    en,
    tr
}

export const DEFAULT_LANGUAGE = 'tr'
export const VALID_LANGUAGES = Object.keys(LANGUAGES)

