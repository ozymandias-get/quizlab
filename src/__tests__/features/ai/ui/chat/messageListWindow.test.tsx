/**
 * Chat transcript windowing: offsets, the visible window, and the component
 * actually rendering a bounded slice of a long history.
 */
import type { ApiChatMessage } from '@shared-core/types'

import MessageList from '@features/ai/ui/chat/MessageList'
import {
  buildMessageRows,
  buildRowOffsets,
  findMessageWindow
} from '@features/ai/ui/chat/messageListWindow'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@features/ai/ui/chat/MessageBubble', () => ({
  default: ({ message }: { message: { content: string } }) => <div>{message.content}</div>
}))
vi.mock('@features/ai/ui/chat/DateSeparator', () => ({
  default: () => <div data-testid="date-separator" />
}))
vi.mock('@features/ai/ui/chat/Avatars', () => ({
  AiAvatar: () => null,
  UserAvatar: () => null
}))
vi.mock('@features/ai/ui/chat/ScrollToBottom', () => ({ default: () => null }))
vi.mock('@features/ai/ui/chat/StreamingIndicator', () => ({ default: () => null }))

const T0 = Date.UTC(2025, 0, 1, 10)

function message(index: number): ApiChatMessage {
  return {
    id: `m${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `msg-${index}`,
    timestamp: T0 + index * 1000
  } as ApiChatMessage
}

function messages(count: number): ApiChatMessage[] {
  return Array.from({ length: count }, (_, index) => message(index))
}

/** One run of same-role messages: the grouping puts them in a single group. */
function sameRoleMessages(count: number): ApiChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    ...message(index),
    role: 'assistant'
  }))
}

function renderList(options: { count: number; isScrolledUp: boolean; sameRole?: boolean }) {
  const containerRef = { current: null as HTMLDivElement | null }
  const endRef = { current: null as HTMLDivElement | null }
  const view = render(
    <MessageList
      messages={options.sameRole ? sameRoleMessages(options.count) : messages(options.count)}
      isStreaming={false}
      isScrolledUp={options.isScrolledUp}
      onScrollToBottom={vi.fn()}
      onDeleteMessage={vi.fn()}
      containerRef={containerRef}
      endRef={endRef}
    />
  )
  return { ...view, containerRef }
}

describe('message list window math', () => {
  it('uses measured heights and falls back to the estimate', () => {
    const rows = buildMessageRows([
      { kind: 'date', timestamp: T0 },
      { kind: 'messages', messages: [message(1)] },
      { kind: 'messages', messages: [message(2)] }
    ])
    const heights = new Map([
      [rows[0].key, 10],
      [rows[1].key, 100]
    ])

    expect(buildRowOffsets(rows, heights)).toEqual([0, 10, 110, 110 + rows[2].estimatedHeight])
  })

  it('renders a bounded window around the scroll position', () => {
    const rows = buildMessageRows(
      Array.from({ length: 200 }, (_, index) => ({
        kind: 'messages' as const,
        messages: [message(index)]
      }))
    )
    const offsets = buildRowOffsets(rows, new Map())

    const { start, end } = findMessageWindow(offsets, rows.length, 0, 600, false)

    expect(start).toBe(0)
    expect(end - start).toBeLessThan(40)
    expect(end).toBeLessThan(rows.length)
  })

  it('windows from the tail while the reader is pinned to the bottom', () => {
    const rows = buildMessageRows(
      Array.from({ length: 200 }, (_, index) => ({
        kind: 'messages' as const,
        messages: [message(index)]
      }))
    )
    const offsets = buildRowOffsets(rows, new Map())

    const { start, end } = findMessageWindow(offsets, rows.length, 0, 600, true)

    expect(end).toBe(rows.length)
    expect(start).toBeGreaterThan(0)
  })

  it('splits one long same-role group into per-message rows', () => {
    const rows = buildMessageRows([{ kind: 'messages', messages: sameRoleMessages(300) }])
    expect(rows).toHaveLength(300)

    const offsets = buildRowOffsets(rows, new Map())
    const { start, end } = findMessageWindow(offsets, rows.length, 0, 600, false)

    expect(start).toBe(0)
    expect(end - start).toBeLessThan(40)
  })
})

describe('MessageList windowing', () => {
  it('renders only a window of a long, scrolled-up history', () => {
    const { container } = renderList({ count: 200, isScrolledUp: true })

    const rows = container.querySelectorAll('[data-message-row]')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(40)
    // The head is rendered; the far tail is not in the DOM at all.
    expect(screen.getByText('msg-0')).toBeInTheDocument()
    expect(screen.queryByText('msg-199')).not.toBeInTheDocument()
  })

  it('keeps the tail rendered while pinned to the bottom', () => {
    const { container } = renderList({ count: 200, isScrolledUp: false })

    const rows = container.querySelectorAll('[data-message-row]')
    expect(rows.length).toBeLessThan(40)
    expect(screen.getByText('msg-199')).toBeInTheDocument()
    expect(screen.queryByText('msg-0')).not.toBeInTheDocument()
  })

  it('windows a long run of same-role messages, not just alternating ones', () => {
    const { container } = renderList({ count: 200, isScrolledUp: false, sameRole: true })

    const rows = container.querySelectorAll('[data-message-row]')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(40)
    expect(screen.getByText('msg-199')).toBeInTheDocument()
    expect(screen.queryByText('msg-0')).not.toBeInTheDocument()
  })

  it('renders every row for a short conversation', () => {
    const { container } = renderList({ count: 10, isScrolledUp: true })

    expect(container.querySelectorAll('[data-message-row]')).toHaveLength(11)
    expect(screen.getByText('msg-9')).toBeInTheDocument()
  })
})
