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
