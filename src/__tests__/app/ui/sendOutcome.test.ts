/**
 * `resolveSendOutcome` — gönderim sonucunun **tek yorumu**.
 *
 * Bu dosya, otomatik "tekrar dene" kararının neden hata metnine değil **aşama**
 * bilgisine bağlı olduğunu sınar. Sınanan sözleşme tek cümlede:
 *
 * > Hedefe dokunulduğundan emin olunamıyorsa, otomatik tekrar yapılmaz.
 *
 * `error_cancelled` kullanıcıya "tekrar göndermek mükerrer mesaj oluşturur"
 * diyor. Bu mesajın doğru olabilmesi için aşama bilgisi taşımayan bir
 * iptalin de otomatik tekrarı kapatması gerekir — aksi halde uygulama
 * kendi uyarısını kendi çözmesini imle eder.
 */
import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'

import { describe, expect, it } from 'vitest'

describe('resolveSendOutcome — cancellation', () => {
  it('blocks auto-retry for a cancellation that reports no stage', () => {
    // Aşama bildirmeyen iptal: ne yapıldığı bilinmiyor. Bilinmeyen mutasyon
    // "mutasyon yok" sayılamaz.
    const outcome = resolveSendOutcome({ success: false, error: 'cancelled' })

    expect(outcome.resendSafe).toBe(false)
    expect(outcome.kind).toBe('incomplete')
    expect(outcome.errorCode).toBe('cancelled')
  })

  it('blocks auto-retry when the request had already started', () => {
    const outcome = resolveSendOutcome({ success: false, error: 'cancelled', stage: 'uncertain' })

    expect(outcome.resendSafe).toBe(false)
    expect(outcome.kind).toBe('incomplete')
  })

  it('allows auto-retry when the send was cancelled before anything was written', () => {
    const outcome = resolveSendOutcome({
      success: false,
      error: 'cancelled_before_send',
      stage: 'not_started'
    })

    expect(outcome.resendSafe).toBe(true)
    expect(outcome.kind).toBe('failed')
    expect(outcome.errorCode).toBe('cancelled_before_send')
  })

  it('never lets an incomplete result fall back to a plain error', () => {
    // `error` + `incomplete` ayrımı: ikisi de taslağı korur, ama yalnızca
    // `incomplete` kullanıcıya nerede durduğunu söyler.
    const outcome = resolveSendOutcome({ success: false, error: 'cancelled' })
    expect(outcome.feedback).toBe('incomplete')
  })
})

describe('resolveSendOutcome — stage, not error text, decides retry', () => {
  it('resends safely when the first image never pasted', () => {
    const outcome = resolveSendOutcome({
      success: false,
      error: 'paste_failed',
      stage: 'not_started'
    })

    expect(outcome.kind).toBe('failed')
    expect(outcome.resendSafe).toBe(true)
  })

  it('never resends the same code when an earlier image already landed', () => {
    // Aynı hata kodu, hedef dolu olduğunda güvenli değildir.
    const outcome = resolveSendOutcome({
      success: false,
      error: 'paste_failed',
      stage: 'partial'
    })

    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('keeps autosend_failed_draft_saved incomplete', () => {
    const outcome = resolveSendOutcome({ success: false, error: 'autosend_failed_draft_saved' })

    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('never resends a fully written target that failed only at submit', () => {
    // `applied` burada tuzak: başarıda "hazırlandı" der, başarısızlıkta ise
    // "görseller + prompt kutuda, yalnızca tıklama yapılmadı" anlamına gelir.
    // Hata + mutasyon birleşimi her zaman güvensizdir.
    const outcome = resolveSendOutcome({
      success: false,
      error: 'submit_ready_script_failed',
      stage: 'applied'
    })

    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('keeps a fully-reverted rollback safely retryable', () => {
    // Telafi hedefi eski haline döndürdüyse `not_started` düşer ve tekrar
    // açılır: hedefte bizim bıraktığımız bir şey yok.
    const outcome = resolveSendOutcome({
      success: false,
      error: 'send_failed',
      stage: 'not_started'
    })

    expect(outcome.kind).toBe('failed')
    expect(outcome.resendSafe).toBe(true)
  })

  it('treats a busy rejection as not-an-error and leaves state untouched', () => {
    const outcome = resolveSendOutcome({ success: false, error: 'send_in_progress' })

    expect(outcome.kind).toBe('busy')
    expect(outcome.feedback).toBe('idle')
    expect(outcome.errorCode).toBeNull()
  })

  it('still resends a plain stage-less failure safely', () => {
    // Mutasyon bilgisi taşımayan, hedefe hiçbir şey yazamayan hatalar
    // (geçersiz girdi, hazır olmayan webview) güvenle tekrarlanabilir.
    const outcome = resolveSendOutcome({ success: false, error: 'webview_not_ready' })

    expect(outcome.kind).toBe('failed')
    expect(outcome.resendSafe).toBe(true)
  })
})

describe('resolveSendOutcome — success shapes', () => {
  it.each([
    ['auto_click', 'delivered'],
    ['auto_click_with_prompt', 'delivered'],
    ['paste_only', 'staged'],
    ['paste_and_prompt', 'staged'],
    ['staged', 'staged']
  ] as const)('reads mode %s as %s and stays silent', (mode, expectedKind) => {
    const outcome = resolveSendOutcome({ success: true, mode, stage: 'applied' })

    expect(outcome.kind).toBe(expectedKind)
    // Başarı sessizdir: kullanıcı sonucu site kutusunda kendi görür.
    expect(outcome.feedback).toBe('idle')
  })

  it('falls back to failed for an unusable result', () => {
    expect(resolveSendOutcome(undefined).kind).toBe('failed')
    expect(resolveSendOutcome('nope').kind).toBe('failed')
    expect(resolveSendOutcome({ success: false }).kind).toBe('failed')
  })
})
