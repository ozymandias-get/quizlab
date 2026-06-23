import type { ApiChatMessage } from '@shared-core/types'

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export interface ChatSession {
  id: string
  title: string
  messages: ApiChatMessage[]
  createdAt: number
  updatedAt: number
}

export const DEFAULT_SESSION_TITLE = 'Yeni Sohbet'

export function createEmptySession(): ChatSession {
  const now = Date.now()
  return {
    id: generateId('session'),
    title: DEFAULT_SESSION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

export function buildCombinedPrompt(parts: {
  memoryPrompt: string
  characterPrompt: string
  generalPrompt: string
}): string {
  return [
    parts.memoryPrompt && `[User Info]\n${parts.memoryPrompt}`,
    parts.characterPrompt && `[Character]\n${parts.characterPrompt}`,
    parts.generalPrompt && `[System]\n${parts.generalPrompt}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildErrorReply(err: unknown): ApiChatMessage {
  const message = err instanceof Error ? err.message : 'İstek başarısız oldu'
  return {
    id: generateId('msg') + '-error',
    role: 'assistant',
    content: `Hata: ${message}`,
    timestamp: Date.now()
  }
}
