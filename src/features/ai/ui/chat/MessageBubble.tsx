import type { ApiChatMessage } from '@shared-core/types'

import { MessageContent } from '@features/ai/lib/parseMessageContent'

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

export const MessageBubble = memo(function MessageBubble({
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
        className={`w-fit ${isUser ? 'ml-auto' : ''} relative rounded-xl px-4 py-2.5 transition-colors duration-200 ${
          isUser
            ? 'border border-l-[3px] border-amber-500/15 border-l-amber-500/50 bg-gradient-to-br from-amber-500/[0.09] to-amber-500/[0.03] shadow-sm shadow-amber-500/5 hover:border-amber-500/25 hover:shadow-md'
            : 'border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] shadow-sm shadow-black/20 hover:border-white/[0.12] hover:shadow-md hover:shadow-black/30'
        } ${isError ? 'border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-red-500/5' : ''}`}
      >
        <div
          className={`pointer-events-none absolute inset-0 rounded-xl ${isUser ? 'bg-gradient-to-t from-white/[0.02] to-transparent' : 'bg-gradient-to-b from-white/[0.02] to-transparent'}`}
        />
        {message.images && message.images.length > 0 && (
          <div className="relative mb-2 flex flex-wrap gap-2">
            {message.images.map((img, i) => (
              <img
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                src={img}
                alt=""
                className="max-h-[200px] max-w-[200px] rounded-lg object-cover ring-1 ring-white/10"
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
              className="min-h-[60px] border border-amber-500/25 bg-zinc-900/80"
              aria-label={t('api_chat_edit')}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditVal(message.content)
                }}
                className="text-ql-12 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
              >
                {t('api_chat_cancel')}
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="text-ql-12 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
              >
                {t('api_chat_save')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`text-ql-13 relative leading-relaxed ${isError ? 'text-red-300' : 'text-white/80'}`}
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
                <div className="flex items-center gap-1 opacity-40 transition-opacity duration-200 group-hover:opacity-100">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-ql-10 flex items-center justify-center rounded p-1 text-white/25 transition-colors hover:bg-amber-500/10 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
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
                <span className="text-ql-10 font-mono text-white/20 select-none">
                  {message.model}
                </span>
              )}
              <Timestamp ts={message.timestamp} />
              {!isError && (
                <div className="flex items-center gap-1 opacity-40 transition-opacity duration-200 group-hover:opacity-100">
                  <TtsButton content={message.content} />
                  {isLastAssistant && onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="text-ql-10 flex items-center justify-center rounded p-1 text-white/25 transition-colors hover:bg-amber-500/10 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
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
