import type { AutomationExecutionDiagnostics } from '@shared-core/types'

interface AiSendStageTimings {
  queueWaitMs: number
  configResolveMs: number
  scriptGenerationMs?: number
  executeJavaScriptMs?: number
  clipboardMs?: number
  focusScriptGenerationMs?: number
  focusExecuteJavaScriptMs?: number
  refocusScriptGenerationMs?: number
  refocusExecuteJavaScriptMs?: number
  pasteMs?: number
  promptScriptGenerationMs?: number
  promptExecuteJavaScriptMs?: number
  postPastePromptDelayMs?: number
  imageUploadWaitMs?: number
  submitReadyScriptGenerationMs?: number
  submitReadyExecuteJavaScriptMs?: number
  clickScriptGenerationMs?: number
  clickExecuteJavaScriptMs?: number
  totalMs: number
}

/**
 * Hata sınıflandırma sonucu. `electron/features/automation/automationScripts/
 * helpers/errorClassifier.ts` tarafından üretilir; renderer tarafında
 * yalnızca "ne yapacağım"ı söyler (toast i18n anahtarı, retry politikası,
 * fallback tetikleme kararı).
 */
export interface AiErrorClassification {
  /** Normalize edilmiş hata kodu (örn. `input_not_found`) */
  code: string
  /** Kategori (selector | submit | upload | ...) */
  category: string
  /** Yeniden deneme politikası */
  retry: 'never' | 'after-repick' | 'same-strategy' | 'different-strategy' | 'after-backoff'
  /** Kullanıcıya gösterilecek toast i18n anahtarı */
  toastKey: string
  /** Bu hata fallback mekanizmasını tetiklemeli mi? */
  triggerFallback: boolean
  /** Kullanıcı müdahalesi gerekiyor mu (örn. selector yeniden seçim) */
  isUserActionable: boolean
}

export interface AiSendDiagnostics {
  pipeline: 'text' | 'image'
  tabId?: string
  currentAI: string
  currentUrl?: string
  autoSend: boolean
  timings: AiSendStageTimings
  script?: AutomationExecutionDiagnostics | null
  focusScript?: AutomationExecutionDiagnostics | null
  refocusScript?: AutomationExecutionDiagnostics | null
  promptScript?: AutomationExecutionDiagnostics | null
  submitReadyScript?: AutomationExecutionDiagnostics | null
  clickScript?: AutomationExecutionDiagnostics | null
  /**
   * Pipeline son adımında hata oluştuysa hatanın sınıflandırılmış biçimi.
   * UI katmanı `error` string'ini i18n'e çevirmek yerine doğrudan
   * `toastKey` üzerinden yönlendirme yapabilir.
   */
  classification?: AiErrorClassification | null
}

export interface SendTextResult {
  success: boolean
  error?: string
  mode?: string
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface SendImageResult {
  success: boolean
  error?: string
  mode?: string
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface AiSendOptions {
  autoSend?: boolean
  /** Composer’dan tek seferlik: global otomatik gönder kapalı olsa da tarayıcıda gönder (tıkla) */
  forceAutoSend?: boolean
  promptText?: string
  /**
   * Görsel yapıştırdıktan sonra ek notu giriş alanının sonuna ekle (Quill/contenteditable uyumu).
   * false: tüm alanı yeniden yazmayı dene (eski mod). Varsayılan: true.
   */
  appendPromptAfterPaste?: boolean
}

export type AiSendResult = SendTextResult | SendImageResult
