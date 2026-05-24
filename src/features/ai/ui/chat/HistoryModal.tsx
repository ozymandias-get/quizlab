import { useState, useEffect, useMemo } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useApiChatStore } from '@features/ai/store/apiChatStore'
import { HistorySessionItem } from './HistorySessionItem'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  tabId: string
}

export function HistoryModal({ isOpen, onClose, tabId }: HistoryModalProps) {
  const { t } = useLanguageStrings()
  const sessions = useApiChatStore((s) => s.sessions)
  const activeSessionId = useApiChatStore((s) => s.activeSessionIdByTab[tabId])
  const selectSession = useApiChatStore((s) => s.selectSession)
  const deleteSession = useApiChatStore((s) => s.deleteSession)
  const renameSession = useApiChatStore((s) => s.renameSession)
  const clearAllSessions = useApiChatStore((s) => s.clearAllSessions)

  const [modalSearch, setModalSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(modalSearch.toLowerCase()) ||
          s.messages.some((m) => m.content.toLowerCase().includes(modalSearch.toLowerCase()))
      ),
    [sessions, modalSearch]
  )

  if (!isOpen) return null

  const handleStartEdit = (sessionId: string, currentTitle: string) => {
    setEditingId(sessionId)
    setEditTitle(currentTitle)
  }

  const handleConfirmEdit = (sessionId: string) => {
    if (editTitle.trim()) renameSession(sessionId, editTitle.trim())
    setEditingId(null)
  }

  const handleCancelEdit = () => setEditingId(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      {/* Modal Backdrop Subtle Golden Halo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-amber-500/[0.06] blur-[130px] rounded-full pointer-events-none" />

      <div
        className="relative w-full max-w-2xl h-[560px] flex flex-col rounded-3xl border border-white/[0.08] border-t-amber-500/30 bg-gradient-to-b from-zinc-900/95 to-zinc-950/99 backdrop-blur-3xl shadow-[0_25px_65px_rgba(0,0,0,0.9)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 shrink-0 flex items-center justify-between border-b border-white/[0.06] bg-zinc-950/40 relative">
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />

          <div className="flex items-center gap-3.5">
            <div className="relative group/modal-logo flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/[0.02] border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.12)]">
              <svg
                className="h-5 w-5 text-amber-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="text-ql-15 font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent tracking-tight">
                {t('api_chat_modal_title') || 'Sohbet Geçmişi'}
              </h3>
              <p className="text-ql-11 text-zinc-500 mt-0.5 font-normal">
                {t('api_chat_modal_subtitle') || 'Tüm geçmiş sohbetlerinizi yönetin ve arayın'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      t('api_chat_confirm_clear_all') ||
                        'Tüm sohbet geçmişiniz kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?'
                    )
                  ) {
                    clearAllSessions(tabId)
                    onClose()
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/50 px-4 py-2 text-ql-11 font-semibold text-red-400 hover:text-red-300 transition-all duration-350 active:scale-95 shadow-[0_2px_10px_rgba(239,68,68,0.1)] cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>{t('api_chat_clear_all') || 'Tümünü Temizle'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white hover:border-white/[0.2] hover:bg-white/[0.08] transition-all duration-300 hover:rotate-90 active:scale-90 cursor-pointer shadow-sm"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4.5 shrink-0 border-b border-white/[0.06] bg-zinc-950/20">
          <div className="relative group/modal-search">
            <input
              type="text"
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              placeholder={
                t('api_chat_modal_search_placeholder') ||
                'Başlıklarda veya mesaj içeriklerinde arayın...'
              }
              className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/40 pl-11 pr-4 py-2.5 text-ql-12 text-zinc-200 placeholder-zinc-500/80 outline-none transition-all duration-300 focus:border-amber-500/55 focus:bg-zinc-950/70 focus:shadow-[0_0_20px_rgba(245,158,11,0.06)]"
            />
            <svg
              className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500 group-focus-within/modal-search:text-amber-500 group-focus-within/modal-search:scale-110 transition-all duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-950/5">
          {filteredSessions.length > 0 ? (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <HistorySessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  tabId={tabId}
                  editingId={editingId}
                  editTitle={editTitle}
                  onSelect={(id) => {
                    selectSession(tabId, id)
                    onClose()
                  }}
                  onDelete={(id) => deleteSession(tabId, id)}
                  onStartEdit={handleStartEdit}
                  onEditTitleChange={setEditTitle}
                  onCancelEdit={handleCancelEdit}
                  onConfirmEdit={handleConfirmEdit}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none animate-fade-in">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4 text-white/20">
                <svg
                  className="h-8 w-8 text-zinc-600 animate-pulse"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <h4 className="text-ql-13 font-bold text-white/60 mb-1">
                {t('api_chat_no_results_title') || 'Sohbet Bulunamadı'}
              </h4>
              <p className="text-ql-11 text-zinc-500 max-w-xs leading-normal">
                {modalSearch
                  ? t('api_chat_no_search_results') ||
                    'Arama kriterlerinize uyan bir sohbet bulunamadı.'
                  : t('api_chat_no_history_yet') || 'Henüz hiç sohbet geçmişiniz bulunmuyor.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
