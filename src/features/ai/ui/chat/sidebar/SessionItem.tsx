import { useState, useRef, useEffect } from 'react'
import { useLanguageStrings } from '@app/providers'
import type { ChatSession } from '@features/ai/store/apiChatStore'

interface SessionItemProps {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onDelete: () => void
}

export function SessionItem({ session, isActive, onSelect, onRename, onDelete }: SessionItemProps) {
  const { t } = useLanguageStrings()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [isEditing])

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditTitle(session.title)
  }

  const handleFinishRename = () => {
    if (editTitle.trim() && editTitle.trim() !== session.title) {
      onRename(editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  return (
    <div
      onClick={() => !isEditing && onSelect()}
      className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 mb-1 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-amber-500/10 border-l-[3px] border-l-amber-500 text-amber-400 font-medium shadow-sm shadow-amber-500/5'
          : 'text-white/60 hover:text-white/95 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Chat Icon */}
        <svg
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-white/30 group-hover:text-white/55 transition-colors'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={handleKeyDown}
            className="w-full bg-zinc-800 border border-amber-500/40 rounded px-1.5 py-0.5 text-ql-12 text-white outline-none focus:ring-1 focus:ring-amber-500/50"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-ql-12 truncate pr-2">{session.title}</span>
        )}
      </div>

      {/* Actions (visible on hover) */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent shrink-0">
          <button
            type="button"
            onClick={handleStartRename}
            className="p-1 rounded text-white/30 hover:text-white/80 hover:bg-white/[0.06] transition-all"
            title={t('api_chat_rename') || 'Yeniden Adlandır'}
          >
            <svg
              className="h-3 w-3"
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title={t('api_chat_delete') || 'Sil'}
          >
            <svg
              className="h-3 w-3"
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
      )}
    </div>
  )
}
