import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { resolveSendOutcome, toErrorI18nKey } from './sendOutcome'
import type { ComposerPayload, SendFeedback } from './types'

interface UseComposerSendActionOptions {
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
  noteText: string
  effectiveAutoSend: boolean
  setIsExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  setStoredExpanded: (value: boolean) => void
}

/** Sonuç bildiriminin görünür kalma süreleri. Yalnızca hata kalıcıdır. */
const FEEDBACK_TIMEOUT_MS = { error: 6000 } as const

/**
 * Composer'ın gönderim yaşam döngüsü.
 *
 * ## Durumlar ayrıdır
 *
 * `idle | sending | incomplete | error` — hazırlanan içerik "gönderildi"
 * sayılmaz, kısmen uygulanan gönderim "başarısız" sayılmaz. Ayrım
 * `resolveSendOutcome` tarafından tek yerde yapılır.
 *
 * ## Başarı sessizdir
 *
 * Teslim edilen veya hazırlanan içerik için hiçbir durum gösterilmez:
 * gönderim `idle`a döner. Kuyruk boşaldığı ve panel kapandığı için sonuç
 * zaten görünür; ayrıca bir "Gönderildi" yazısı aynı olayı ikinci kez
 * anlatırdı. Yalnızca hata ve **kısmi uygulama** konuşur — çünkü ikisi de
 * sessiz kalırsa kullanıcı içeriğinin nerede olduğunu bilemez.
 *
 * ## İstisna, başarısızlık kanıtı değildir
 *
 * `onSend` attığında elimizde hiçbir bilgi yoktur: işlem hiç başlamamış
 * olabilir, ya da kısmen uygulanmış olabilir. Bu yüzden `catch` dalı
 * güvenli tekrar **açmaz**; `incomplete` işaretler. `resolveSendOutcome`'un
 * bilinmeyen sonuçlar için uyguladığı güvenli tarafla aynı karardır: bilgi
 * eksikliği "mutasyon yok" değildir.
 *
 * ## Zamanlayıcı
 *
 * **Her gönderim başlangıcında önceki geri bildirim zamanlayıcısı iptal
 * edilir.** Aksi halde bir önceki hatanın sayacı, ikinci gönderim sürerken
 * dolup durumu `idle`'a çeker ve kullanıcı gönderim sürerken "durdu" görürdü.
 * Zamanlayıcı yalnızca kendi çağrısına aitse de
 * sıfırlar (iptal edilmiş bir zamanlayıcının son işi yanlış duruma yol açmaz).
 *
 * ## Eşzamanlılık
 *
 * Gönderim kilidi React render zamanlamasına bırakılmaz: `sendingRef` **senkron**
 * set edilir, böylece aynı olay içindeki iki tıklama (açık panel, kapalı dock,
 * Ctrl+Enter, hızlı çift tık) yalnızca birini başlatır. Alt katmandaki
 * orkestrasyon kilidi ise ikinci savunma hattıdır; `send_in_progress` sonucu
 * hata olarak gösterilmez, mevcut durum korunur.
 */
