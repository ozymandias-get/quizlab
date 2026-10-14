import type { ApiChatMessage } from '@shared-core/types'

import type { ChatSession } from '../store/apiChatSessionUtils'
import { generateId } from '../store/apiChatSessionUtils'

export function getUserMessage(text: string, imgs: string[], pid?: string): ApiChatMessage {
  return {
    id: generateId('msg') + '-user',
    role: 'user',
    content: text,
    timestamp: Date.now(),
    providerId: pid,
    images: imgs.length > 0 ? imgs : undefined
  }
}

/** Errors surfaced by the main process when a request is aborted (Stop button). */
export function isCancelledError(err: unknown): boolean {
  return (
    err instanceof Error &&
    ((err as unknown as Record<string, unknown>).code === 'cancelled' ||
      /cancelled/i.test(err.message))
  )
}

export function getMessagesFromSessions(
  sessions: ChatSession[],
  sessionId: string
): ApiChatMessage[] {
  const session = sessions.find((s) => s.id === sessionId)
  return session?.messages || []
}

export interface SendMessageParams {
  tabId: string
  text: string
  images: string[]
  model?: string
  providerId?: string
  generalPrompt?: string
  memoryPrompt?: string
  characterPrompt?: string
}

/**
 * Outcome of an api-chat send. Writing an error bubble into the transcript
 * (`errorReply`) is NOT a success: callers must branch on `success`.
 *
 * ## `transcriptWritten`
 *
 * Kullanıcı mesajının oturuma **yazılıp yazılmadığı**. Bu alan teslim
 * belirsizliğinin tek kanıtıdır: `true` iken hedefte kullanıcının mesajı
 * duruyordur ve aynı içeriği otomatik tekrar etmek transcript'te **ikinci bir
 * kullanıcı mesajı** üretir.
 *
 * `errorReply`'ın varlığı tek başına yeterli değildir: istek başlatıldıktan
 * sonra iptal edilen bir gönderimde hata balonu yazılmaz, ama kullanıcı mesajı
 * yine de transcript'tedir. Aynı şekilde transcript'e yazıldıktan sonra oluşan
 * **beklenmedik** bir hata (depo temizliği, kalıcı yazma, prompt birleştirme)
 * ne hata balonu ne de `cancelled` üretir — yalnızca bu bayrak o an "hedefe
 * dokunuldu" gerçeğini korur.
 */
export type SendApiChatResult =
  | {
      success: true
      reply: ApiChatMessage
      sessionId: string
    }
  | {
      success: false
      error: string
      errorReply?: ApiChatMessage
      /** True when the send was cancelled by the user (no error bubble written). */
      cancelled?: boolean
      /**
       * Kullanıcı mesajı oturuma yazıldı mı? `undefined`/`false` → teslim
       * belirsizliği **kanıtlanamaz**, güvenli tekrar açıktır; `true` →
       * transcript'te mesaj duruyor, tekrar mükerrer mesaj üretir.
       */
      transcriptWritten?: boolean
      sessionId: string
    }

export interface RegenerateParams {
  tabId: string
  messages: ApiChatMessage[]
  model?: string
  providerId?: string
  generalPrompt?: string
  memoryPrompt?: string
  characterPrompt?: string
}

export interface EditAndRegenerateParams extends RegenerateParams {
  messageId: string
  newContent: string
}
