import type { ApiChatMessage } from '@shared-core/types'

import MessageContent from '@features/ai/lib/parseMessageContent'

import { Textarea } from '@app/components/ui/textarea'

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
        className={`w-fit ${isUser ? 'ml-auto' : ''} relative rounded-xl px-4 py-2.5 transition-colors duration-150 ${
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
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditVal(message.content)
                }}
                className="text-ql-12 border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground rounded-md border px-3 py-1 transition-colors"
              >
                {t('api_chat_cancel')}
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="text-ql-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1 font-medium transition-colors"
              >
                {t('api_chat_save')}
              </button>
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
                <div className="flex items-center gap-1 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-ql-10 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex items-center justify-center rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      title={t('api_chat_edit')}
                      aria-label={t('api_chat_edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
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
                <div className="flex items-center gap-1 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                  <TtsButton content={message.content} />
                  {isLastAssistant && onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="text-ql-10 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex items-center justify-center rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      title={t('api_chat_regenerate_tooltip')}
                      aria-label={t('api_chat_regenerate_tooltip')}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
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
