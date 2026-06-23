import type { ApiChatMessage } from '@shared-core/types'

import { memo, useMemo } from 'react'

import { AiAvatar, UserAvatar } from './Avatars'
import { DateSeparator } from './DateSeparator'
import { MessageBubble } from './MessageBubble'
import { ScrollToBottom } from './ScrollToBottom'
import { StreamingIndicator } from './StreamingIndicator'
import { groupMessages } from './utils'

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

export const MessageList = memo(function MessageList({
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
  const { groups: messageGroups, lastAssistantId } = useMemo(
    () => groupMessages(messages),
    [messages]
  )

  return (
    <div
      ref={containerRef}
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.03)_0%,_transparent_60%)]"
    >
      <div className="relative min-h-full px-4 py-4 sm:px-6 lg:px-8">
        {messageGroups.map((group, gi) => {
          if (group.kind === 'date') {
            // eslint-disable-next-line react/no-array-index-key
            return <DateSeparator key={`d-${gi}`} ts={group.timestamp} />
          }

          const isUser = group.messages[0].role === 'user'
          return (
            // eslint-disable-next-line react/no-array-index-key
            <div key={`g-${gi}`} className="mb-3">
              {group.messages.map((msg, mi) => {
                const isLastAssistant = !isUser && msg.id === lastAssistantId

                return (
                  <div
                    key={msg.id}
                    className={`flex ${mi > 0 ? 'mt-1.5' : ''} ${isUser ? 'justify-end' : ''}`}
                  >
                    {!isUser && (
                      <div className={`flex items-start gap-2.5 ${mi > 0 ? 'ml-10' : ''}`}>
                        {mi === 0 && (
                          <div className="shrink-0 pt-1">
                            <AiAvatar />
                          </div>
                        )}
                        <div className="max-w-[85%] min-w-0 sm:max-w-[75%]">
                          <MessageBubble
                            message={msg}
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
                        className={`flex items-start justify-end gap-2.5 ${mi > 0 ? 'mr-10' : ''}`}
                      >
                        <div className="max-w-[85%] min-w-0 sm:max-w-[75%]">
                          <MessageBubble
                            message={msg}
                            isUser
                            onDelete={onDeleteMessage}
                            onEdit={onEditMessage}
                          />
                        </div>
                        {mi === 0 && (
                          <div className="shrink-0 pt-1">
                            <UserAvatar />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
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
