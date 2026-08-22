import type { ApiChatMessage, ApiConfig } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { loadSessionsFromStorage, scheduleSaveSessions } from '../store/apiChatPersistence'
import {
  buildCombinedPrompt,
  buildErrorReply,
  type ChatSession,
  createEmptySession,
  getDefaultSessionTitle,
  isDefaultSessionTitle
} from '../store/apiChatSessionUtils'

export function loadSessions(): ChatSession[] {
  return loadSessionsFromStorage()
}

export function persistSessions(sessions: ChatSession[]): void {
  scheduleSaveSessions(sessions)
}

export function createNewSession(): ChatSession {
  return createEmptySession()
}

export function addMessageToSession(
  sessions: ChatSession[],
  sessionId: string,
  message: ApiChatMessage
): ChatSession[] {
  return sessions.map((session) => {
    if (session.id === sessionId) {
      let title = session.title
      if (isDefaultSessionTitle(session.title) && message.role === 'user') {
        // SECURITY: Use Array.from() instead of .slice() to safely handle
        // multi-byte Unicode characters (emojis, CJK, surrogate pairs).
        // String.prototype.slice() operates on UTF-16 code units and can
        // split a surrogate pair in half, producing garbled text (�).
        const chars = [...message.content]
        const safeTitle = chars.slice(0, 30).join('').trim()
        // SECURITY: If the message content is only whitespace (spaces, newlines,
        // zero-width characters) or empty, fall back to the default title.
        // Without this check, the sidebar would show a blank, unclickable title.
        title = (safeTitle || getDefaultSessionTitle()) + (chars.length > 30 ? '...' : '')
      }
      return {
        ...session,
        title,
        messages: [...session.messages, message],
        updatedAt: Date.now()
      }
    }
    return session
  })
}

export function removeMessageFromSession(
  sessions: ChatSession[],
  sessionId: string,
  messageId: string
): ChatSession[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? { ...s, messages: s.messages.filter((m) => m.id !== messageId), updatedAt: Date.now() }
      : s
  )
}

export function editMessageInSession(
  sessions: ChatSession[],
  sessionId: string,
  messageId: string,
  content: string
): ChatSession[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? {
          ...s,
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
          updatedAt: Date.now()
        }
      : s
  )
}

export function clearSessionMessages(sessions: ChatSession[], sessionId: string): ChatSession[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? { ...s, messages: [], title: getDefaultSessionTitle(), updatedAt: Date.now() }
      : s
  )
}

export function renameSession(
  sessions: ChatSession[],
  sessionId: string,
  title: string
): ChatSession[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? { ...s, title: title.trim() || getDefaultSessionTitle(), updatedAt: Date.now() }
      : s
  )
}

export function deleteSessionFromList(sessions: ChatSession[], sessionId: string): ChatSession[] {
  const filtered = sessions.filter((s) => s.id !== sessionId)
  return filtered.length === 0 ? [createEmptySession()] : filtered
}

export async function fetchApiChatModels(providerId: string): Promise<string[] | null> {
  const api = getElectronApi()
  if (!api) return null
  return api.fetchApiChatModels(providerId)
}

export async function getApiChatConfig(): Promise<ApiConfig | null> {
  const api = getElectronApi()
  if (!api) return null
  return api.getApiChatConfig()
}

/**
 * Error bubbles (buildErrorReply) are UI-only artifacts persisted with an
 * `-error` id suffix; they must never be forwarded to the provider as
 * assistant context.
 */
function isTranscriptMessage(message: ApiChatMessage): boolean {
  return !(message.role === 'assistant' && message.id.endsWith('-error'))
}

export async function sendApiChatRequest(
  messages: ApiChatMessage[],
  selectedModel?: string,
  generalPrompt?: string,
  providerId?: string,
  requestId?: string
): Promise<ApiChatMessage | null> {
  const api = getElectronApi()
  if (!api) return null
  return api.sendApiChatRequest(
    messages.filter(isTranscriptMessage),
    selectedModel,
    generalPrompt,
    providerId,
    requestId
  )
}

export { buildCombinedPrompt, buildErrorReply }
