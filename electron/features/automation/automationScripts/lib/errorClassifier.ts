/**
 * Error Classifier
 * ─────────────────────────────────────────────────────────────────────────────
 * Tek bir sınıflandırıcı, otomasyon hatalarını kategoriye ayırır ve her
 * kategori için deterministik bir "sonraki adım" politikası üretir.
 *
 * Önceki tasarımda (bkz. aiSenderSupport.normalizeSendErrorCode):
 *   - Hata kodu düz bir string olarak iade ediliyordu
 *   - "submit_failed" / "input_not_found" gibi alt kodlar kayboluyordu
 *   - Tek bir `showError` toast'ına düşüyordu → kullanıcı ne yapacağını bilemiyordu
 *
 * Yeni tasarım:
 *   - Kategori (selector | upload | submit | paste | network | timeout | ...)
 *   - Yeniden deneme politikası (`never` | `after-repick` | `same-strategy` | `after-backoff`)
 *   - Kullanıcıya yönelik eylem (toast key) — yine aynı i18n sistemi
 *
 * Bu sınıf hem renderer (TypeScript) tarafında, hem de gömülü webview script'lerinde
 * (string template olarak) paylaşılabilir. Webview tarafında minimal bir varyantı
 * `errorClassifierRuntime` içinde bulunur (JSDOM tarafında test edilebilir olması
 * için buradaki saf fonksiyonlardan türetilir).
 */

export type AutomationErrorCategory =
  | 'selector'
  | 'submit'
  | 'paste'
  | 'upload'
  | 'clipboard'
  | 'network'
  | 'timeout'
  | 'webview'
  | 'permission'
  | 'site'
  | 'config'
  | 'unknown'

export type RetryStrategy =
  /** Tekrar denemeyi önerme; kullanıcı müdahalesi gerekli */
  | 'never'
  /** Kullanıcı yeni selector seçmeli */
  | 'after-repick'
  /** Aynı stratejiyle, farklı bir zamanlamayla dene */
  | 'same-strategy'
  /** Aynı adımı farklı bir yöntemle dene (ör. paste → click) */
  | 'different-strategy'
  /** Kısa bir backoff sonra tekrar dene (küçük transient hatalar) */
  | 'after-backoff'

export interface ClassifiedError {
  /** Orijinal hata kodu (normalize edilmiş) */
  code: string
  /** Kategori */
  category: AutomationErrorCategory
  /** Yeniden deneme politikası */
  retry: RetryStrategy
  /** Kullanıcıya gösterilecek toast i18n anahtarı */
  toastKey: string
  /** Saha günlüğü için kısa, insan-okunabilir açıklama */
  description: string
  /** Bu hata fallback mekanizmasını tetiklemeli mi? */
  triggerFallback: boolean
  /**
   * Hatanın otomatik gönderim (auto-send) akışını mı yoksa kullanıcı müdahalesi
   * gerektiren bir akışı mı etkilediğini belirtir. Toast yönlendirmesinde kullanılır.
   */
  isUserActionable: boolean
}

/**
 * Hata kodu → sınıflandırma tablosu.
 * Sıralama önemli: daha spesifik kodlar önce, jenerik olanlar sonda.
 */
