/**
 * Tests for sessions.api — pure functions for AI Chat session/message operations.
 *
 * These pure functions were previously tested indirectly through the legacy
 * apiChatStore. Now they are tested directly.
 *
 * @see @features/ai/api/sessions.api
 */

import type { ApiChatMessage } from '@shared-core/types'

import {
  addMessageToSession,
  clearSessionMessages,
  createNewSession,
  deleteSessionFromList,
  editMessageInSession,
  removeMessageFromSession,
  renameSession
} from '@features/ai/api/sessions.api'
import type { ChatSession } from '@features/ai/store/apiChatSessionUtils'

import { describe, expect, it } from 'vitest'

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session-1',
    title: 'Test Session',
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function makeMessage(overrides: Partial<ApiChatMessage> = {}): ApiChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: 0,
    ...overrides
  }
}

describe('createNewSession', () => {
  it('creates a session with Yeni Sohbet title', () => {
    const session = createNewSession()
    expect(session.title).toBe('Yeni Sohbet')
    expect(session.messages).toEqual([])
    expect(session.id).toBeTruthy()
    expect(session.createdAt).toBeGreaterThan(0)
    expect(session.updatedAt).toBeGreaterThan(0)
  })
})

describe('addMessageToSession', () => {
  it('adds a message to the session', () => {
    const sessions = [makeSession()]
    const msg = makeMessage()
    const result = addMessageToSession(sessions, 'session-1', msg)

    expect(result[0].messages).toHaveLength(1)
    expect(result[0].messages[0].content).toBe('Hello')
  })

  it('auto-generates title from first user message (truncated at 30 chars)', () => {
    const sessions = [makeSession({ title: 'Yeni Sohbet' })]
    const longContent = 'This is a very long message that should generate a title truncation'
    const msg = makeMessage({ content: longContent })

    const result = addMessageToSession(sessions, 'session-1', msg)
    expect(result[0].title).toBe(longContent.slice(0, 30).trim() + '...')
  })

  it('does not truncate short messages', () => {
    const sessions = [makeSession({ title: 'Yeni Sohbet' })]
    const msg = makeMessage({ content: 'Short' })

    const result = addMessageToSession(sessions, 'session-1', msg)
    expect(result[0].title).toBe('Short')
  })

  it('does not change title for assistant messages', () => {
    const sessions = [makeSession({ title: 'Yeni Sohbet' })]
    const msg = makeMessage({ role: 'assistant', content: 'Hello user' })

    const result = addMessageToSession(sessions, 'session-1', msg)
    expect(result[0].title).toBe('Yeni Sohbet')
  })
})

describe('removeMessageFromSession', () => {
  it('removes a message by id', () => {
    const sessions = [
      makeSession({
        messages: [makeMessage({ id: 'm1' }), makeMessage({ id: 'm2', content: 'Keep me' })]
      })
    ]

    const result = removeMessageFromSession(sessions, 'session-1', 'm1')
    expect(result[0].messages).toHaveLength(1)
    expect(result[0].messages[0].id).toBe('m2')
  })
})

describe('editMessageInSession', () => {
  it('edits a message content by id', () => {
    const sessions = [
      makeSession({
        messages: [makeMessage({ id: 'm1', content: 'Original' })]
      })
    ]

    const result = editMessageInSession(sessions, 'session-1', 'm1', 'Edited')
    expect(result[0].messages[0].content).toBe('Edited')
  })
})

describe('clearSessionMessages', () => {
  it('removes all messages and resets title to Yeni Sohbet', () => {
    const sessions = [
      makeSession({
        title: 'Custom Title',
        messages: [makeMessage(), makeMessage({ id: 'm2', role: 'assistant' })]
      })
    ]

    const result = clearSessionMessages(sessions, 'session-1')
    expect(result[0].messages).toEqual([])
    expect(result[0].title).toBe('Yeni Sohbet')
  })
})

describe('renameSession', () => {
  it('renames a session', () => {
    const sessions = [makeSession({ title: 'Old Title' })]
    const result = renameSession(sessions, 'session-1', 'New Title')
    expect(result[0].title).toBe('New Title')
  })

  it('defaults to Yeni Sohbet for empty title', () => {
    const sessions = [makeSession({ title: 'Old Title' })]
    const result = renameSession(sessions, 'session-1', '')
    expect(result[0].title).toBe('Yeni Sohbet')
  })
})

describe('deleteSessionFromList', () => {
  it('removes a session by id', () => {
    const sessions = [makeSession({ id: 's1' }), makeSession({ id: 's2' })]
    const result = deleteSessionFromList(sessions, 's1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s2')
  })

  it('creates an empty session when the last one is removed', () => {
    const sessions = [makeSession({ id: 's1' })]
    const result = deleteSessionFromList(sessions, 's1')
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Yeni Sohbet')
  })
})
