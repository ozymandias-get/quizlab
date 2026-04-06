/**
 * localStorage Key Sabitleri
 *
 * T�m localStorage key'leri burada merkezi olarak tan�mlan�r.
 * Bu yakla��m:
 * - Yaz�m hatalar�n� �nler (IDE otomatik tamamlama sa�lar)
 * - Key'lerin nerede kullan�ld���n� bulmay� kolayla�t�r�r
 * - Refactoring'i g�venli hale getirir
 * - �ak��malar� �nler
 *
 * Kullan�m:
 * import { STORAGE_KEYS } from '../constants/storageKeys'
 * useLocalStorage(STORAGE_KEYS.LEFT_PANEL_WIDTH, 50)
 */

export const STORAGE_KEYS = {
  /** Sol panelin geni�lik y�zdesi (number) */
  LEFT_PANEL_WIDTH: 'leftPanelWidth',

  /** Son se�ilen AI platformu (string: 'chatgpt' vb.) */
  LAST_SELECTED_AI: 'lastSelectedAI',

  /** Otomatik g�nder �zelli�i aktif mi (boolean) */
  AUTO_SEND_ENABLED: 'autoSendEnabled',

  /** Aktif edilecek Modellerin listesi (JSON array string) */
  ENABLED_MODELS: 'enabledModels',

  /** Bir kez otomatik etkinle�tirilen built-in site ID listesi (JSON array string) */
  BUILT_IN_SITE_BOOTSTRAP: 'builtInSiteBootstrap',

  /** Varsay�lan AI modeli (string) */
  DEFAULT_AI_MODEL: 'defaultAiModel',

  /** Pinlenmi� AI sekmeleri (JSON array: [{ id, modelId, title? }]) */
  PINNED_AI_TABS: 'pinnedAiTabs',

  /** Sadece ikonlar� g�ster (boolean) */
  SHOW_ONLY_ICONS: 'showOnlyIcons',

  /** Alt bar �effafl��� (number: 0.1 - 1.0) */
  BOTTOM_BAR_OPACITY: 'bottomBarOpacity',

  /** Alt bar boyutu/�l�e�i (number: 0.8 - 1.5) */
  BOTTOM_BAR_SCALE: 'bottomBarScale',

  /** Pencere d�zeni de�i�tirildi mi (boolean) - Sol ve Sa� panel yer de�i�imi */
  IS_LAYOUT_SWAPPED: 'isLayoutSwapped',

  /** Arkaplan tipi ('solid' | 'animated') */
  BG_TYPE: 'bgType',
  /** Sabit renk kodu (hex) */
  BG_SOLID_COLOR: 'bgSolidColor',
  /** Hareketli arkaplan renkleri (JSON array) */
  BG_ANIMATED_COLORS: 'bgAnimatedColors',
  /** Rastgele renk modu aktif mi (boolean) */
  BG_RANDOM_MODE: 'bgRandomMode',

  /** Metin se�me ve AI butonu rengi (hex) */
  SELECTION_COLOR: 'selectionColor',

  /** Uygulama dili (string: 'tr' | 'en' | 'zh' | 'es' | 'ar') */
  APP_LANGUAGE: 'appLanguage',

  /** Kay�tl� Promptlar (JSON Array) */
  CUSTOM_PROMPTS: 'customPrompts',

  /** Se�ili Prompt ID (string | null) */
  SELECTED_PROMPT_ID: 'selectedPromptId',

  /** Son okunan PDF dosya bilgisi ve sayfa numaras� (JSON: {name, path, page, streamUrl}) */
  LAST_PDF_READING: 'lastPdfReading'
} as const
