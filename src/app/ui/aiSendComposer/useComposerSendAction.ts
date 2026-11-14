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
  /**
   * A real success — delivered or staged — and nothing else. Failures,
   * uncertainty and a concurrent-send rejection keep the draft note, because it
   * is still the user's only copy of what they asked for.
   */
  onSendSucceeded?: () => void
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
 * hata olarak gösterilmez. Bu composer'da gerçekten süren bir iş yoksa (varsa
 * `sendingRef` çağrıyı zaten reddederdi) durum `idle`a döner: sonsuz bir
 * yükleme göstergesi bırakmak, hiç başlamamış bir işi sürüyor gibi gösterirdi.
 */
export function useComposerSendAction({
  isSubmitting,
  setIsSubmitting,
  onSend,
  noteText,
  effectiveAutoSend,
  setIsExpanded,
  setStoredExpanded,
  onSendSucceeded
}: UseComposerSendActionOptions) {
  const { t } = useTranslation()
  const [sendFeedback, setSendFeedback] = useState<SendFeedback>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  /** Son hatanın yeniden denenip denemeyeceği — "Tekrar dene" eyleminin sözleşmesi. */
  const [isResendSafe, setIsResendSafe] = useState(true)
  /**
   * Sonuç bildiriminin görünürlüğü. **Gönderim güvenliğinden ayrıdır**: kısmi
   * teslimatta kullanıcı bildirimi kapatabilir, ama `sendFeedback` 'incomplete'
   * kalır ve gönderim düğmesi 'awaiting' olarak devre dışı kalır. Böylece
   * "bildirimi gizle" ile "yeniden gönderebilirim" birbirine karışmaz.
   */
  const [isOutcomeDismissed, setIsOutcomeDismissed] = useState(false)

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
  /**
   * Kısmi teslimat kilidi **yalnızca UI'da** değil, gönderim fonksiyonunun
   * kendisinde de uygulanır. Enter/Ctrl+Enter/programatik çağrı aynı kapıdan
   * geçtiği için disabled düğme atlatılamaz.
   */
  const sendFeedbackRef = useRef(sendFeedback)
  sendFeedbackRef.current = sendFeedback

  /**
   * Gönderim — `options` verilmezse güncel not ve auto-send kullanılır.
   * Açık panel, kapalı hap ve "tekrar dene" aynı yoldan geçer.
   */
  const handleSend = useCallback(
    async (options?: ComposerPayload) => {
      // İki katmanlı kilit: `sendingRef` aynı olaydaki ikinci tıklamayı yakalar,
      // `isSubmitting` ise render'ı takip eden güvenlik ağıdır. Tek başına
      // state'e güvenmek, aynı olay içindeki ikinci tıklamayı geçirirdi.
      if (sendingRef.current || isSubmitting) return
      // Kısmi teslimat: düğme disabled olsa da Enter/programatik çağrı
      // gelebilir. Gönderim fonksiyonu kendisi reddeder.
      if (sendFeedbackRef.current === 'incomplete') return
      sendingRef.current = true
      setIsSubmitting(true)
      // Yeni gönderim başladı: önceki başarı/hazırlandı sayacı **önce** iptal
      // edilir, yoksa süren gönderimi `idle` durumuna çekerdi.
      clearFeedbackTimer()
      setSendFeedback('sending')
      setLastError(null)
      setIsResendSafe(true)
      setIsOutcomeDismissed(false)
      setIsExpanded(false)
      setStoredExpanded(false)
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
          // Eşzamanlı çağrı reddedildi. Bu composer'da gerçekten süren bir
          // gönderim yok (varsa `sendingRef` yukarıda reddederdi); bu yüzden
          // 'sending' durumunda kalmak sonsuz bir yükleme göstergesi bırakırdı.
          // Hata da gösterme: istek hiç başlamadı.
          clearFeedbackTimer()
          setSendFeedback('idle')
          setLastError(null)
          return
        }

        setIsResendSafe(outcome.resendSafe)

        if (outcome.feedback === 'incomplete') {
          // İş kısmen uygulandı. Otomatik tekrar YAPILMAZ: kullanıcı bilgilendirilir
          // ve güvenli manuel devam yolu (onayı kapatma) sunulur.
          clearFeedbackTimer()
          setSendFeedback('incomplete')
          setIsOutcomeDismissed(false)
          const code = outcome.errorCode
          const key = code ? toErrorI18nKey(code) : 'unknown_error'
          const localized = t(key)
          setLastError(localized === key && code ? code : localized)
          setIsExpanded(true)
          setStoredExpanded(true)
        } else if (outcome.feedback === 'error') {
          clearFeedbackTimer()
          setSendFeedback('error')
          setIsOutcomeDismissed(false)
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
          setIsOutcomeDismissed(false)
          // Ek not, tarif ettiği içerikle birlikte composer'dan çıktı. Burada
          // bırakmak, bir sonraki taslağa ait olmayan bir talimatı devraldırırdı.
          onSendSucceeded?.()
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
        setIsOutcomeDismissed(false)
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
      onSendSucceeded,
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
   * Güvenle tekrarlanabilen hatalarda çağıranın verdiği güncel taslak
   * yükünü (`options`) yeniden gönderir; verilmezse hook'un bildiği güncel not
   * ve auto-send kullanılır. Eski, saklanmış bir payload yeniden yürütülmez:
   * kullanıcı notu/talimatı değiştirdiyse düğme ekranda gördüğünü gönderir.
   * `incomplete` durumunda ise **yeniden göndermez**.
   */
  const handleRetry = useCallback(
    (options?: ComposerPayload) => {
      if (sendingRef.current) return
      if (!isResendSafe || sendFeedback === 'incomplete') {
        // Güvenli tekrar yok: bildirim gizlenebilir, ama gönderim kilidi kalır.
        clearFeedbackTimer()
        setIsOutcomeDismissed(true)
        return
      }
      void handleSend(options)
    },
    [clearFeedbackTimer, handleSend, isResendSafe, sendFeedback]
  )

  /**
   * Bildirimi gizler — **güvenlik durumunu sıfırlamaz.**
   *
   * Kısmi teslimatta `sendFeedback` 'incomplete' olarak kalır; böylece iki
   * gönder düğmesi de 'awaiting' (devre dışı) kalır ve kullanıcı bildirimi
   * kapattı diye aynı içeriği yanlışlıkla ikinci kez gönderemez. Hata
   * bildirimi güvenle tekrarlanabilir olduğu için normal şekilde temizlenir.
   */
  const dismissOutcome = useCallback(() => {
    clearFeedbackTimer()
    setIsOutcomeDismissed(true)
    if (sendFeedback !== 'incomplete') {
      setSendFeedback('idle')
      setLastError(null)
    }
  }, [clearFeedbackTimer, sendFeedback])

  /**
   * Taslak sıfırlandığında (tümünü temizle veya kuyruk boşaldı) güvenlik
   * kilidini de bırakır: yeniden gönderilecek bir içerik kalmamıştır.
   */
  const resetOutcome = useCallback(() => {
    clearFeedbackTimer()
    setSendFeedback('idle')
    setLastError(null)
    setIsOutcomeDismissed(false)
    setIsResendSafe(true)
  }, [clearFeedbackTimer])

  /**
   * Daha önce kısmen gönderilmiş bir öğe "geri al" ile kuyruğa dönerse
   * gönderim yeniden kilitlenir: yeni içerik gönderilebilir kalır, eski
   * içerik kazara ikinci kez gönderilemez.
   */
  const relockOutcome = useCallback(() => {
    clearFeedbackTimer()
    setSendFeedback('incomplete')
    setIsResendSafe(false)
    setIsOutcomeDismissed(false)
    // Kullanıcı neden gönderemediğini görmeli: bu bir gönderim hatası değil,
    // daha önce kısmen gönderilmiş içeriğin ikinci kez gönderilmemesidir.
    setLastError(t('ai_send_relock_notice'))
  }, [clearFeedbackTimer, t])

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
    isOutcomeDismissed,
    handleSend,
    handleRetry,
    dismissOutcome,
    resetOutcome,
    relockOutcome
  }
}
