import type { SendFeedback } from './types'

/**
 * Gönderim sonucunun tek yorumu.
 *
 * Composer'a düşen ham sonuç (`{ success, mode, error }`) dört farklı şeyi
 * anlatabilir; hepsi `success: boolean` + `mode?: string` + `error?: string`
 * ile taşınır ve ayrımı yapan tek yer burasıdır:
 *
 * | Sonuç      | Anlamı                                                |
 * | ---------- | ----------------------------------------------------- |
 * | `delivered`| İçerik AI'ya ulaştı.                                  |
 * | `staged`   | İçerik AI kutusuna yazıldı, kullanıcı gönderacak.     |
 * | `failed`   | İşlem yapılmadı; taslak korunur, güvenle tekrarlanır. |
 * | `incomplete`| İşlem **kısmen** uygulandı; otomatik tekrar güvenli değil. |
 * | `busy`     | Eşzamanlı ikinci gönderim reddedildi; bir hata değil.  |
 *
 * `incomplete` ayrı bir durum olarak tutulur: belirsiz bir sonucu `success`
 * ya da `error` içine sıkıştırmak ya hedefte mükerrer mesaj üretir ya da
 * kullanıcıyı gerçekleşmemiş bir teslimle kandırır.
 */

/**
 * Otomatik gönderim kapalıyken içeriğin "hazır" sayıldığı modlar.
 * `submitUtils` içindeki allowlist ile aynı küme (`sendUtils` tek kaynaktır;
 * burada liste, tip bağımsız kullanılabilsin diye gömülü olarak tekrarlanır).
 */
const STAGED_MODES = new Set(['staged', 'paste_only', 'paste_and_prompt'])

type SendOutcomeKind = 'delivered' | 'staged' | 'failed' | 'incomplete' | 'busy'

export interface SendOutcome {
  kind: SendOutcomeKind
  /** `busy` için mevcut durum değişmez → `idle`. */
  feedback: SendFeedback
  /** `error_*` ön ekli olacak şekilde çözülecek hata kodu (yoksa null). */
  errorCode: string | null
  /** Kullanıcının eylemi güvenle tekrarlanabilir mi? */
  resendSafe: boolean
}

/**
 * "İş kısmen uygulandı" anlamına gelen hatalar.
 *
 * Bunlarda içerik hedefe **ulaşmıştır**, sonraki bir adım başarısız olmuştur
 * (ör. görseller site kutusuna yapıştırıldı, yalnızca submit tıklaması
 * başarısız oldu). Aynı içeriği tekrar göndermek hedefte ikinci bir kopya
 * bırakır; bu yüzden otomatik tekrar yapılmaz, kullanıcı bilgilendirilir.
 */
const INCOMPLETE_ERRORS = new Set(['autosend_failed_draft_saved'])

/** Gerçek bir hata değil, eşzamanlı ikinci çağrının reddi. */
const BUSY_ERRORS = new Set(['send_in_progress'])

function readStringProp(result: object, key: string): string | null {
  if (!(key in result)) return null
  const raw = (result as Record<string, unknown>)[key]
  return raw === undefined || raw === null || raw === '' ? null : String(raw)
}

/** Ham gönderim sonucunu anlamlı bir gönderim durumuna çevirir. */
export function resolveSendOutcome(result: unknown): SendOutcome {
  if (result === undefined || result === null) {
    return { kind: 'failed', feedback: 'error', errorCode: 'unknown_error', resendSafe: true }
  }

  if (typeof result !== 'object') {
    return { kind: 'failed', feedback: 'error', errorCode: 'unknown_error', resendSafe: true }
  }

  const errorCode = readStringProp(result, 'error')
  if (errorCode) {
    if (BUSY_ERRORS.has(errorCode)) {
      // Eşzamanlı gönderim: kullanıcı ikinci kez "Gönder"e basmış, işlem zaten
      // sürüyor. Hata gibi gösterilirse süren gönderimin durumu bozulur.
      return { kind: 'busy', feedback: 'idle', errorCode: null, resendSafe: true }
    }
    if (INCOMPLETE_ERRORS.has(errorCode)) {
      return { kind: 'incomplete', feedback: 'incomplete', errorCode, resendSafe: false }
    }
    // Taslak her hata halinde korunur; kısmi uygulama içermeyen hatalar
    // güvenle tekrarlanabilir (veri kaybı olmaz, mükerrer hedef oluşmaz).
    return { kind: 'failed', feedback: 'error', errorCode, resendSafe: true }
  }

  const success = (result as { success?: unknown }).success === true
  if (!success) {
    return { kind: 'failed', feedback: 'error', errorCode: 'unknown_error', resendSafe: true }
  }

  const mode = readStringProp(result, 'mode')
  if (mode && STAGED_MODES.has(mode)) {
    return { kind: 'staged', feedback: 'staged', errorCode: null, resendSafe: true }
  }
  return { kind: 'delivered', feedback: 'success', errorCode: null, resendSafe: true }
}

/** `error_*` i18n anahtarı; çözülemeyen kod ham metin olarak döner. */
export function toErrorI18nKey(errorCode: string): string {
  return `error_${errorCode}`
}
