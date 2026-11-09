/**
 * The chat list groups messages once per update. Streaming replaces only the
 * last message object, so the incremental path must produce exactly the same
 * groups as a full walk while reusing the history before that message.
 */
import type { ApiChatMessage } from '@shared-core/types'

import { groupMessages, groupMessagesIncremental } from '@features/ai/ui/chat/chatUtils'

import { describe, expect, it } from 'vitest'

function message(
  id: string,
  role: ApiChatMessage['role'],
  content: string,
  timestamp: number
): ApiChatMessage {
  return { id, role, content, timestamp } as ApiChatMessage
}

const T0 = Date.UTC(2025, 0, 1, 10)

function baseMessages(): ApiChatMessage[] {
  return [
    message('u1', 'user', 'hi', T0),
    message('a1', 'assistant', 'hello', T0 + 60_000),
    message('u2', 'user', 'question', T0 + 120_000),
    message('a2', 'assistant', 'old answer', T0 + 180_000)
  ]
}

function withLastContent(messages: ApiChatMessage[], content: string): ApiChatMessage[] {
  return [...messages.slice(0, -1), { ...messages[messages.length - 1], content }]
}

describe('groupMessagesIncremental', () => {
  it('matches the full walk when there is no previous result', () => {
    const messages = baseMessages()
    expect(groupMessagesIncremental(null, messages)).toEqual(groupMessages(messages))
  })

  it('returns the same result for the same array reference', () => {
    const messages = baseMessages()
    const result = groupMessages(messages)
    expect(groupMessagesIncremental({ messages, result }, messages)).toBe(result)
  })

  it('reuses the history when only the last message content changed', () => {
    const previousMessages = baseMessages()
    const previous = { messages: previousMessages, result: groupMessages(previousMessages) }
    const streamed = withLastContent(previousMessages, 'streaming answer')

    const result = groupMessagesIncremental(previous, streamed)

    // Same grouping as a full walk…
    expect(result.groups).toEqual(groupMessages(streamed).groups)
    // …with the new tail object, not the cached one.
    const lastGroup = result.groups[result.groups.length - 1]
    if (lastGroup.kind !== 'messages') throw new Error('expected a message group')
    expect(lastGroup.messages[lastGroup.messages.length - 1]).toBe(streamed[streamed.length - 1])
    // History before the changed message is shared, so it was not re-walked.
    expect(result.groups[2]).toBe(previous.result.groups[2])
  })

  it('updates lastAssistantId when the streamed message is the assistant tail', () => {
    const previousMessages = baseMessages()
    const previous = { messages: previousMessages, result: groupMessages(previousMessages) }
    const streamed = withLastContent(previousMessages, 'streaming answer')

    expect(groupMessagesIncremental(previous, streamed).lastAssistantId).toBe('a2')
  })

  it('falls back to the full walk when the tail role changes', () => {
    const previousMessages = baseMessages()
    const previous = { messages: previousMessages, result: groupMessages(previousMessages) }
    const changed = [
      ...previousMessages.slice(0, -1),
      { ...previousMessages[previousMessages.length - 1], role: 'user' as const }
    ]

    expect(groupMessagesIncremental(previous, changed)).toEqual(groupMessages(changed))
  })

  it('falls back to the full walk when a message is appended', () => {
    const previousMessages = baseMessages()
    const previous = { messages: previousMessages, result: groupMessages(previousMessages) }
    const appended = [...previousMessages, message('u3', 'user', 'next', T0 + 240_000)]

    expect(groupMessagesIncremental(previous, appended)).toEqual(groupMessages(appended))
  })

  it('falls back to the full walk when a message is removed', () => {
    const previousMessages = baseMessages()
    const previous = { messages: previousMessages, result: groupMessages(previousMessages) }
    const removed = previousMessages.slice(0, -1)

    expect(groupMessagesIncremental(previous, removed)).toEqual(groupMessages(removed))
  })
})
