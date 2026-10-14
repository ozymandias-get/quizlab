import type { SendFeedback } from './types'

/**
 * Gönderim düğmesinin ne dediği — tek kaynak.
 *
 * Panelin içindeki düğme ve hap üzerindeki düğme aynı anda aynı şeyi
 * söylemek zorunda; ikisi ayrı ayrı karar verirse biri "Gönderildi" derken
 * diğeri hâlâ "Hazırla" der ve kullanıcı hangisinin doğru olduğunu ayırt
 * edemez.
 *
 * Ayrıca anlatım dürüst kalır:
 *  - auto-send kapalıyken düğme "hazırla" der, "Gönderildi" gibi bir teslim
 *    iddiasında bulunmaz;
 *  - gönderim kısmen uygulandıysa düğme "Tekrar gönder" **demez**; içerik zaten
 *    hedefe ulaşmış durumdadır ve aynı içeriği tekrar göndermek hedefte ikinci
 *    bir kopya bırakırdı. Bu durumda düğme "Sitede gönderin" der ve etkin
 *    değildir — kullanıcının gerçek yapacağı eylem budur.
 */
export type DraftSendIntent = 'sending' | 'retry' | 'send' | 'prepare' | 'awaiting'

/** `intent` → i18n anahtarı. Bileşenler `t()` çağrısını kendisi yapar. */
export const DRAFT_SEND_INTENT_KEYS: Record<DraftSendIntent, string> = {
  sending: 'sending_to_ai',
  retry: 'ai_send_retry_send',
  send: 'send_to_ai',
  prepare: 'ai_send_prepare',
  awaiting: 'ai_send_awaiting_submit'
}

interface DraftSendIntentInput {
  /** Auto-send açık mı; kapalıyken düğme yalnızca hazırlar. */
  autoSend: boolean
  feedback: SendFeedback
  isSubmitting: boolean
}

export function resolveDraftSendIntent({
  autoSend,
  feedback,
  isSubmitting
}: DraftSendIntentInput): DraftSendIntent {
  if (feedback === 'sending' || isSubmitting) return 'sending'
  // Kısmen uygulanmış gönderim: "tekrar gönder" hem yanlış hem tehlikeli.
  if (feedback === 'incomplete') return 'awaiting'
  if (feedback === 'error') return 'retry'
  return autoSend ? 'send' : 'prepare'
}

/** `awaiting` durumunda düğme güvenle bir eylem yapamaz; devre dışıdır. */
export function isDraftSendIntentActionable(intent: DraftSendIntent): boolean {
  return intent !== 'awaiting'
}
