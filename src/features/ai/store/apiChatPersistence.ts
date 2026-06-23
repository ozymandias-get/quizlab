import { Logger } from '@shared/lib/logger'

import type { ChatSession } from './apiChatSessionUtils'

export const LOCAL_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'
const SESSION_SAVE_DEBOUNCE_MS = 300

export function loadSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    return data ? JSON.parse(data) : []
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
