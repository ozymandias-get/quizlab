import type { ApiChatMessage } from '@shared-core/types'

import MessageContent from '@features/ai/lib/parseMessageContent'

import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { Textarea } from '@app/components/ui/textarea'
import { WithTooltip } from '@app/components/ui/tooltip'

import { Pencil, RefreshCw } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Timestamp } from './Avatars'
import { CopyButton, DeleteButton, FeedbackButtons, TtsButton } from './MessageActions'

interface MessageBubbleProps {
  message: ApiChatMessage
  isUser: boolean
  /**
   * Delete handler. Receives the message id so the parent can pass a single
   * stable callback for all bubbles in a list — otherwise the per-row arrow
   * wrapper would defeat this component's `memo`.
   */
  onDelete: (messageId: string) => void
  /**
   * Edit handler. Receives the message id + new content. Same rationale as
   * `onDelete`.
   */
  onEdit?: (messageId: string, newContent: string) => void
  isLastAssistant?: boolean
  onRegenerate?: () => void
}

const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  onDelete,
  onEdit,
  isLastAssistant,
  onRegenerate
}: MessageBubbleProps) {
  const { t } = useTranslation()
  const isError = message.content.startsWith('Hata:') || message.content.startsWith('Error:')
  const [isEditing, setIsEditing] = useState(false)
  const [editVal, setEditVal] = useState(message.content)
  const editAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && editAreaRef.current) {
      editAreaRef.current.focus()
      editAreaRef.current.style.height = 'auto'
      editAreaRef.current.style.height = `${editAreaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  const handleEditSave = () => {
    if (editVal.trim() && editVal.trim() !== message.content && onEdit) {
      onEdit(message.id, editVal.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditVal(message.content)
    }
  }

  return (
    <div className="group animate-app-enter">
      <div
        className={`w-fit ${isUser ? 'ml-auto' : ''} motion-normal relative rounded-xl px-4 py-2.5 transition-colors ${
          isUser
            ? 'border-primary/25 bg-primary/10 text-foreground border shadow-xs'
            : 'border-border bg-card text-foreground border shadow-xs'
        } ${isError ? 'border-destructive/40 bg-destructive/10 text-destructive' : ''}`}
      >
        {message.images && message.images.length > 0 && (
          <div className="relative mb-2 flex flex-wrap gap-2">
            {message.images.map((img, i) => (
              <img
                // eslint-disable-next-line react/no-array-index-key -- Static content parts, stable order
                key={i}
                src={img}
                alt=""
                className="border-border max-h-[200px] max-w-[200px] rounded-lg border object-cover"
              />
            ))}
          </div>
        )}

        {isEditing ? (
          <div className="relative z-10 -mx-1 flex flex-col gap-2 py-1">
            <Textarea
              ref={editAreaRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-ring bg-background text-foreground min-h-[60px] border"
              aria-label={t('api_chat_edit')}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditVal(message.content)
                }}
                className="text-ql-12"
              >
                {t('api_chat_cancel')}
              </Button>
              <Button type="button" size="sm" onClick={handleEditSave} className="text-ql-12">
                {t('api_chat_save')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`text-ql-13 relative leading-relaxed ${isError ? 'text-destructive' : 'text-foreground'}`}
          >
            <MessageContent content={message.content} />
          </div>
        )}
      </div>

      {!isEditing && (
        <>
          {isUser ? (
            <div className="mt-1 flex items-center justify-end gap-2.5 px-1">
              {!isError && (
                <div className="motion-normal flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  {onEdit && (
                    <WithTooltip label={t('api_chat_edit')}>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={() => setIsEditing(true)}
                        className="text-ql-10 text-muted-foreground"
                        aria-label={t('api_chat_edit')}
                      >
                        <Pencil />
                      </IconButton>
                    </WithTooltip>
                  )}
                  <CopyButton content={message.content} />
                  <DeleteButton onDelete={onDelete} messageId={message.id} />
                </div>
              )}
              <Timestamp ts={message.timestamp} />
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2.5 px-1">
              {message.model && (
                <span className="text-ql-10 text-muted-foreground/60 font-mono select-none">
                  {message.model}
                </span>
              )}
              <Timestamp ts={message.timestamp} />
              {!isError && (
                <div className="motion-normal flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                  <TtsButton content={message.content} />
                  {isLastAssistant && onRegenerate && (
                    <WithTooltip label={t('api_chat_regenerate_tooltip')}>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={onRegenerate}
                        className="text-ql-10 text-muted-foreground"
                        aria-label={t('api_chat_regenerate_tooltip')}
                      >
                        <RefreshCw />
                      </IconButton>
                    </WithTooltip>
                  )}
                  <CopyButton content={message.content} />
                  <FeedbackButtons />
                  <DeleteButton onDelete={onDelete} messageId={message.id} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default MessageBubble
