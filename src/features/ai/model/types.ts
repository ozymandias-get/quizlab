import type { AutomationExecutionDiagnostics } from '@shared-core/types'

interface AiSendStageTimings {
  queueWaitMs: number
  /**
   * İçerik denetleyicisinin gönderime hazır hale gelmesi için beklenen süre
   * (webview açılışı/yeniden yükleme dahil). `queueWaitMs`'ten önce gerçekleşir.
   */
  contentReadyMs?: number
  configResolveMs: number
  scriptGenerationMs?: number
  executeJavaScriptMs?: number
  /**
   * Betik içinde element arama/çözümleme için harcanan toplam süre
   * (selectorEngine `durationMs` toplamı).
   */
  selectorLookupMs?: number
  /** Metnin giriş alanına yazılması/yapıştırılması süresi (betik `setInputMs`). */
  textInsertionMs?: number
  /** Metnin alana girdiği mekanizma: synthetic_paste / exec_command / ... */
  textInputStrategy?: string | null
  /** Yapıştırma doğrulanamadığı için yazım fallback'i kullanıldıysa dolu. */
  textInputFallback?: string | null
  clipboardMs?: number
  /** Görsel gönderiminde sistem panosunun geri yüklenmesi süresi. */
  clipboardRestoreMs?: number
  /**
   * Restore işinin `finally` içinde kritik yolda **bekletildiği** süre.
   * Restore settle+IPC arka planda başlatıldığı için genelde ~0'dır; bu iki
   * değerin farkı paralel çalıştırmanın gerçek kazancıdır.
   */
  clipboardRestoreWaitMs?: number
  /**
   * Kuyruk dışı pipeline süresi (dosya/script adımları + `finally`/restore
   * dahil). `totalMs ≈ queueWaitMs + pipelineMs`.
   */
  pipelineMs?: number
  /**
   * Kullanıcı gönderim eyleminden (içerik hazırlığı dahil) sonuca kadar geçen
   * toplam süre. `contentReadyMs` bu sürenin içindedir; ayrı ayrı toplanmaz.
   */
  endToEndMs?: number
  /** Metin doğrulama sonucu: verified | partial | ambiguous | unchanged. */
  textVerifyResult?: string | null
  /** Doğrulamada gözlenen normalleştirilmiş karakter farkı. */
  textVerifyDelta?: number
  focusScriptGenerationMs?: number
  focusExecuteJavaScriptMs?: number
  refocusScriptGenerationMs?: number
  refocusExecuteJavaScriptMs?: number
  pasteMs?: number
  promptScriptGenerationMs?: number
  promptExecuteJavaScriptMs?: number
  postPastePromptDelayMs?: number
  imageUploadWaitMs?: number
  /** Submit-ready beklemesinin süresi (event-driven wait). */
  submitReadyMs?: number
  /** Submit hedefinin ilk "hazır" olduğu an; sabit settle payını ayırır. */
  submitReadyFirstReadyMs?: number | null
  submitReadyScriptGenerationMs?: number
  submitReadyExecuteJavaScriptMs?: number
  clickScriptGenerationMs?: number
  clickExecuteJavaScriptMs?: number
  /** Submit tetikleme adımının süresi (betik `submitMs`). */
  submitTriggerMs?: number
  /** Submit öncesi uygulanan sabit settle beklemesi (yalnızca enter_key). */
  preSubmitWaitMs?: number
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
  /**
   * Pano geri yükleme tamamlanamadı (kapsam için snapshot yok ya da yazma
   * başarısız). Sonuç "geri yüklendi" gibi raporlanmaz; log'lanır.
   */
  clipboardRestoreFailed?: boolean
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

/**
 * Gönderimin hedef AI giriş alanında **ne kadar mutasyon bıraktığı**.
 *
 * Hata kodu tek başına bu soruya yetmez: `paste_failed` kodu, ilk görsel
 * yapıştırıldıktan **sonra** da üçüncü görselde dönebilir. Aynı kod, hedefe
 * hiçbir şey bırakmadan da dönebilir. Otomatik "tekrar dene" kararı yalnızca
 * bu alandan okunur; hata metnine bakarak karar vermek hedefte ikinci bir
 * kopya bırakır.
 *
 * | Aşama          | Anlamı                                                   |
 * | -------------- | -------------------------------------------------------- |
 * | `not_started`  | Hedefe hiç dokunulmadı; güvenle tekrarlanabilir.           |
 * | `partial`      | En az bir ek yapıştırıldı/yazıldı, işlem tamamlanmadı.     |
 * | `applied`      | İçerik tamamen hazırlandı (teslim edildi veya staged).     |
 * | `uncertain`    | Yapıştırma gönderildi ama uygulanıp uygulanmadığı **kanıtlanamadı**. |
 *
 * `partial` ve `uncertain` için otomatik tekrar **güvenli değildir**: ikisinde
 * de hedefe dokunulmuş olabilir. Kullanıcı bilgilendirilir, otomatik yeniden
 * gönderme yapılmaz.
 */
export type SendStage = 'not_started' | 'partial' | 'applied' | 'uncertain'

export interface SendTextResult {
  success: boolean
  error?: string
  mode?: string
  /** Hedefe bırakılan mutasyonun aşaması (bkz. {@link SendStage}). */
  stage?: SendStage
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface SendImageResult {
  success: boolean
  error?: string
  mode?: string
  /** Hedefe bırakılan mutasyonun aşaması (bkz. {@link SendStage}). */
  stage?: SendStage
  actualUrl?: string
  diagnostics?: AiSendDiagnostics
}

export interface AiSendOptions {
  /**
   * Per-send override of the global auto-send preference. `false` stages the
   * content (paste the image, fill the prompt) and leaves submitting to the
   * user; there is no override that submits regardless.
   */
  autoSend?: boolean
  promptText?: string
  /**
   * Görsel yapıştırdıktan sonra ek notu giriş alanının sonuna ekle (Quill/contenteditable uyumu).
   * false: tüm alanı yeniden yazmayı dene (eski mod). Varsayılan: true.
   */
  appendPromptAfterPaste?: boolean
}

export type AiSendResult = SendTextResult | SendImageResult