const ERROR_TABLE: ReadonlyArray<{
  match: RegExp
  category: AutomationErrorCategory
  retry: RetryStrategy
  toastKey: string
  description: string
  triggerFallback?: boolean
  isUserActionable?: boolean
}> = [
  // ── Selector hataları ───────────────────────────────────────────────
  {
    match: /^input_not_found$/,
    category: 'selector',
    retry: 'after-repick',
    toastKey: 'toast_input_not_found',
    description: 'Input element not found via saved selectors.',
    isUserActionable: true
  },
  {
    match: /^button_not_found$/,
    category: 'selector',
    retry: 'after-repick',
    toastKey: 'toast_button_not_found',
    description: 'Submit button not found via saved selectors.',
    isUserActionable: true
  },
  {
    match: /^selector_repick_required$/,
    category: 'selector',
    retry: 'never',
    toastKey: 'toast_selectors_need_repick',
    description: 'Saved selectors are stale; user re-pick required.',
    isUserActionable: true
  },
  {
    match: /^ambiguous_match$/,
    category: 'selector',
    retry: 'after-repick',
    toastKey: 'toast_selectors_ambiguous',
    description: 'Selector matched multiple elements; refinement required.',
    isUserActionable: true
  },
  // ── Submit / submit_ready hataları ──────────────────────────────────
  {
    match: /^submit_not_ready$/,
    category: 'submit',
    retry: 'different-strategy',
    toastKey: 'toast_submit_not_ready',
    description: 'Submit button never became interactive in time.',
    triggerFallback: true
  },
  {
    match: /^submit_failed$/,
    category: 'submit',
    retry: 'same-strategy',
    toastKey: 'toast_submit_failed',
    description: 'Submit action did not register.',
    triggerFallback: true
  },
  {
    match: /^autosend_failed_draft_saved$/,
    category: 'submit',
    retry: 'never',
    toastKey: 'toast_autosend_draft_saved',
    description: 'Auto-send failed; draft is preserved for manual send.'
  },
  {
    match: /^click_failed$/,
    category: 'submit',
    retry: 'same-strategy',
    toastKey: 'toast_click_failed',
    description: 'Click did not result in navigation/state change.'
  },
  // ── Paste / upload hataları ─────────────────────────────────────────
  {
    match: /^paste_failed$/,
    category: 'paste',
    retry: 'different-strategy',
    toastKey: 'toast_paste_failed',
    description: 'Paste action did not produce text/image in input.',
    triggerFallback: true
  },
  {
    match: /^clipboard_failed$/,
    category: 'clipboard',
    retry: 'after-backoff',
    toastKey: 'toast_clipboard_failed',
    description: 'Could not set clipboard contents.'
  },
  {
    match: /^upload_failed$/,
    category: 'upload',
    retry: 'different-strategy',
    toastKey: 'toast_upload_failed',
    description: 'File upload did not complete in time.',
    triggerFallback: true
  },
  {
    match: /^upload_timed_out$/,
    category: 'upload',
    retry: 'after-backoff',
    toastKey: 'toast_upload_timed_out',
    description: 'Upload progress stalled or never reached 100%.'
  },
  // ── Network / timeout ───────────────────────────────────────────────
  {
    match: /^network_error$/,
    category: 'network',
    retry: 'after-backoff',
    toastKey: 'toast_network_error',
    description: 'Network failure during automation request.'
  },
  {
    match: /^timed_out$/,
    category: 'timeout',
    retry: 'same-strategy',
    toastKey: 'toast_automation_timed_out',
    description: 'Automation step exceeded its time budget.'
  },
  {
    match: /(timeout|timed_out)/i,
    category: 'timeout',
    retry: 'same-strategy',
    toastKey: 'toast_automation_timed_out',
    description: 'Operation timed out.'
  },
  // ── Webview / IPC ───────────────────────────────────────────────────
  {
    match: /^webview_destroyed$/,
    category: 'webview',
    retry: 'never',
    toastKey: 'toast_webview_destroyed',
    description: 'Webview was destroyed mid-operation.'
  },
  {
    match: /^webview_not_ready$/,
    category: 'webview',
    retry: 'never',
    toastKey: 'toast_webview_not_ready',
    description: 'Webview not attached or not ready.'
  },
  {
    match: /^webview_api_missing$/,
    category: 'webview',
    retry: 'never',
    toastKey: 'toast_webview_api_missing',
    description: 'Webview is missing required APIs.'
  },
  // ── Site / config ───────────────────────────────────────────────────
  {
    match: /^wrong_url$/,
    category: 'site',
    retry: 'never',
    toastKey: 'toast_wrong_url',
    description: 'Current URL does not match the AI provider domain.'
  },
  {
    match: /^auth_required$/,
    category: 'permission',
    retry: 'never',
    toastKey: 'toast_auth_required',
    description: 'Authentication is required for this AI provider.',
    isUserActionable: true
  },
  {
    match: /^config_not_found$/,
    category: 'config',
    retry: 'never',
    toastKey: 'toast_config_not_found',
    description: 'No configuration exists for current AI provider.'
  },
  {
    match: /^registry_not_loaded$/,
    category: 'config',
    retry: 'never',
    toastKey: 'toast_registry_not_loaded',
    description: 'AI registry has not finished loading.'
  },
  // ── Validation / format ─────────────────────────────────────────────
  {
    match: /^empty_text$/,
    category: 'config',
    retry: 'never',
    toastKey: 'toast_empty_text',
    description: 'Cannot send empty text.'
  },
  {
    match: /^invalid_input$/,
    category: 'config',
    retry: 'never',
    toastKey: 'toast_invalid_input',
    description: 'Input payload is not in a valid format.'
  },
  {
    match: /^invalid_image_format$/,
    category: 'config',
    retry: 'never',
    toastKey: 'toast_invalid_image_format',
    description: 'Image data URL format is not supported.'
  },
  // ── Cancellation (user-initiated abort) ───────────────────────────
  {
    match: /^cancelled$/,
    category: 'unknown',
    retry: 'never',
    toastKey: 'toast_automation_cancelled',
    description: 'Send was cancelled by the user or superseded by a newer request.'
  }
]

