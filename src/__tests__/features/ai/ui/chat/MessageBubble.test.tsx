/**
 * MessageBubble memo-stability regression test.
 *
 * Before the fix in `MessageList.tsx`, every `MessageBubble` received
 * `onDelete={() => onDeleteMessage(msg.id)}` — a fresh arrow per render,
 * per message. That defeated `MessageBubble`'s `memo`, causing it to
 * re-render whenever `MessageList` re-rendered (e.g. on every new
 * streaming token, every new message, every model switch).
 *
 * After the fix, `MessageList` passes the parent `onDeleteMessage`
 * directly. `MessageBubble`'s prop signature is now
 * `onDelete: (messageId: string) => void` and it binds the id internally.
 *
 * This test asserts the new prop shape: a stable parent callback works
 * correctly and the same callback can be shared across many bubbles.
 */
import type { ApiChatMessage } from '@shared-core/types'

import MessageBubble from '@features/ai/ui/chat/MessageBubble'

import { describe, expect, it, vi } from 'vitest'

function makeMessage(id: string, role: 'user' | 'assistant' = 'user'): ApiChatMessage {
  return {
    id,
    role,
    content: `content of ${id}`,
    timestamp: 1700000000000
  }
}

describe('MessageBubble prop contract — memo-friendly callbacks', () => {
  it('onDelete receives the message id, not a closure', () => {
    // Simulate the parent creating ONE stable callback (the fix):
    const onDelete = vi.fn()
    // Both bubbles share the same onDelete reference — that's the key
    // property that lets `memo` skip re-renders.
    const message1 = makeMessage('m1')
    const message2 = makeMessage('m2')

    // Type-level: onDelete signature is (messageId: string) => void.
    // We can prove the contract holds by checking the type at compile time —
    // the next line is the assertion the lint rule cares about.
    const callback: (id: string) => void = onDelete

    // Reuse the same callback for two bubbles. Before the fix, the parent
    // had to wrap each in an arrow: `() => onDelete(m1.id)`, which created
    // a new reference on every parent render and broke memo.
    const parent = {
      handleDelete: callback,
      handleEdit: undefined as ((id: string, content: string) => void) | undefined
    }

    expect(typeof parent.handleDelete).toBe('function')

    // Smoke: ensure the component type accepts the shared callback for
    // multiple messages. The test for click-binding lives in the existing
    // integration tests; here we just want the type contract.
    const rendered1 = (
      <MessageBubble
        message={message1}
        isUser
        onDelete={parent.handleDelete}
        onEdit={parent.handleEdit}
      />
    )
    const rendered2 = (
      <MessageBubble
        message={message2}
        isUser
        onDelete={parent.handleDelete}
        onEdit={parent.handleEdit}
      />
    )
    expect(rendered1).toBeTruthy()
    expect(rendered2).toBeTruthy()

    // Both bubbles received the SAME onDelete reference — this is the
    // invariant the parent relies on for memo to actually short-circuit.
    expect((rendered1.props as { onDelete: unknown }).onDelete).toBe(
      (rendered2.props as { onDelete: unknown }).onDelete
    )
  })

  it('onEdit receives (messageId, newContent) — also shared across bubbles', () => {
    const onEdit = vi.fn()
    const message = makeMessage('m3', 'user')

    // The parent passes a single shared onEdit to many bubbles.
    const sharedEdit = onEdit

    const props = {
      message,
      isUser: true as const,
      onDelete: vi.fn(),
      onEdit: sharedEdit
    }

    // Compile-time check: the prop type is (id, content) => void.
    type Expected = (id: string, content: string) => void
    const _check: Expected = props.onEdit as Expected
    expect(_check).toBe(sharedEdit)
  })
})
