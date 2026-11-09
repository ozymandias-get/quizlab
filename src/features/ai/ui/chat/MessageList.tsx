import type { ApiChatMessage } from '@shared-core/types'

import { memo, useMemo, useRef } from 'react'

import { AiAvatar, UserAvatar } from './Avatars'
import { groupMessagesIncremental, type MessageGroupsCache } from './chatUtils'
import DateSeparator from './DateSeparator'
import MessageBubble from './MessageBubble'
import { buildMessageRows, type MessageRowModel, useMessageListWindow } from './messageListWindow'
import ScrollToBottom from './ScrollToBottom'
import StreamingIndicator from './StreamingIndicator'

interface MessageListProps {
  messages: ApiChatMessage[]
  isStreaming: boolean
  isScrolledUp: boolean
  onScrollToBottom: () => void
  onDeleteMessage: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onRegenerateMessage?: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
  endRef: React.RefObject<HTMLDivElement | null>
}

const MessageList = memo(function MessageList({
  messages,
  isStreaming,
  isScrolledUp,
  onScrollToBottom,
  onDeleteMessage,
  onEditMessage,
  onRegenerateMessage,
  containerRef,
  endRef
}: MessageListProps) {
  // Single pass: groups + lastAssistantId both come out of the same walk.
  // Previously, `MessageList` did an O(n) lookup per date separator and an
  // O(n) `messages[messages.length - 1]?.id` check per non-user message
  // — both per render. With long chat history this is wasted work.
  //
  // During streaming only the last message object changes, so the cache lets a
  // chunk reuse every group before it instead of re-walking the history.
  const groupingRef = useRef<MessageGroupsCache | null>(null)
  const { groups: messageGroups, lastAssistantId } = useMemo(() => {
    const result = groupMessagesIncremental(groupingRef.current, messages)
    groupingRef.current = { messages, result }
    return result
  }, [messages])

  const rows = useMemo(() => buildMessageRows(messageGroups), [messageGroups])
  const { start, end, topPad, bottomPad } = useMessageListWindow({
    rows,
    containerRef,
    pinnedToBottom: !isScrolledUp
  })

  const renderRow = (row: MessageRowModel) => {
    if (row.kind === 'date') {
      return (
        <div key={row.key} data-message-row={row.key} className="flow-root">
          <DateSeparator ts={row.timestamp} />
        </div>
      )
    }

    const { message, isFirstOfGroup, isLastOfGroup } = row
    const isUser = message.role === 'user'
    const isLastAssistant = !isUser && message.id === lastAssistantId
    const groupSpacing = `${isFirstOfGroup ? '' : 'mt-1.5'} ${isLastOfGroup ? 'mb-3' : ''}`

    return (
      <div key={row.key} data-message-row={row.key} className="flow-root">
        <div className={`flex ${groupSpacing} ${isUser ? 'justify-end' : ''}`}>
          {!isUser && (
            <div className={`flex items-start gap-2.5 ${isFirstOfGroup ? '' : 'ml-10'}`}>
              {isFirstOfGroup && (
                <div className="shrink-0 pt-1">
                  <AiAvatar />
                </div>
              )}
              <div className="max-w-[85%] min-w-0 sm:max-w-[75%]">
                <MessageBubble
                  message={message}
                  isUser={false}
                  onDelete={onDeleteMessage}
                  isLastAssistant={isLastAssistant}
                  onRegenerate={onRegenerateMessage}
                />
              </div>
            </div>
          )}
          {isUser && (
            <div
              className={`flex items-start justify-end gap-2.5 ${isFirstOfGroup ? '' : 'mr-10'}`}
            >
              <div className="max-w-[85%] min-w-0 sm:max-w-[75%]">
                <MessageBubble
                  message={message}
                  isUser
                  onDelete={onDeleteMessage}
                  onEdit={onEditMessage}
                />
              </div>
              {isFirstOfGroup && (
                <div className="shrink-0 pt-1">
                  <UserAvatar />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.03)_0%,_transparent_60%)]"
    >
      <div className="relative min-h-full px-4 py-4 sm:px-6 lg:px-8">
        {topPad > 0 && <div aria-hidden="true" style={{ height: topPad }} />}
        {rows.slice(start, end).map(renderRow)}
        {bottomPad > 0 && <div aria-hidden="true" style={{ height: bottomPad }} />}
        {isStreaming && (
          <div className="flex justify-start gap-2.5">
            <div className="shrink-0 pt-1">
              <AiAvatar />
            </div>
            <StreamingIndicator />
          </div>
        )}
        <div ref={endRef} />
        <ScrollToBottom visible={isScrolledUp} onClick={onScrollToBottom} />
      </div>
    </div>
  )
})

export default MessageList
