import type { ApiChatMessage } from '@shared-core/types'

import { ensureErrorMessage } from '@shared/lib/errorUtils'

import i18next from 'i18next'

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

export const DEFAULT_SESSION_TITLE = 'New Chat'

export function getDefaultSessionTitle(): string {
  try {
    const v = i18next.t('api_chat_new_chat')
    if (v && v !== 'api_chat_new_chat') return v
  } catch {
    // ignore and fall back
  }
  return 'New Chat'
}

export function isDefaultSessionTitle(title: string): boolean {
  if (title === DEFAULT_SESSION_TITLE) return true
  if (title === 'New Chat' || title === 'Yeni Sohbet') return true
  try {
    const cur = i18next.t('api_chat_new_chat')
    if (title === cur) return true
    const enBundle = i18next.getResourceBundle('en', 'translation') as
      | Record<string, string>
      | undefined
    const trBundle = i18next.getResourceBundle('tr', 'translation') as
      | Record<string, string>
      | undefined
    if (enBundle?.['api_chat_new_chat'] === title) return true
    if (trBundle?.['api_chat_new_chat'] === title) return true
  } catch {
    // ignore
  }
  return false
}

export function createEmptySession(): ChatSession {
  const now = Date.now()
  return {
    id: generateId('session'),
    title: getDefaultSessionTitle(),
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
  let fallbackMsg = 'Unknown error'
  try {
    const v = i18next.t('error_unknown_error')
    if (v && v !== 'error_unknown_error') fallbackMsg = v
  } catch {
    // ignore and keep the generic fallback
  }
  const message = ensureErrorMessage(err, fallbackMsg)
  let content: string
  try {
    content = i18next.t('api_chat_send_error', { error: message })
    if (!content || content === 'api_chat_send_error') throw new Error('missing key')
  } catch {
    let prefix = 'Error'
    try {
      const v = i18next.t('toast_error_title')
      if (v && v !== 'toast_error_title') prefix = v
    } catch {
      // ignore and keep the generic prefix
    }
    content = `${prefix}: ${message}`
  }
  return {
    id: generateId('msg') + '-error',
    role: 'assistant',
    content,
    timestamp: Date.now()
  }
}
