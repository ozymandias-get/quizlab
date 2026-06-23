import { Input } from '@app/components/ui/input'

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

export const HistorySessionItem = memo(function HistorySessionItem({
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

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => editInputRef.current?.focus(), 50)
    }
  }, [isEditing])

  return (
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
      className={`group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border p-4 transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none ${
        isActive
          ? 'border-amber-500/35 bg-gradient-to-r from-amber-500/[0.08] to-amber-500/[0.02] shadow-[0_4px_25px_rgba(245,158,11,0.08),inset_0_1px_1px_rgba(255,255,255,0.04)]'
          : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.03] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* Elegant slide-in left accent highlight */}
      <div
        className={`absolute top-3.5 bottom-3.5 left-0 w-[3px] origin-center rounded-r-full bg-gradient-to-b from-amber-500 to-amber-600 transition-colors duration-300 ${
          isActive
            ? 'scale-y-100 opacity-100'
            : 'scale-y-0 opacity-0 group-hover:scale-y-100 group-hover:opacity-100'
        }`}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3.5 pl-1">
        {/* Icon Container */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 ${
            isActive
              ? 'border-amber-500/35 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              : 'border-white/[0.04] bg-white/[0.03] text-zinc-500 group-hover:border-amber-500/20 group-hover:bg-white/[0.06] group-hover:text-amber-400/80'
          }`}
        >
          <MessageSquare className="h-4.5 w-4.5" />
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
                className="w-64"
              />
              <button
                type="button"
                onClick={() => onConfirmEdit(session.id)}
                className="text-ql-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 shadow-sm transition-colors duration-200 hover:border-emerald-500/45 hover:bg-emerald-500/20 active:scale-95"
              >
                {t('api_chat_save')}
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`text-ql-13 truncate font-semibold ${isActive ? 'text-amber-400' : 'text-white/80 transition-colors duration-200 group-hover:text-white'}`}
              >
                {session.title}
              </span>
              {isActive && (
                <span className="text-ql-10 flex shrink-0 items-center gap-1 rounded-full border border-amber-500/35 bg-gradient-to-r from-amber-500/25 to-amber-600/15 px-2.5 py-0.5 font-extrabold tracking-wider text-amber-400 uppercase shadow-[0_2px_8px_rgba(245,158,11,0.15)] select-none">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  {t('api_chat_active_badge')}
                </span>
              )}
            </div>
          )}

          <div className="text-ql-11 mt-1.5 flex min-w-0 items-center gap-2 font-mono text-zinc-500 select-none">
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.04] bg-zinc-900/60 px-2 py-0.5 text-zinc-400">
              <MessageSquare className="h-3 w-3 shrink-0 text-zinc-500" />
              {t('api_chat_msg_count', { count: String(msgCount) })}
            </span>
            <span className="shrink-0 opacity-30">•</span>
            <span className="min-w-0 truncate text-zinc-500">
              {new Date(session.updatedAt || session.createdAt).toLocaleString(
                language === 'tr' ? 'tr-TR' : 'en-US'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons — absolute overlay to prevent metadata overflow */}
      <div
        role="presentation"
        className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 items-center gap-2 opacity-0 transition-colors duration-300 group-hover:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {!isEditing && (
          <button
            type="button"
            onClick={() => onStartEdit(session.id, session.title)}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/90 p-2 text-zinc-400 shadow-sm backdrop-blur-sm transition-colors duration-250 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-90"
            title={t('api_chat_rename_tooltip')}
            aria-label={t('api_chat_rename_tooltip')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(t('api_chat_confirm_delete'))) {
              onDelete(session.id)
            }
          }}
          className="rounded-xl border border-white/[0.06] bg-zinc-900/90 p-2 text-zinc-400 shadow-sm backdrop-blur-sm transition-colors duration-250 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none active:scale-90"
          title={t('api_chat_delete_tooltip')}
          aria-label={t('api_chat_delete_tooltip')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})
