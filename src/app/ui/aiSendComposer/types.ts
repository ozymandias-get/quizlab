import type { AiDraftItem } from '@app/providers/ai/types'

/**
 * Gönderim geri bildirimi.
 *
 * Durumlar bilinçli olarak ayrıdır:
 *  - `staged` — içerik AI kutusuna hazırlandı ama kullanıcı henüz göndermedi.
 *    Yeşil "Gönderildi" göstergesi burada bir teslim iddiası olurdu.
 *  - `incomplete` — işlem **kısmen** uygulandı (içerik hedefe ulaştı, sonraki
 *    adım başarısız oldu). Otomatik tekrar güvenli olmadığı için ayrı tutulur;
 *    `success` ya da `error` içine sıkıştırılırsa ya mükerrer mesaj üretir ya da
 *    gerçekleşmemiş bir teslimi başarı diye gösterir.
 */
export type SendFeedback = 'idle' | 'sending' | 'staged' | 'success' | 'incomplete' | 'error'

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
