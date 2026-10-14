import type { SendStage } from '@features/ai'

import type { SendFeedback } from './types'

/**
 * Gönderim sonucunun tek yorumu.
 *
 * Composer'a düşen ham sonuç (`{ success, mode, error, stage }`) birden fazla
 * şeyi anlatabilir; hepsi `success: boolean` + `mode?` + `error?` + `stage?`
 * ile taşınır ve ayrımı yapan tek yer burasıdır:
 *
 * | Sonuç      | Anlamı                                                |
 * | ---------- | ----------------------------------------------------- |
 * | `delivered`| İçerik AI'ya ulaştı.                                  |
 * | `staged`   | İçerik AI kutusuna yazıldı, kullanıcı gönderacak.     |
 * | `failed`   | İşlem yapılmadı; taslak korunur, güvenle tekrarlanır. |
 * | `incomplete`| İşlem **kısmen** uygulandı ya da **bilinmiyor**; otomatik tekrar güvenli değil. |
 * | `busy`     | Eşzamanlı ikinci gönderim reddedildi; bir hata değil.  |
 *
 * `delivered` ve `staged` **sessizdir**: ikisi de `idle` geri bildirimi döner.
 * Kullanıcı sonucu site kutusunda kendi görür; ikinci bir "Gönderildi" yazısı
 * yalnızca aynı olayı tekrarlar. `kind` ayrımı yine de korunur — hata ve telafi
 * kararları gönderim sonucunun anlamına bağlıdır.
 *
 * `incomplete` ayrı bir durum olarak tutulur: belirsiz bir sonucu `success`
 * ya da `error` içine sıkıştırmak ya hedefte mükerrer mesaj üretir ya da
 * kullanıcıyı gerçekleşmemiş bir teslimle kandırır.
 *
 * ## Bilgi yoksa güvenli taraf
 *
 * Sonucun okunamadığı her hal (`undefined`, ilkel değer, `success` alanı
 * olmayan nesne) `incomplete`'tir: "bilmiyoruz" ile "hiçbir şey olmadı"
 * arasındaki fark burada mükerrer mesajla kapanır.
 *
 * ## Neden hata kodu yetmez
 *
 * `paste_failed` kodu, ilk görselde döndüğünde hedefin boş olduğu anlamına
 * gelir (güvenli tekrar); üçüncü görselde döndüğünde ilk ikisi kutunun
 * içindedir (tekrar mükerrer mesaj). Bu yüzden **öncelik `stage`'dedir**;
 * hata kodu yalnızca kullanıcıya gösterilecek metni seçer. `stage` taşımayan
 * (yani mutasyon bilgisi vermeyen) eski sonuçlar için kod tablosu devreye
 * girer ve davranış değişmez.
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
  /** `busy` için mevcut durum değişmez → `idle`. Başarılar da `idle`. */
  feedback: SendFeedback
  /** `error_*` ön ekli olacak şekilde çözülecek hata kodu (yoksa null). */
  errorCode: string | null
  /** Kullanıcının eylemi güvenle tekrarlanabilir mi? */
  resendSafe: boolean
}

/**
 * "İş kısmen uygulandı" anlamına gelen hatalar — **aşama bildirmeyen** eski
 * sonuçlar için güvenlik ağı.
 *
 * Bunlarda içerik hedefe **ulaşmıştır**, sonraki bir adım başarısız olmuştur
 * (ör. görseller site kutusuna yapıştırıldı, yalnızca submit tıklaması
 * başarısız oldu). Aynı içeriği tekrar göndermek hedefte ikinci bir kopya
 * bırakır; bu yüzden otomatik tekrar yapılmaz, kullanıcı bilgilendirilir.
 *
 * Pipeline'lar artık `stage` bildirdiği için bu liste **ikame değil, geriye
 * dönük güvenlik katmanıdır**; `autosend_failed_draft_saved` davranışı korunur.
 */
const INCOMPLETE_ERRORS = new Set(['autosend_failed_draft_saved'])

/** Gerçek bir hata değil, eşzamanlı ikinci çağrının reddi. */
const BUSY_ERRORS = new Set(['send_in_progress'])

