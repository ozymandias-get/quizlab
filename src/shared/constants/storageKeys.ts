/**
 * localStorage Key Sabitleri
 * 
 * Tüm localStorage key'leri burada merkezi olarak tanýmlanýr.
 * Bu yaklaþým:
 * - Yazým hatalarýný önler (IDE otomatik tamamlama saðlar)
 * - Key'lerin nerede kullanýldýðýný bulmayý kolaylaþtýrýr
 * - Refactoring'i güvenli hale getirir
 * - Çakýþmalarý önler
 * 
 * Kullaným:
 * import { STORAGE_KEYS } from '../constants/storageKeys'
 * useLocalStorage(STORAGE_KEYS.LEFT_PANEL_WIDTH, 50)
 */

export const STORAGE_KEYS = {
    // Panel Ayarlarý
    /** Sol panelin geniþlik yüzdesi (number) */
    LEFT_PANEL_WIDTH: 'leftPanelWidth',

    // AI Ayarlarý
    /** Son seçilen AI platformu (string: 'chatgpt' vb.) */
    LAST_SELECTED_AI: 'lastSelectedAI',

    /** Otomatik gönder özelliði aktif mi (boolean) */
    AUTO_SEND_ENABLED: 'autoSendEnabled',

    /** Aktif edilecek Modellerin listesi (JSON array string) */
    ENABLED_MODELS: 'enabledModels',

    /** Bir kez otomatik etkinleþtirilen built-in site ID listesi (JSON array string) */
    BUILT_IN_SITE_BOOTSTRAP: 'builtInSiteBootstrap',

    /** Varsayýlan AI modeli (string) */
    DEFAULT_AI_MODEL: 'defaultAiModel',

    /** Pinlenmiþ AI sekmeleri (JSON array: [{ id, modelId, title? }]) */
    PINNED_AI_TABS: 'pinnedAiTabs',

    // Görünüm Ayarlarý
    /** Sadece ikonlarý göster (boolean) */
    SHOW_ONLY_ICONS: 'showOnlyIcons',

    /** Alt bar þeffaflýðý (number: 0.1 - 1.0) */
    BOTTOM_BAR_OPACITY: 'bottomBarOpacity',

    /** Alt bar boyutu/ölçeði (number: 0.8 - 1.5) */
    BOTTOM_BAR_SCALE: 'bottomBarScale',

    /** Pencere düzeni deðiþtirildi mi (boolean) - Sol ve Sað panel yer deðiþimi */
    IS_LAYOUT_SWAPPED: 'isLayoutSwapped',

    // Arkaplan Ayarlarý
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

    // Dil Ayarlarý
    /** Uygulama dili (string: 'tr' | 'en' | 'zh' | 'es' | 'ar') */
    APP_LANGUAGE: 'appLanguage',

    // Prompt Ayarlarý
    /** Kayýtlý Promptlar (JSON Array) */
    CUSTOM_PROMPTS: 'customPrompts',

    /** Seçili Prompt ID (string | null) */
    SELECTED_PROMPT_ID: 'selectedPromptId',

    // Son Okuma Durumu
    /** Son okunan PDF dosya bilgisi ve sayfa numarasý (JSON: {name, path, page, streamUrl}) */
    LAST_PDF_READING: 'lastPdfReading'
} as const


