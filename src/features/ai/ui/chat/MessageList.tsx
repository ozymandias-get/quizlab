import { useMemo } from 'react'
import type { ApiChatMessage } from '@shared-core/types'
import { groupMessages, type MessageGroup } from './utils'
import { DateSeparator } from './DateSeparator'
import { MessageBubble, AiAvatar, UserAvatar } from './MessageBubble'
import { StreamingIndicator } from './StreamingIndicator'
import { ScrollToBottom } from './ScrollToBottom'

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

function findDateTimestamp(messages: ApiChatMessage[], groups: MessageGroup[], gi: number): number {
  let idx = 0
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === 'date') {
      if (i === gi) {
        return messages[Math.min(idx, messages.length - 1)]?.timestamp || Date.now()
      }
    } else {
      idx += (groups[i] as ApiChatMessage[]).length
    }
  }
  return Date.now()
}

export function MessageList({
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
  const messageGroups = useMemo(() => groupMessages(messages), [messages])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto custom-scrollbar bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.03)_0%,_transparent_60%)]"
    >
      <div className="px-4 sm:px-6 lg:px-8 py-4 relative min-h-full">
        {messageGroups.map((group, gi) => {
          if (group === 'date') {
            const ts = findDateTimestamp(messages, messageGroups, gi)
            return <DateSeparator key={`d-${gi}`} ts={ts} />
          }

          const isUser = group[0].role === 'user'
          return (
            <div key={`g-${gi}`} className="mb-3">
              {group.map((msg, mi) => {
                const isLastAssistant = !isUser && msg.id === messages[messages.length - 1]?.id

                return (
                  <div
                    key={msg.id}
                    className={`flex ${mi > 0 ? 'mt-1.5' : ''} ${isUser ? 'justify-end' : ''}`}
                  >
                    {!isUser && (
                      <div className={`flex items-start gap-2.5 ${mi > 0 ? 'ml-10' : ''}`}>
                        {mi === 0 && (
                          <div className="pt-1 shrink-0">
                            <AiAvatar />
                          </div>
                        )}
                        <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                          <MessageBubble
                            message={msg}
                            isUser={false}
                            onDelete={() => onDeleteMessage(msg.id)}
                            isLastAssistant={isLastAssistant}
                            onRegenerate={onRegenerateMessage}
                          />
                        </div>
                      </div>
                    )}
                    {isUser && (
                      <div
                        className={`flex items-start gap-2.5 justify-end ${mi > 0 ? 'mr-10' : ''}`}
                      >
                        <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                          <MessageBubble
                            message={msg}
                            isUser={true}
                            onDelete={() => onDeleteMessage(msg.id)}
                            onEdit={
                              onEditMessage
                                ? (newContent) => onEditMessage(msg.id, newContent)
                                : undefined
                            }
                          />
                        </div>
                        {mi === 0 && (
                          <div className="pt-1 shrink-0">
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
          <div className="flex gap-2.5 justify-start">
            <div className="pt-1 shrink-0">
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
}
