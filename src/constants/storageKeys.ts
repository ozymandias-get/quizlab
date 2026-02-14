/**
 * localStorage Key Sabitleri
 * 
 * Tüm localStorage key'leri burada merkezi olarak tanımlanır.
 * Bu yaklaşım:
 * - Yazım hatalarını önler (IDE otomatik tamamlama sağlar)
 * - Key'lerin nerede kullanıldığını bulmayı kolaylaştırır
 * - Refactoring'i güvenli hale getirir
 * - Çakışmaları önler
 * 
 * Kullanım:
 * import { STORAGE_KEYS } from '../constants/storageKeys'
 * useLocalStorage(STORAGE_KEYS.LEFT_PANEL_WIDTH, 50)
 */

export const STORAGE_KEYS = {
    // Panel Ayarları
    /** Sol panelin genişlik yüzdesi (number) */
    LEFT_PANEL_WIDTH: 'leftPanelWidth',



    // AI Ayarları
    /** Son seçilen AI platformu (string: 'chatgpt' vb.) */
    LAST_SELECTED_AI: 'lastSelectedAI',

    /** Otomatik gönder özelliği aktif mi (boolean) */
    AUTO_SEND_ENABLED: 'autoSendEnabled',

    /** Aktif edilecek Modellerin listesi (JSON array string) */
    ENABLED_MODELS: 'enabledModels',



    // Görünüm Ayarları
    /** Sadece ikonları göster (boolean) */
    SHOW_ONLY_ICONS: 'showOnlyIcons',

    /** Alt bar şeffaflığı (number: 0.1 - 1.0) */
    BOTTOM_BAR_OPACITY: 'bottomBarOpacity',

    /** Alt bar boyutu/ölçeği (number: 0.8 - 1.5) */
    BOTTOM_BAR_SCALE: 'bottomBarScale',


    /** Pencere düzeni değiştirildi mi (boolean) - Sol ve Sağ panel yer değişimi */
    IS_LAYOUT_SWAPPED: 'isLayoutSwapped',

    // Arkaplan Ayarları
    /** Arkaplan tipi ('solid' | 'animated') */
    BG_TYPE: 'bgType',
    /** Sabit renk kodu (hex) */
    BG_SOLID_COLOR: 'bgSolidColor',
    /** Hareketli arkaplan renkleri (JSON array) */
    BG_ANIMATED_COLORS: 'bgAnimatedColors',
    /** Rastgele renk modu aktif mi (boolean) */
    BG_RANDOM_MODE: 'bgRandomMode',

    /** Metin seçme ve AI butonu rengi (hex) */
    SELECTION_COLOR: 'selectionColor',

    // Dil Ayarları
    /** Uygulama dili (string: 'tr' | 'en' | 'zh' | 'es' | 'ar') */
    APP_LANGUAGE: 'appLanguage',

    // Prompt Ayarları
    /** Kayıtlı Promptlar (JSON Array) */
    CUSTOM_PROMPTS: 'customPrompts',

    /** Seçili Prompt ID (string | null) */
    SELECTED_PROMPT_ID: 'selectedPromptId',

    // Son Okuma Durumu
    /** Son okunan PDF dosya bilgisi ve sayfa numarası (JSON: {name, path, page, streamUrl}) */
    LAST_PDF_READING: 'lastPdfReading'
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

/**
 * Tüm localStorage verilerini temizle (debug/reset için)
 */
export function clearAllStorageKeys(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
    })
}

/**
 * Belirli bir key'in localStorage'da olup olmadığını kontrol et
 * @param {string} key - STORAGE_KEYS'den bir key
 * @returns {boolean}
 */
export function hasStorageKey(key: string): boolean {
    return localStorage.getItem(key) !== null
}

export default STORAGE_KEYS
