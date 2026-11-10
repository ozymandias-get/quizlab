import type { ApiChatMessage } from '@shared-core/types'

import MessageContent from '@features/ai/lib/parseMessageContent'

import { Textarea } from '@app/components/ui/textarea'
import { useDialogBehavior } from '@shared/hooks'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Pencil, RefreshCw, X } from 'lucide-react'
import { memo, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  // The transcript is model prose: a message that happens to begin with
  // "Error:" or "Hata:" is still a normal answer. Only the explicit flag that
  // `buildErrorReply` sets may paint the destructive shell.
  const isError = message.isError === true
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editVal, setEditVal] = useState(message.content)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const editAreaRef = useRef<HTMLTextAreaElement>(null)
  const previewDialogRef = useRef<HTMLDivElement>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)
  const previewTitleId = useId()

  useDialogBehavior({
    isOpen: previewImage !== null,
    onClose: () => setPreviewImage(null),
    dialogRef: previewDialogRef,
    initialFocusRef: previewCloseRef
  })

  useEffect(() => {
    if (isEditing && editAreaRef.current) {
      editAreaRef.current.focus()
      editAreaRef.current.style.height = 'auto'
      editAreaRef.current.style.height = `${editAreaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  const canSaveEdit = editVal.trim().length > 0 && editVal.trim() !== message.content

  const handleEditSave = () => {
    if (!canSaveEdit) return
    if (onEdit) onEdit(message.id, editVal.trim())
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
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
        data-message-error={isError ? 'true' : undefined}
        className={`w-fit ${isUser ? 'ml-auto' : ''} motion-normal relative rounded-xl border px-4 py-2.5 transition-colors ${
          isError
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : isSpeaking
              ? 'border-primary/40 bg-card text-foreground shadow-primary/10 shadow-md'
              : isUser
                ? 'border-primary/25 bg-primary/10 text-foreground border shadow-xs'
                : 'border-border bg-card text-foreground border shadow-xs'
        }`}
      >
        {message.images && message.images.length > 0 && (
          <div className="relative mb-2 flex flex-wrap gap-2">
            {message.images.map((img, i) => (
              <button
                // eslint-disable-next-line react/no-array-index-key -- Static content parts, stable order
                key={i}
                type="button"
                onClick={() => setPreviewImage(img)}
                className="border-border focus-visible:ring-ring/70 cursor-zoom-in overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
                aria-label={t('api_chat_open_image')}
              >
                <img src={img} alt="" className="max-h-[200px] max-w-[200px] object-cover" />
              </button>
            ))}
          </div>
        )}

        {previewImage &&
          createPortal(
            <div
              ref={previewDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={previewTitleId}
              className="z-modal fixed inset-0 flex cursor-zoom-out items-center justify-center overflow-hidden bg-black/70 p-6"
              onClick={(event) => {
                if (event.target === event.currentTarget) setPreviewImage(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  setPreviewImage(null)
                }
              }}
            >
              <h2 id={previewTitleId} className="sr-only">
                {t('api_chat_open_image')}
              </h2>
              <IconButton
                ref={previewCloseRef}
                type="button"
                size="compact"
                variant="ghost"
                onClick={() => setPreviewImage(null)}
                aria-label={t('api_chat_close_image')}
                className="absolute top-4 right-4 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X />
              </IconButton>
              <img
                src={previewImage}
                alt=""
                className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-2xl"
              />
            </div>,
            document.body
          )}

        {isEditing ? (
          <div className="relative z-10 -mx-1 flex flex-col gap-2 py-1">
            <Textarea
              ref={editAreaRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-ql-13 border-ring bg-background text-foreground min-h-[60px] border"
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
              <Button
                type="button"
                size="sm"
                onClick={handleEditSave}
                disabled={!canSaveEdit}
                className="text-ql-12"
              >
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
                <div className="motion-normal flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
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
                <span
                  className="text-ql-10 text-muted-foreground/60 max-w-[180px] truncate font-mono select-none"
                  title={message.model}
                >
                  {message.model}
                </span>
              )}
              <Timestamp ts={message.timestamp} />
              {!isError && (
                <div className="motion-normal flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                  <TtsButton content={message.content} onSpeakingChange={setIsSpeaking} />
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
