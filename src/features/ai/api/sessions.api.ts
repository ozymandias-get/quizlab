import type { ApiChatMessage, ApiConfig } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import { loadSessionsFromStorage, scheduleSaveSessions } from '../store/apiChatPersistence'
import {
  buildCombinedPrompt,
  buildErrorReply,
  type ChatSession,
  createEmptySession,
  DEFAULT_SESSION_TITLE
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
      if (session.title === DEFAULT_SESSION_TITLE && message.role === 'user') {
        // SECURITY: Use Array.from() instead of .slice() to safely handle
        // multi-byte Unicode characters (emojis, CJK, surrogate pairs).
        // String.prototype.slice() operates on UTF-16 code units and can
        // split a surrogate pair in half, producing garbled text (�).
        const chars = [...message.content]
        const safeTitle = chars.slice(0, 30).join('').trim()
        // SECURITY: If the message content is only whitespace (spaces, newlines,
        // zero-width characters) or empty, fall back to the default title.
        // Without this check, the sidebar would show a blank, unclickable title.
        title = (safeTitle || DEFAULT_SESSION_TITLE) + (chars.length > 30 ? '...' : '')
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
      ? { ...s, messages: [], title: DEFAULT_SESSION_TITLE, updatedAt: Date.now() }
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
      ? { ...s, title: title.trim() || DEFAULT_SESSION_TITLE, updatedAt: Date.now() }
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

export async function sendApiChatRequest(
  messages: ApiChatMessage[],
  selectedModel?: string,
  generalPrompt?: string,
  providerId?: string
): Promise<ApiChatMessage | null> {
  const api = getElectronApi()
  if (!api) return null
  return api.sendApiChatRequest(messages, selectedModel, generalPrompt, providerId)
}

export { buildCombinedPrompt, buildErrorReply }