/**
 * Bir hata kodunu sınıflandırılmış bir nesneye dönüştürür.
 * Hiçbir tablo satırı eşleşmezse "unknown" kategorisine düşer.
 */
export function classifyAutomationError(raw: unknown): ClassifiedError {
  const code = normalizeErrorCode(raw)

  for (const entry of ERROR_TABLE) {
    if (entry.match.test(code)) {
      return {
        code,
        category: entry.category,
        retry: entry.retry,
        toastKey: entry.toastKey,
        description: entry.description,
        triggerFallback: entry.triggerFallback === true,
        isUserActionable: entry.isUserActionable === true
      }
    }
  }

  return {
    code,
    category: 'unknown',
    retry: 'same-strategy',
    toastKey: 'toast_automation_failed',
    description: 'Unclassified automation error.',
    triggerFallback: true,
    isUserActionable: false
  }
}

/**
 * Kod normalize edici — `normalizeSendErrorCode` ile aynı mantık.
 * Burada bir kopyası tutularak bağımsız test edilebilir hale getirildi.
 */
export function normalizeErrorCode(raw: unknown): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'Illegal invocation') return 'unknown'
    return trimmed
  }
  if (typeof raw === 'number') return String(raw)
  return 'unknown'
}

/**
 * Kısaltılmış sürüm: yalnızca kategoriyi döndürür (log, metrik).
 */
export function errorCategoryOf(raw: unknown): AutomationErrorCategory {
  return classifyAutomationError(raw).category
}

/**
 * Verilen hatanın "selector yeniden seçim" gerektirip gerektirmediğini söyler.
 * Çağrı yerlerinde `if (shouldRequestRepick(err)) showRepickDialog()` gibi
 * deterministik kararlar almak için kullanılır.
 */
export function shouldRequestRepick(raw: unknown): boolean {
  return classifyAutomationError(raw).retry === 'after-repick'
}

/**
 * Verilen hatanın `after-repick` dışında bir stratejiyle yeniden denenip
 * denenemeyeceğini söyler.
 */
export function isRetryable(raw: unknown): boolean {
  const c = classifyAutomationError(raw)
  return (
    c.retry === 'same-strategy' || c.retry === 'different-strategy' || c.retry === 'after-backoff'
  )
}