/**
 * **Aşaması bildirilmemiş** iptaller.
 *
 * `cancelled` tek bir anlam değildir ve `error_cancelled` metni bunu kullanıcıya
 * açıkça söyler: "tekrar göndermek mükerrer mesaj oluşturur". O zaman bir
 * iptalin otomatik tekrarı yalnızca hedefe **hiç dokunulmadığı** kanıtlandığında
 * açılabilir.
 *
 * Aşama taşımayan bir iptalde elimizde kanıt yoktur; "kanıt yok" da "mutasyon
 * yok" demek değildir. Bu yüzden bilgi eksikliği **belirsiz** sayılır ve tekrar
 * kapatılır. Hiçbir şey yapıldığını bilen üreticiler bunu açıkça bildirir
 * (`stage: 'not_started'`, bkz. `cancelScheduledApiChatSends`).
 */
const UNSTAGED_CANCEL_ERRORS = new Set(['cancelled'])

/** Otomatik tekrarın güvenli olmadığı aşamalar: hedefe dokunulmuş olabilir. */
const UNSAFE_RETRY_STAGES = new Set<SendStage>(['partial', 'uncertain'])

function readStringProp(result: object, key: string): string | null {
  if (!(key in result)) return null
  const raw = (result as Record<string, unknown>)[key]
  return raw === undefined || raw === null || raw === '' ? null : String(raw)
}

/** Sonucun taşıdığı aşamayı okur; bilinmeyen/geçersiz değerler `null` olur. */
function readStage(result: object): SendStage | null {
  const raw = readStringProp(result, 'stage')
  if (raw === 'not_started' || raw === 'partial' || raw === 'applied' || raw === 'uncertain') {
    return raw
  }
  return null
}

/**
 * Sonuç **hiç okunamıyorsa** güvenli taraf seçilir.
 *
 * `undefined`, `null`, bir ilkel değer ya da `success` alanı olmayan bir
 * nesne, "mutasyon yapılmadı" anlamına **gelmez**; yalnızca "bilmiyoruz"
 * anlamına gelir. Bu katmanın bir istisnayı yutmuş olması ya da kırık bir
 * üretici olması, hedefin önceden değişmiş olabileceğini dışlamaz.
 *
 * Güvenli taraf burada `resendSafe: false`'tır: en kötü ihtimalde kullanıcı
 * elle devam eder; tersi seçilseydi en kötü ihtimal hedefte mükerrer mesaj
 * olurdu. `NO_SEND_RESULT` da tam olarak bu gerekçeyle `uncertain` taşır.
 */
function undecidableOutcome(): SendOutcome {
  return {
    kind: 'incomplete',
    feedback: 'incomplete',
    errorCode: 'unknown_error',
    resendSafe: false
  }
}

