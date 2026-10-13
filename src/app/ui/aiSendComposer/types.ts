import type { AiDraftItem } from '@app/providers/ai/types'

/**
 * Gönderim geri bildirimi.
 *
 * Durumlar bilinçli olarak ayrıdır:
 *  - `incomplete` — işlem **kısmen** uygulandı (içerik hedefe ulaştı, sonraki
 *    adım başarısız oldu). Otomatik tekrar güvenli olmadığı için ayrı tutulur;
 *    `error` içine sıkıştırılırsa ya mükerrer mesaj üretir ya da
 *    gerçekleşmemiş bir teslimi başarı diye gösterir.
 *
 * ## Başarı burada yok
 *
 * `success` ve `staged` bilinçli olarak **kaldırıldı**: teslim edilen ya da
 * hazırlanan içerik sessizdir. Kullanıcı sonucu zaten görür — site kutusunda
 * mesajı, taslakta kalan öğeleri ya da boşalan sayacı. `incomplete` ise bir
 * başarı değil, **belirsizliktir**: içerik hedefe ulaşmış olabilir ve tekrar
 * göndermek mükerrer mesaj bırakır, bu yüzden söylenmeye devam eder.
 */
export type SendFeedback = 'idle' | 'sending' | 'incomplete' | 'error'

export interface ComposerPayload {
  noteText?: string
  autoSend?: boolean
}

export interface AiSendComposerProps {
  items: AiDraftItem[]
  onClearAll: () => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
  autoSend?: boolean
  onToggleAutoSend?: () => void
}
