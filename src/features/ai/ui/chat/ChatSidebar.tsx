import { useState, useMemo } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useApiChatStore, type ChatSession } from '@features/ai/store/apiChatStore'
import { SessionItem } from './sidebar'

interface ChatSidebarProps {
  tabId: string
  isOpen: boolean
  onToggle: () => void
}

export function ChatSidebar({ tabId, isOpen, onToggle }: ChatSidebarProps) {
  const { t } = useLanguageStrings()
  const sessions = useApiChatStore((s) => s.sessions)
  const activeSessionId = useApiChatStore((s) => s.activeSessionIdByTab[tabId])
  const createSession = useApiChatStore((s) => s.createSession)
  const selectSession = useApiChatStore((s) => s.selectSession)
  const deleteSession = useApiChatStore((s) => s.deleteSession)
  const renameSession = useApiChatStore((s) => s.renameSession)

  const [searchQuery, setSearchQuery] = useState('')

  const handleDelete = (sessionId: string) => {
    if (confirm(t('api_chat_delete_confirm') || 'Bu sohbeti silmek istediğinizden emin misiniz?')) {
      deleteSession(tabId, sessionId)
    }
  }

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [sessions, searchQuery])

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const today: ChatSession[] = []
    const yesterday: ChatSession[] = []
    const last7Days: ChatSession[] = []
    const older: ChatSession[] = []

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
    const startOfLast7Days = startOfToday - 7 * 24 * 60 * 60 * 1000

    filteredSessions.forEach((session) => {
      const time = session.updatedAt || session.createdAt
      if (time >= startOfToday) {
        today.push(session)
      } else if (time >= startOfYesterday) {
        yesterday.push(session)
      } else if (time >= startOfLast7Days) {
        last7Days.push(session)
      } else {
        older.push(session)
      }
    })

    return {
      today,
      yesterday,
      last7Days,
      older
    }
  }, [filteredSessions])

  const renderGroup = (title: string, list: ChatSession[]) => {
    if (list.length === 0) return null
    return (
      <div className="mb-4 animate-app-enter">
        <div className="px-3 mb-1.5 text-ql-10 font-bold uppercase tracking-wider text-white/20">
          {title}
        </div>
        <div>
          {list.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() => selectSession(tabId, session.id)}
              onRename={(title) => renameSession(session.id, title)}
              onDelete={() => handleDelete(session.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`shrink-0 flex flex-col h-full border-r border-white/[0.06] bg-zinc-950/65 backdrop-blur-xl transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-3 shrink-0 flex items-center gap-2 border-b border-white/[0.06] bg-zinc-950/20">
        <button
          type="button"
          onClick={() => createSession(tabId)}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 font-medium py-2 px-3 text-ql-12 hover:from-amber-500/25 hover:to-amber-600/15 transition-all shadow-sm shadow-amber-500/5 hover:shadow-md hover:shadow-amber-500/10 active:scale-[0.98]"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('api_chat_new_chat') || 'Yeni Sohbet'}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
          title={t('api_chat_hide_sidebar') || 'Menüyü Gizle'}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <path d="M16 15l-3-3 3-3" />
          </svg>
        </button>
      </div>

      {/* Search Container */}
      <div className="p-3 shrink-0">
        <div className="relative group/search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('api_chat_search') || 'Sohbetlerde ara...'}
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-8.5 pr-3.5 py-1.5 text-ql-12 text-white placeholder-white/20 outline-none transition-all focus:border-amber-500/20 focus:bg-amber-500/[0.02] focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
          />
          <svg
            className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/20 group-focus-within/search:text-amber-500/50 transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Scrollable Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
        {filteredSessions.length > 0 ? (
          <>
            {renderGroup(t('api_chat_today') || 'Bugün', groupedSessions.today)}
            {renderGroup(t('api_chat_yesterday') || 'Dün', groupedSessions.yesterday)}
            {renderGroup(t('api_chat_last_7_days') || 'Son 7 Gün', groupedSessions.last7Days)}
            {renderGroup(t('api_chat_older') || 'Daha Eski', groupedSessions.older)}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center select-none animate-app-enter">
            <svg
              className="h-8 w-8 text-white/10 mb-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <span className="text-ql-11 text-white/20 font-medium">
              {searchQuery
                ? t('api_chat_no_results') || 'Eşleşen sohbet bulunamadı'
                : t('api_chat_no_chats') || 'Sohbet geçmişi boş'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