/** Ham gönderim sonucunu anlamlı bir gönderim durumuna çevirir. */
export function resolveSendOutcome(result: unknown): SendOutcome {
  if (result === undefined || result === null) {
    return undecidableOutcome()
  }

  if (typeof result !== 'object') {
    return undecidableOutcome()
  }

  const errorCode = readStringProp(result, 'error')
  if (errorCode && BUSY_ERRORS.has(errorCode)) {
    // Eşzamanlı gönderim: kullanıcı ikinci kez "Gönder"e basmış, işlem zaten
    // sürüyor. Hata gibi gösterilirse süren gönderimin durumu bozulur.
    return { kind: 'busy', feedback: 'idle', errorCode: null, resendSafe: true }
  }

  const stage = readStage(result)
  // Aşama, mutasyonun varlığını bildirdiği için hata kodundan önce gelir:
  // `partial`/`uncertain` her koşulda otomatik tekrarı kapatır.
  if (stage && UNSAFE_RETRY_STAGES.has(stage)) {
    return { kind: 'incomplete', feedback: 'incomplete', errorCode, resendSafe: false }
  }

  // Aşaması bildirilmemiş iptal: ne yapıldığı bilinmiyor. Bilinmeyen mutasyon
  // "mutasyon yok" sayılamaz, bu yüzden `cancelled` burada da `incomplete`'tir.
  if (!stage && errorCode && UNSTAGED_CANCEL_ERRORS.has(errorCode)) {
    return { kind: 'incomplete', feedback: 'incomplete', errorCode, resendSafe: false }
  }

  if (errorCode) {
    if (INCOMPLETE_ERRORS.has(errorCode)) {
      return { kind: 'incomplete', feedback: 'incomplete', errorCode, resendSafe: false }
    }
    // **Hata + hedefe dokunulmuş olması** = güvensiz tekrar.
    //
    // `applied` aşaması burada tuzak bir isim: başarılı gönderimde "içerik
    // tamamen hazırlandı" demektir, ama **başarısız** bir gönderimde aynı
    // değer "görseller yapıştırıldı, prompt yazıldı, yalnızca submit
    // tıklaması başarısız oldu" anlamına gelir. O durumda hedef kutu doludur
    // ve aynı içeriği tekrar göndermek **ikinci bir kopya** bırakır.
    //
    // Bu yüzden güvenli tekrarın koşulu "aşama `applied` değil" değil,
    // "hiçbir şey değişmedi"dir: yalnızca `not_started` (veya aşamasız,
    // mutasyon üretemeyen ön uçuş hataları) tekrarı açar.
    if (stage && stage !== 'not_started') {
      return { kind: 'incomplete', feedback: 'incomplete', errorCode, resendSafe: false }
    }
    // Taslak her hata halinde korunur; kısmi uygulama içermeyen hatalar
    // güvenle tekrarlanabilir (veri kaybı olmaz, mükerrer hedef oluşmaz).
    return { kind: 'failed', feedback: 'error', errorCode, resendSafe: true }
  }

  const success = (result as { success?: unknown }).success === true
  if (!success) {
    // Hatasız bir başarısız sonuç iki ayrı durum olabilir.
    //
    // **Aşama bildiren üretici.** `stage` mutasyonun varlığını bildirir, `error`
    // yalnızca metin seçer; aşama bildiren bir üretici hata kodu taşımak
    // zorunda değildir. Güvenli tekrarın koşulu "hiçbir şey değişmedi"dir:
    // yalnızca `not_started` onu kanıtlar ve tekrarı açar. `applied` ise
    // "içerik hazırlandı, yalnızca teslim edilmedi" demektir — hedefte kutu
    // doludur ve tekrar göndermek **ikinci bir kopya** bırakır.
    //
    // Ölçüt `not_started` dışındaki **her** aşamayı kapatır: `partial` ve
    // `uncertain` zaten yukarıda elendi, ama `SendStage`'a ileride eklenebilecek
    // yeni bir aşama da varsayılan olarak güvenli tarafta kalsın.
    if (stage) {
      if (stage === 'not_started') {
        return { kind: 'failed', feedback: 'error', errorCode: 'unknown_error', resendSafe: true }
      }
      return {
        kind: 'incomplete',
        feedback: 'incomplete',
        errorCode: 'unknown_error',
        resendSafe: false
      }
    }

    // **Ne aşama ne hata bildiren sonuç.** Bu katmanın bir istisnayı yutmuş
    // ya da kırık bir üretici olması, hedefin önceden değişmiş olabileceğini
    // dışlamaz. Bilgi yoksa güvenli taraf seçilir.
    return undecidableOutcome()
  }

  // `delivered` ve `staged` ikisi de **başarılı** teslimattır ve ikisi de
  // sessizdir: kullanıcı sonucu site kutusunda kendi görür. Bu yüzden ikisi de
  // `idle` geri bildirimi döner; ayrım yalnızca `kind` üzerinde korunur.
  const mode = readStringProp(result, 'mode')
  const kind: SendOutcomeKind = mode && STAGED_MODES.has(mode) ? 'staged' : 'delivered'
  return { kind, feedback: 'idle', errorCode: null, resendSafe: true }
}

/** `error_*` i18n anahtarı; çözülemeyen kod ham metin olarak döner. */
export function toErrorI18nKey(errorCode: string): string {
  return `error_${errorCode}`
}
