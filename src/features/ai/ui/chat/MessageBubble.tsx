import type { ApiChatMessage } from '@shared-core/types'

import MessageContent from '@features/ai/lib/parseMessageContent'

import { BlurFade } from '@app/components/ui/blur-fade'
import { Textarea } from '@app/components/ui/textarea'
import { useToastActions } from '@app/providers'
import { useDialogBehavior } from '@shared/hooks'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Copy, Download, Maximize2, Minus, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { memo, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Timestamp } from './Avatars'
import { CopyButton, DeleteButton, FeedbackButtons, TtsButton } from './MessageActions'

/** Re-encode any clipboard-supported image to PNG (the only type Chromium accepts). */
function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return Promise.resolve(blob)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new window.Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('no 2d context')
        context.drawImage(image, 0, 0)
        canvas.toBlob(
          (png) => (png ? resolve(png) : reject(new Error('png encode failed'))),
          'image/png'
        )
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    image.src = url
  })
}

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
  /** Keeps a row mounted while it is editing or speaking inside a virtual list. */
  onKeepAliveChange?: (messageId: string, keepAlive: boolean) => void
}

const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  onDelete,
  onEdit,
  isLastAssistant,
  onRegenerate,
  onKeepAliveChange
}: MessageBubbleProps) {
  const { t } = useTranslation()
  const { showError } = useToastActions()
  // The transcript is model prose: a message that happens to begin with
  // "Error:" or "Hata:" is still a normal answer. Only the explicit flag that
  // `buildErrorReply` sets may paint the destructive shell.
  const isError = message.isError === true
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editVal, setEditVal] = useState(message.content)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1)
  const editAreaRef = useRef<HTMLTextAreaElement>(null)
  const previewDialogRef = useRef<HTMLDivElement>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)
  const previewImgRef = useRef<HTMLImageElement>(null)
  const previewTitleId = useId()

  const openPreview = (src: string) => {
    setPreviewZoom(1)
    setPreviewImage(src)
  }

  const closePreview = () => setPreviewImage(null)

  const zoomPreview = (delta: number) => {
    setPreviewZoom((zoom) => Math.min(4, Math.max(0.5, Number((zoom + delta).toFixed(2)))))
  }

  const showActualSize = () => {
    const image = previewImgRef.current
    const container = image?.parentElement
    if (!image || !container || !image.naturalWidth) return
    setPreviewZoom(
      Math.min(4, Math.max(0.5, Number((image.naturalWidth / container.clientWidth).toFixed(2))))
    )
  }

  const copyPreviewImage = async () => {
    if (!previewImage) return
    try {
      const blob = await (await fetch(previewImage)).blob()
      // Chromium's async clipboard only accepts image/png; JPEG/WebP photos
      // have to be re-encoded before they can be written.
      const png = await toPngBlob(blob)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    } catch {
      showError('toast_clipboard_failed')
    }
  }

  const savePreviewImage = () => {
    if (!previewImage) return
    const mime = /^data:image\/([a-zA-Z0-9.+-]+)/.exec(previewImage)?.[1]?.toLowerCase()
    const extension = mime === 'jpeg' ? 'jpg' : (mime?.split('+')[0] ?? 'png')
    const link = document.createElement('a')
    link.href = previewImage
    link.download = `quizlab-image-${Date.now()}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // A virtualized list unmounts off-screen rows. Editing text and active TTS
  // must survive that scroll, so the list pins this row while either is true.
  useEffect(() => {
    onKeepAliveChange?.(message.id, isEditing || isSpeaking)
    return () => onKeepAliveChange?.(message.id, false)
  }, [isEditing, isSpeaking, message.id, onKeepAliveChange])

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
    <BlurFade className="group" duration={0.3} offset={8} blur="4px">
      <div
        data-message-error={isError ? 'true' : undefined}
        className={`motion-normal relative rounded-2xl border px-4 py-3 transition-colors ${
          isError
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : isSpeaking
              ? 'border-primary/40 text-foreground shadow-primary/10 bg-zinc-950/80 shadow-md'
              : isUser
                ? 'ml-auto w-fit max-w-[85%] rounded-br-md border-white/[0.07] bg-zinc-800/90 text-zinc-100'
                : 'text-foreground w-full rounded-bl-md border-white/[0.07] bg-zinc-900/60'
        }`}
      >
        {message.images && message.images.length > 0 && (
          <div className="relative mb-2 flex flex-wrap gap-2">
            {message.images.map((img, i) => (
              <button
                // eslint-disable-next-line react/no-array-index-key -- Static content parts, stable order
                key={i}
                type="button"
                onClick={() => openPreview(img)}
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
                if (event.target === event.currentTarget) closePreview()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  closePreview()
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
                onClick={closePreview}
                aria-label={t('api_chat_close_image')}
                className="absolute top-4 right-4 z-20 size-9 rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-white"
              >
                <X />
              </IconButton>

              <div
                role="presentation"
                className="custom-scrollbar flex h-full w-full cursor-auto items-start justify-start overflow-auto px-2 pt-14 pb-24"
                onClick={(event) => {
                  // Only the empty backdrop closes; clicks on the image or the
                  // control bar must keep the preview open.
                  if (event.target === event.currentTarget) closePreview()
                }}
              >
                <img
                  ref={previewImgRef}
                  src={previewImage}
                  alt=""
                  style={
                    previewZoom === 1
                      ? undefined
                      : { width: `${previewZoom * 100}%`, maxWidth: 'none' }
                  }
                  className={`m-auto cursor-default rounded-lg object-contain shadow-2xl ${previewZoom === 1 ? 'max-h-full max-w-full' : 'h-auto'}`}
                />
              </div>

              {/* Floating control bar: zoom, actual size, copy and save. */}
              <div
                role="toolbar"
                aria-label={t('api_chat_open_image')}
                className="absolute bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-1.5 text-white/90 shadow-2xl backdrop-blur-xl"
              >
                <IconButton
                  type="button"
                  size="compact"
                  variant="ghost"
                  onClick={() => zoomPreview(-0.25)}
                  aria-label={t('zoom_out')}
                  title={t('zoom_out')}
                  className="text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-40"
                  disabled={previewZoom <= 0.5}
                >
                  <Minus />
                </IconButton>
                <span className="text-ql-11 w-12 shrink-0 text-center font-mono tabular-nums select-none">
                  {Math.round(previewZoom * 100)}%
                </span>
                <IconButton
                  type="button"
                  size="compact"
                  variant="ghost"
                  onClick={() => zoomPreview(0.25)}
                  aria-label={t('zoom_in')}
                  title={t('zoom_in')}
                  className="text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-40"
                  disabled={previewZoom >= 4}
                >
                  <Plus />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  className="text-ql-11 rounded-full px-2.5 py-1 font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  {t('fit_to_screen')}
                </button>
                <button
                  type="button"
                  onClick={showActualSize}
                  className="text-ql-11 flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <Maximize2 className="size-3" aria-hidden />
                  100%
                </button>
                <span aria-hidden className="mx-0.5 h-4 w-px bg-white/20" />
                <IconButton
                  type="button"
                  size="compact"
                  variant="ghost"
                  onClick={() => void copyPreviewImage()}
                  aria-label={t('copy_image')}
                  title={t('copy_image')}
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <Copy />
                </IconButton>
                <IconButton
                  type="button"
                  size="compact"
                  variant="ghost"
                  onClick={savePreviewImage}
                  aria-label={t('save_image')}
                  title={t('save_image')}
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <Download />
                </IconButton>
              </div>
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
            className={`relative ${isUser ? 'text-ql-13 leading-relaxed' : 'text-ql-14 leading-7'} ${
              isError ? 'text-destructive' : 'text-foreground'
            }`}
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
                <div className="motion-normal flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 has-[[data-copied=true]]:opacity-100">
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
                  className="text-ql-10 text-muted-foreground/80 max-w-[180px] truncate font-mono select-none"
                  title={message.model}
                >
                  {message.model}
                </span>
              )}
              <Timestamp ts={message.timestamp} />
              {!isError && (
                <div className="motion-normal flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 has-[[data-copied=true]]:opacity-100">
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
    </BlurFade>
  )
})

export default MessageBubble
