import type { ApiChatMessage } from '@shared-core/types'

import { Button } from '@shared/ui/components/primitives'

import { ChevronUp } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AiAvatar, UserAvatar } from './Avatars'
import { groupMessagesIncremental, type MessageGroupsCache } from './chatUtils'
import DateSeparator from './DateSeparator'
import MessageBubble from './MessageBubble'
import {
  buildMessageRowsCache,
  type MessageRowModel,
  type MessageRowsCache,
  useMessageListWindow
} from './messageListWindow'
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
  const { t } = useTranslation()
  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [containerRef])

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

  // Count messages that arrive while the reader is scrolled away. The baseline
  // is the length at the moment they left the bottom, so the badge never counts
  // history they have already seen.
  const [unreadCount, setUnreadCount] = useState(0)
  const unreadBaselineRef = useRef(0)
  useEffect(() => {
    if (isScrolledUp) {
      if (unreadBaselineRef.current === 0) unreadBaselineRef.current = messages.length
      setUnreadCount(Math.max(0, messages.length - unreadBaselineRef.current))
      return
    }
    unreadBaselineRef.current = 0
    setUnreadCount(0)
  }, [isScrolledUp, messages.length])

  const [keepAliveIds, setKeepAliveIds] = useState<Set<string>>(() => new Set())
  const handleKeepAliveChange = useCallback((messageId: string, keepAlive: boolean) => {
    setKeepAliveIds((previous) => {
      const has = previous.has(messageId)
      if (has === keepAlive) return previous
      const next = new Set(previous)
      if (keepAlive) next.add(messageId)
      else next.delete(messageId)
      return next
    })
  }, [])

  const rowsCacheRef = useRef<MessageRowsCache | null>(null)
  const rows = useMemo(() => {
    const cache = buildMessageRowsCache(rowsCacheRef.current, messageGroups)
    rowsCacheRef.current = cache
    return cache.rows
  }, [messageGroups])
  const pinnedRowKeys = useMemo(() => {
    if (keepAliveIds.size === 0) return undefined
    const keys = new Set<string>()
    for (const row of rows) {
      if (row.kind === 'message' && keepAliveIds.has(row.message.id)) keys.add(row.key)
    }
    return keys
  }, [rows, keepAliveIds])
  const { start, end, topPad, bottomPad } = useMessageListWindow({
    rows,
    containerRef,
    pinnedToBottom: !isScrolledUp,
    pinnedRowKeys
  })

  const renderRow = (row: MessageRowModel) => {
    if (row.kind === 'date') {
      return (
        <div key={row.key} data-message-row={row.key} className="sticky top-0 z-[1] flow-root">
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
                  onKeepAliveChange={handleKeepAliveChange}
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
                  onKeepAliveChange={handleKeepAliveChange}
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
    <div className="relative flex min-h-0 flex-1 flex-col">
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
        </div>
      </div>
      {/* Outside the scrollport: the shortcuts stay in the message panel's
          bottom-right corner instead of hovering over the composer. */}
      {isScrolledUp && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={scrollToTop}
          aria-label={t('api_chat_scroll_to_top')}
          title={t('api_chat_scroll_to_top')}
          className="text-ql-11 border-border bg-card/95 text-muted-foreground shadow-ambient-md absolute right-4 bottom-16 z-10 gap-1 rounded-full border"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">{t('api_chat_scroll_to_top')}</span>
        </Button>
      )}
      <ScrollToBottom visible={isScrolledUp} count={unreadCount} onClick={onScrollToBottom} />
    </div>
  )
})

export default MessageList
