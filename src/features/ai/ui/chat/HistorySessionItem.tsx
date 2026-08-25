import { Button } from '@app/components/ui/button'
import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { WithTooltip } from '@app/components/ui/tooltip'
import { FOCUS_DEFER_MS } from '@shared/constants/timingConstants'
import { useConfirmDialog } from '@shared/hooks'

import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Session {
  id: string
  title: string
  messages: { content: string }[]
  updatedAt?: number
  createdAt: number
}

interface HistorySessionItemProps {
  session: Session
  isActive: boolean
  tabId: string
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  editingId: string | null
  editTitle: string
  onStartEdit: (sessionId: string, currentTitle: string) => void
  onEditTitleChange: (title: string) => void
  onCancelEdit: () => void
  onConfirmEdit: (sessionId: string) => void
}

const HistorySessionItem = memo(function HistorySessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  editingId,
  editTitle,
  onStartEdit,
  onEditTitleChange,
  onCancelEdit,
  onConfirmEdit
}: HistorySessionItemProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const editInputRef = useRef<HTMLInputElement>(null)
  const isEditing = session.id === editingId
  const msgCount = session.messages.length

  const { confirm, props: confirmProps } = useConfirmDialog()

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => editInputRef.current?.focus(), FOCUS_DEFER_MS)
    }
  }, [isEditing])

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isEditing) onSelect(session.id)
        }}
        onKeyDown={(e) => {
          if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onSelect(session.id)
          }
        }}
        className={`group focus-visible:ring-ring/40 motion-normal relative flex cursor-pointer items-center justify-between overflow-hidden rounded-lg border p-3 shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          isActive
            ? 'border-ring/60 bg-accent/20'
            : 'border-border bg-card hover:border-border hover:bg-muted/60'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Icon Container */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
              isActive
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/60 bg-muted/60 text-muted-foreground group-hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div
                role="presentation"
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Input
                  ref={editInputRef}
                  value={editTitle}
                  onChange={(e) => onEditTitleChange(e.target.value)}
                  onBlur={() => onConfirmEdit(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmEdit(session.id)
                    else if (e.key === 'Escape') onCancelEdit()
                  }}
                  size="sm"
                  className="w-64"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onConfirmEdit(session.id)}
                  className="text-ql-11"
                >
                  {t('api_chat_save')}
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`text-ql-13 truncate font-semibold ${isActive ? 'text-foreground font-bold' : 'text-foreground/90'}`}
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
            )}

            <div className="text-ql-11 text-muted-foreground mt-1 flex min-w-0 items-center gap-2 select-none">
              <span className="border-border/60 bg-muted/30 flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5">
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
          </div>
        </div>

        {/* Action Buttons */}
        <div
          role="presentation"
          className="motion-normal absolute top-1/2 right-3 z-10 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {!isEditing && (
            <WithTooltip label={t('api_chat_rename_tooltip')}>
              <IconButton
                type="button"
                variant="outline"
                size="compact"
                onClick={() => onStartEdit(session.id, session.title)}
                className="text-muted-foreground"
                aria-label={t('api_chat_rename_tooltip')}
              >
                <Pencil />
              </IconButton>
            </WithTooltip>
          )}
          <WithTooltip label={t('api_chat_delete_tooltip')}>
            <IconButton
              type="button"
              variant="outline"
              size="compact"
              onClick={async () => {
                if (
                  await confirm({ title: t('api_chat_confirm_delete'), variant: 'destructive' })
                ) {
                  onDelete(session.id)
                }
              }}
              className="text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
              aria-label={t('api_chat_delete_tooltip')}
            >
              <Trash2 />
            </IconButton>
          </WithTooltip>
        </div>
      </div>
      <ConfirmDialog {...confirmProps} />
    </>
  )
})

export default HistorySessionItem
