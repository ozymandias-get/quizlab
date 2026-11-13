import { Input } from '@app/components/ui/input'
import { FOCUS_DEFER_MS } from '@shared/constants/timingConstants'
import { IconButton, WithTooltip } from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { Check, Loader2, MessageSquare, Pencil, Trash2, X } from 'lucide-react'
import { memo, Suspense, useCallback, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Session {
  id: string
  title: string
  messages: { content: string; model?: string }[]
  updatedAt?: number
  createdAt: number
}

interface HistorySessionItemProps {
  session: Session
  isActive: boolean
  onSelect: (sessionId: string) => void
  /** Asks the parent to confirm and start deletion. */
  onDelete: (sessionId: string) => void
  /** True while this session's deletion is still running. */
  isDeleting?: boolean
  editingId: string | null
  editTitle: string
  /** True while the current rename request is in flight. */
  isSavingEdit?: boolean
  onStartEdit: (sessionId: string, currentTitle: string) => void
  onEditTitleChange: (title: string) => void
  onCancelEdit: () => void
  /** Resolves to whether the rename was saved; `false` keeps the editor open. */
  onConfirmEdit: (sessionId: string) => Promise<boolean | void> | boolean | void
}

const HistorySessionItem = memo(function HistorySessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  isDeleting = false,
  editingId,
  editTitle,
  isSavingEdit = false,
  onStartEdit,
  onEditTitleChange,
  onCancelEdit,
  onConfirmEdit
}: HistorySessionItemProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const editInputRef = useRef<HTMLInputElement>(null)
  const editErrorId = useId()
  const isEditing = session.id === editingId
  const isTitleEmpty = editTitle.trim().length === 0
  const msgCount = session.messages.length
  // The model that produced the conversation, for the row's visual identity.
  const sessionModel = session.messages.find((message) => message.model)?.model
  const modelIcon = sessionModel ? getAiIcon(sessionModel) : null

  /**
   * Escape calls `onCancelEdit`, which unmounts the input; that unmount fires
   * `onBlur` afterwards. Without this latch the cancelled edit would still be
   * saved by the blur handler. It also makes Enter/click idempotent when the
   * button click's blur lands before the click itself.
   *
   * A failed save resets the latch so the user can retry without losing the
   * draft they already typed.
   */
  const editOutcomeRef = useRef<'idle' | 'confirmed' | 'cancelled'>('idle')

  useEffect(() => {
    if (!isEditing) return

    editOutcomeRef.current = 'idle'
    const focusTimer = setTimeout(() => editInputRef.current?.focus(), FOCUS_DEFER_MS)
    // A quick cancel/close must not leave a focus call queued for a row that
    // has already left edit mode (or the DOM entirely).
    return () => clearTimeout(focusTimer)
  }, [isEditing])

  const confirmEdit = useCallback(async () => {
    if (editOutcomeRef.current !== 'idle') return
    // An empty title never reaches the parent: the editor stays open and the
    // inline error explains why nothing was saved.
    if (isTitleEmpty) return

    editOutcomeRef.current = 'confirmed'
    const saved = await onConfirmEdit(session.id)
    if (saved === false) editOutcomeRef.current = 'idle'
  }, [isTitleEmpty, onConfirmEdit, session.id])

  const cancelEdit = useCallback(() => {
    editOutcomeRef.current = 'cancelled'
    onCancelEdit()
  }, [onCancelEdit])

  /**
   * Blur is not a save: the explicit Save button and Enter own that decision.
   * Clicking elsewhere keeps the editor (and the draft) open. Only an
   * untouched title is closed, so tabbing through the list does not leave a
   * pointless editor behind.
   */
  const handleEditBlur = useCallback(() => {
    if (editOutcomeRef.current !== 'idle') return
    if (editTitle.trim() === session.title.trim()) cancelEdit()
  }, [cancelEdit, editTitle, session.title])

  const icon = (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        isActive
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'text-muted-foreground group-hover:text-foreground border-white/[0.07] bg-white/[0.04]'
      }`}
    >
      {modelIcon ? (
        <Suspense fallback={<MessageSquare className="h-4 w-4" />}>{modelIcon}</Suspense>
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
    </div>
  )

  const metadata = (
    <div className="text-ql-11 text-muted-foreground mt-1 flex min-w-0 items-center gap-2 tabular-nums select-none">
      <span className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5">
        <MessageSquare className="h-3 w-3 shrink-0" />
        {t('api_chat_msg_count', { count: String(msgCount) })}
      </span>
      <span className="shrink-0 opacity-30">•</span>
      <span className="min-w-0 truncate">
        {new Date(session.updatedAt || session.createdAt).toLocaleString(
          language === 'tr' ? 'tr-TR' : 'en-US'
        )}
      </span>
    </div>
  )

  return (
    <div
      className={`group focus-within:ring-ring/40 motion-normal relative flex h-full items-center justify-between overflow-hidden rounded-xl border p-2.5 transition-colors focus-within:ring-2 ${
        isActive
          ? 'border-white/[0.07] bg-white/[0.07]'
          : 'border-transparent hover:border-white/5 hover:bg-white/5'
      }`}
    >
      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-12">
          {icon}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Input
                ref={editInputRef}
                value={editTitle}
                onChange={(e) => onEditTitleChange(e.target.value)}
                onBlur={handleEditBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit()
                  else if (e.key === 'Escape') cancelEdit()
                }}
                size="sm"
                aria-invalid={isTitleEmpty || undefined}
                aria-describedby={isTitleEmpty ? editErrorId : undefined}
                className="min-w-0 flex-1 rounded-md border border-white/25 bg-zinc-950/90 px-2 py-0.5 text-zinc-100 focus:outline-none sm:max-w-64"
              />
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                onClick={confirmEdit}
                disabled={isTitleEmpty || isSavingEdit}
                aria-busy={isSavingEdit || undefined}
                aria-label={t('api_chat_save')}
                title={t('api_chat_save')}
                className="shrink-0 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40"
              >
                {isSavingEdit ? <Loader2 className="animate-spin" /> : <Check />}
              </IconButton>
              <IconButton
                type="button"
                size="compact"
                variant="ghost"
                onClick={cancelEdit}
                aria-label={t('api_chat_cancel')}
                title={t('api_chat_cancel')}
                className="text-destructive/80 hover:bg-destructive/10 hover:text-destructive shrink-0"
              >
                <X />
              </IconButton>
            </div>
            {isTitleEmpty && (
              <span
                id={editErrorId}
                role="alert"
                className="text-destructive text-ql-11 mt-1 block"
              >
                {t('api_chat_title_required')}
              </span>
            )}
            {metadata}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(session.id)}
          aria-label={session.title}
          aria-current={isActive || undefined}
          className="focus-visible:ring-ring/70 flex min-w-0 flex-1 items-center gap-3 rounded-md pr-20 text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          {icon}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <span
                className={`text-ql-13 line-clamp-2 min-w-0 flex-1 font-semibold break-words ${isActive ? 'text-foreground' : 'text-foreground/90'}`}
              >
                {session.title}
              </span>
              {isActive && (
                <span className="text-ql-10 border-primary/20 bg-primary/10 py-0.2 text-primary flex shrink-0 items-center gap-1 rounded-full border px-2 font-semibold select-none">
                  <span className="bg-primary h-1 w-1 shrink-0 rounded-full" />
                  {t('api_chat_active_badge')}
                </span>
              )}
            </div>
            {metadata}
          </div>
        </button>
      )}

      {/* Action buttons are siblings of the selection button, never nested
          inside it: screen readers see one button to open the chat and separate
          buttons for rename/delete. */}
      <div
        className={`motion-normal absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 ${
          isActive ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {!isEditing && (
          <WithTooltip label={t('api_chat_rename_tooltip')}>
            <IconButton
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => onStartEdit(session.id, session.title)}
              disabled={isDeleting}
              className="text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10"
              aria-label={t('api_chat_rename_tooltip')}
            >
              <Pencil />
            </IconButton>
          </WithTooltip>
        )}
        <WithTooltip label={t('api_chat_delete_tooltip')}>
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => onDelete(session.id)}
            // A rename for this row is in flight: deleting it now would race
            // the write and could resurrect or lose the session.
            disabled={isDeleting || isSavingEdit}
            aria-busy={isDeleting || undefined}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
            aria-label={t('api_chat_delete_tooltip')}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </IconButton>
        </WithTooltip>
      </div>
    </div>
  )
})

export default HistorySessionItem