export function useComposerSendAction({
  isSubmitting,
  setIsSubmitting,
  onSend,
  noteText,
  effectiveAutoSend,
  setIsExpanded,
  setStoredExpanded
}: UseComposerSendActionOptions) {
  const { t } = useTranslation()
  const [sendFeedback, setSendFeedback] = useState<SendFeedback>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  /** Son hatanın yeniden denenip denemeyeceği — "Tekrar dene" eyleminin sözleşmesi. */
  const [isResendSafe, setIsResendSafe] = useState(true)

  // Tek zamanlayıcı, ref ile: üst üste gelen gönderimlerde eski zamanlayıcı
  // yeni bildirimi silemez; unmount'ta sızar.
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackResetIdRef = useRef(0)
  useEffect(() => {
    const timerRef = feedbackTimerRef
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    // Geçersiz kıl: sıradaki asılı zamanlayıcı artık yanlış duruma yazamaz.
    feedbackResetIdRef.current += 1
  }, [])

  const scheduleFeedbackReset = useCallback(
    (afterMs: number) => {
      clearFeedbackTimer()
      const token = feedbackResetIdRef.current
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null
        if (feedbackResetIdRef.current !== token) return
        setSendFeedback('idle')
      }, afterMs)
    },
    [clearFeedbackTimer]
  )

  const noteTextRef = useRef(noteText)
  noteTextRef.current = noteText
  const effectiveAutoSendRef = useRef(effectiveAutoSend)
  effectiveAutoSendRef.current = effectiveAutoSend

  /**
   * Render zamanlamasından bağımsız gönderim kilidi.
   *
   * `isSubmitting` state'i bir sonraki render'da güncellenir; aynı olay
   * içindeki ikinci tıklama eski değeri görür ve gönderimi yeniden başlatırdı.
   */
  const sendingRef = useRef(false)

  /** Son gönderim niyeti — "Tekrar dene" bunu birebir yeniden yürütür. */
  const lastIntentRef = useRef<ComposerPayload | undefined>(undefined)

  const handleSend = useCallback(
    async (options?: ComposerPayload) => {
      // İki katmanlı kilit: `sendingRef` aynı olaydaki ikinci tıklamayı yakalar,
      // `isSubmitting` ise render'ı takip eden güvenlik ağıdır. Tek başına
      // state'e güvenmek, aynı olay içindeki ikinci tıklamayı geçirirdi.
      if (sendingRef.current || isSubmitting) return
      sendingRef.current = true
      setIsSubmitting(true)
      // Yeni gönderim başladı: önceki başarı/hazırlandı sayacı **önce** iptal
      // edilir, yoksa süren gönderimi `idle` durumuna çekerdi.
      clearFeedbackTimer()
      setSendFeedback('sending')
      setLastError(null)
      setIsResendSafe(true)
      setIsExpanded(false)
      setStoredExpanded(false)
      lastIntentRef.current = options
      try {
        const result = await onSend({
          noteText:
            options?.noteText !== undefined
              ? options.noteText
              : noteTextRef.current.trim() || undefined,
          autoSend:
            options?.autoSend !== undefined ? options.autoSend : effectiveAutoSendRef.current
        })
        const outcome = resolveSendOutcome(result)

        if (outcome.kind === 'busy') {
          // Eşzamanlı çağrı reddedildi: süren gönderimin durumunu bozma.
          setSendFeedback('sending')
          return
        }

        setIsResendSafe(outcome.resendSafe)

        if (outcome.feedback === 'incomplete') {
          // İş kısmen uygulandı. Otomatik tekrar YAPILMAZ: kullanıcı bilgilendirilir
          // ve güvenli manuel devam yolu (onayı kapatma) sunulur.
          clearFeedbackTimer()
          setSendFeedback('incomplete')
          const code = outcome.errorCode
          const key = code ? toErrorI18nKey(code) : 'unknown_error'
          const localized = t(key)
          setLastError(localized === key && code ? code : localized)
          setIsExpanded(true)
          setStoredExpanded(true)
        } else if (outcome.feedback === 'error') {
          clearFeedbackTimer()
          setSendFeedback('error')
          const code = outcome.errorCode
          const key = code ? toErrorI18nKey(code) : 'unknown_error'
          const localized = t(key)
          setLastError(localized === key && code ? code : localized)
          // Hata panelde görünür olmalı: dock kapalıyken yalnızca kısa bir rozet
          // kalır ve kullanıcı nedenini göremez.
          setIsExpanded(true)
          setStoredExpanded(true)
          scheduleFeedbackReset(FEEDBACK_TIMEOUT_MS.error)
        } else {
          // `idle` (teslim edildi / hazırlandı): sessiz. Durum **açıkça**
          // sıfırlanır — `sending`'de kalırsa "Gönderiliyor…" göstergesi sonsuza
          // dek ekranda kalır ve sonraki gönderimler kilitli görünür.
          clearFeedbackTimer()
          setSendFeedback('idle')
          setLastError(null)
        }
      } catch {
        // `onSend` bir istisna fırlattı: hedefe **hiç dokunulmadığının kanıtı
        // yok**. İstisna, iş kısmen uygulandıktan sonra da oluşabilir (kaynak
        // dönüşümü, kısmi yapıştırma, transcript yazımı…), dolayısıyla güvenli
        // varsayılamak yanlıştır: en kötü ihtimalde hedefte ikinci bir kopya.
        //
        // Bu yüzden sonuç `incomplete` olarak işaretlenir — kullanıcı
        // bilgilendirilir, otomatik tekrar kapalıdır ve veri elde etmek için
        // elle ilerleyebilir. Aynı belirsizlik `NO_SEND_RESULT`'ın taşıdığı
        // `stage: 'uncertain'` ile aynı yönde durur.
        clearFeedbackTimer()
        setSendFeedback('incomplete')
        setIsResendSafe(false)
        setLastError('unknown_error')
        setIsExpanded(true)
        setStoredExpanded(true)
      } finally {
        sendingRef.current = false
        setIsSubmitting(false)
      }
    },
    [
      clearFeedbackTimer,
      isSubmitting,
      onSend,
      scheduleFeedbackReset,
      setIsExpanded,
      setStoredExpanded,
      setIsSubmitting,
      t
    ]
  )

  /**
   * "Tekrar dene" — **düğmenin etiketiyle yaptığı eylem aynıdır.**
   *
   * Güvenle tekrarlanabilen hatalarda son gönderim niyetini yeniden yürütür.
   * İş kısmen uygulandıysa (`incomplete`) **yeniden göndermez**: bunun yerine
   * durumu dinlenir ve kullanıcıya güvenli manuel devam yolu (paneli açık
   * tutup siteye geçmek) bırakılır. `handleSend` zaten `incomplete` durumunda
   * "sending"e düşmez; burada da koruma var.
   */
  const handleRetry = useCallback(() => {
    if (sendingRef.current) return
    if (!isResendSafe || sendFeedback === 'incomplete') {
      clearFeedbackTimer()
      setSendFeedback('idle')
      setLastError(null)
      return
    }
    void handleSend(lastIntentRef.current)
  }, [clearFeedbackTimer, handleSend, isResendSafe, sendFeedback])

  /** Yalnızca görünüm durumunu sıfırlar — kuyruğa veya not alanına dokunmaz. */
  const dismissOutcome = useCallback(() => {
    clearFeedbackTimer()
    setSendFeedback('idle')
    setLastError(null)
  }, [clearFeedbackTimer])

  // Every composer affordance — the panel's send button and the collapsed
  // pill's send button — goes through `handleSend`. With auto-send off that
  // stages the content (paste the image, fill the prompt) and the user submits
  // on the site; there is no path that submits regardless, so a disabled setting
  // is never bypassed.
  return {
    sendFeedback,
    setSendFeedback,
    lastError,
    setLastError,
    isResendSafe,
    handleSend,
    handleRetry,
    dismissOutcome
  }
}
