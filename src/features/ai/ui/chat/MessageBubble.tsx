import { useState, useRef, useEffect } from 'react'
import type { ApiChatMessage } from '@shared-core/types'
import { MessageContent } from '@features/ai/lib/parseMessageContent'
import { useLanguageStrings } from '@app/providers'
import { AiAvatar, UserAvatar, Timestamp } from './Avatars'
import { CopyButton, TtsButton, FeedbackButtons, DeleteButton } from './MessageActions'

interface MessageBubbleProps {
  message: ApiChatMessage
  isUser: boolean
  onDelete: () => void
  onEdit?: (newContent: string) => void
  isLastAssistant?: boolean
  onRegenerate?: () => void
}

export function MessageBubble({
  message,
  isUser,
  onDelete,
  onEdit,
  isLastAssistant,
  onRegenerate
}: MessageBubbleProps) {
  const { t } = useLanguageStrings()
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
      onEdit(editVal.trim())
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
        className={`w-fit ${isUser ? 'ml-auto' : ''} relative rounded-xl px-4 py-2.5 transition-all duration-200 ${
          isUser
            ? 'bg-gradient-to-br from-amber-500/[0.09] to-amber-500/[0.03] border border-amber-500/15 border-l-[3px] border-l-amber-500/50 shadow-sm shadow-amber-500/5 hover:border-amber-500/25 hover:shadow-md'
            : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/30 hover:border-white/[0.12]'
        } ${isError ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 shadow-red-500/5' : ''}`}
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        <div
          className={`absolute inset-0 rounded-xl pointer-events-none ${isUser ? 'bg-gradient-to-t from-white/[0.02] to-transparent' : 'bg-gradient-to-b from-white/[0.02] to-transparent'}`}
        />
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap relative">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                className="max-w-[200px] max-h-[200px] rounded-lg object-cover ring-1 ring-white/10"
              />
            ))}
          </div>
        )}

        {isEditing ? (
          <div className="flex flex-col gap-2 relative z-10 py-1">
            <textarea
              ref={editAreaRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-zinc-900 border border-amber-500/30 rounded-lg p-2 text-ql-13 text-white outline-none focus:ring-1 focus:ring-amber-500/50 resize-none min-h-[50px]"
            />
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setEditVal(message.content)
                }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-ql-11 text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-all"
              >
                {t('api_chat_cancel') || 'İptal'}
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-ql-11 text-amber-300 hover:bg-amber-500/30 transition-all font-medium"
              >
                {t('api_chat_save') || 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`relative text-ql-13 leading-relaxed ${isError ? 'text-red-300' : 'text-white/80'}`}
          >
            <MessageContent content={message.content} />
          </div>
        )}
      </div>

      {!isEditing && (
        <>
          {isUser ? (
            <div className="flex items-center justify-end gap-2.5 mt-1 px-1">
              {!isError && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center justify-center rounded p-1 text-ql-10 text-white/25 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title={t('api_chat_edit') || 'Düzenle'}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  )}
                  <CopyButton content={message.content} />
                  <DeleteButton onDelete={onDelete} />
                </div>
              )}
              <Timestamp ts={message.timestamp} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mt-1 px-1">
              {message.model && (
                <span className="text-ql-10 text-white/20 font-mono select-none">
                  {message.model}
                </span>
              )}
              <Timestamp ts={message.timestamp} />
              {!isError && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <TtsButton content={message.content} />
                  {isLastAssistant && onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="flex items-center justify-center rounded p-1 text-ql-10 text-white/25 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title={t('api_chat_regenerate_tooltip') || 'Yanıtı Yeniden Üret'}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                    </button>
                  )}
                  <CopyButton content={message.content} />
                  <FeedbackButtons />
                  <DeleteButton onDelete={onDelete} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { AiAvatar, UserAvatar }
