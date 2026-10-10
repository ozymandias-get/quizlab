import type { AiDraftItem } from '@app/providers/ai/types'

/**
 * Gönderim geri bildirimi.
 *
 * `staged` bilinçli olarak `success`'ten ayrıdır: içerik AI kutusuna hazırlandı
 * ama kullanıcı henüz göndermedi. Yeşil "Gönderildi" göstergesi burada bir
 * teslim iddiası olurdu; hazırlanmış mesaj gönderilmiş gibi raporlanmaz.
 */
export type SendFeedback = 'idle' | 'sending' | 'staged' | 'success' | 'error'

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
