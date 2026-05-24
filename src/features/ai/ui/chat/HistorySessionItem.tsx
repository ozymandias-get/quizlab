import { useRef, useEffect } from 'react'
import { useLanguageStrings } from '@app/providers'

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

export function HistorySessionItem({
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
  const { t, language } = useLanguageStrings()
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
      onClick={() => {
        if (!isEditing) onSelect(session.id)
      }}
      className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        isActive
          ? 'bg-gradient-to-r from-amber-500/[0.08] to-amber-500/[0.02] border-amber-500/35 shadow-[0_4px_25px_rgba(245,158,11,0.08),inset_0_1px_1px_rgba(255,255,255,0.04)]'
          : 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.1] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* Elegant slide-in left accent highlight */}
      <div
        className={`absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-full bg-gradient-to-b from-amber-500 to-amber-600 transition-all duration-300 origin-center ${
          isActive
            ? 'scale-y-100 opacity-100'
            : 'scale-y-0 opacity-0 group-hover:scale-y-100 group-hover:opacity-100'
        }`}
      />

      <div className="flex items-center gap-3.5 min-w-0 flex-1 pl-1">
        {/* Icon Container */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
            isActive
              ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              : 'bg-white/[0.03] text-zinc-500 border-white/[0.04] group-hover:bg-white/[0.06] group-hover:text-amber-400/80 group-hover:border-amber-500/20'
          }`}
        >
          <svg
            className="h-4.5 w-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                ref={editInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => onEditTitleChange(e.target.value)}
                onBlur={() => onConfirmEdit(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirmEdit(session.id)
                  else if (e.key === 'Escape') onCancelEdit()
                }}
                className="bg-zinc-950/60 border border-amber-500/45 rounded-xl px-3 py-1.5 text-ql-12 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-amber-500/20 w-64 backdrop-blur-md shadow-inner transition-all"
              />
              <button
                type="button"
                onClick={() => onConfirmEdit(session.id)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/45 active:scale-95 transition-all duration-200 text-ql-11 font-medium shadow-sm"
              >
                {t('api_chat_save') || 'Kaydet'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`text-ql-13 font-semibold truncate ${isActive ? 'text-amber-400' : 'text-white/80 group-hover:text-white transition-colors duration-200'}`}
              >
                {session.title}
              </span>
              {isActive && (
                <span className="shrink-0 flex items-center gap-1 text-[9px] font-extrabold bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-400 border border-amber-500/35 px-2.5 py-0.5 rounded-full tracking-wider uppercase select-none shadow-[0_2px_8px_rgba(245,158,11,0.15)] animate-pulse">
                  <span className="h-1 w-1 rounded-full bg-amber-400 animate-ping shrink-0" />
                  {t('api_chat_active_badge') || 'Aktif'}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-ql-11 text-zinc-500 font-mono select-none">
            <span className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.04] px-2 py-0.5 rounded-md text-zinc-400">
              <svg
                className="h-3 w-3 text-zinc-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {t('api_chat_msg_count', { count: String(msgCount) }) || `${msgCount} mesaj`}
            </span>
            <span className="opacity-30">•</span>
            <span className="text-zinc-500">
              {new Date(session.updatedAt || session.createdAt).toLocaleString(
                language === 'tr' ? 'tr-TR' : 'en-US'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300 ml-4 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {!isEditing && (
          <button
            type="button"
            onClick={() => onStartEdit(session.id, session.title)}
            className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-250 active:scale-90 shadow-sm"
            title={t('api_chat_rename_tooltip') || 'Yeniden Adlandır'}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                t('api_chat_confirm_delete') || 'Bu sohbeti silmek istediğinizden emin misiniz?'
              )
            ) {
              onDelete(session.id)
            }
          }}
          className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all duration-250 active:scale-90 shadow-sm"
          title={t('api_chat_delete_tooltip') || 'Sil'}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
