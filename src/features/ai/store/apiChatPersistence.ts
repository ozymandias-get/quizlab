import { Logger } from '@shared/lib/logger'

import type { ChatSession } from './apiChatSessionUtils'

export const LOCAL_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'
const SESSION_SAVE_DEBOUNCE_MS = 300

function isChatSession(value: unknown): value is ChatSession {
  if (typeof value !== 'object' || value === null) return false
  const session = value as Record<string, unknown>
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    Array.isArray(session.messages) &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number'
  )
}

export function loadSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!data) return []
    const parsed: unknown = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isChatSession)
  } catch (e) {
    Logger.error('[ChatPersistence] Failed to load api chat sessions', e)
    return []
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    Logger.error('[ChatPersistence] Failed to save api chat sessions', e)
  }
}

let pendingSaveSessions: ChatSession[] | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSaveSessions(sessions: ChatSession[]) {
  pendingSaveSessions = sessions
  if (saveTimer !== null) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingSaveSessions !== null) {
      saveSessionsToStorage(pendingSaveSessions)
      pendingSaveSessions = null
    }
  }, SESSION_SAVE_DEBOUNCE_MS)
}
