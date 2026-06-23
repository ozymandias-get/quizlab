import { Input } from '@app/components/ui/input'
import { useDebouncedValue } from '@shared/hooks'

import { CircleOff, Clock, Search, Trash2, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearAllSessionsMutation,
  useDeleteSessionMutation,
  useRenameSessionMutation,
  useSessionsQuery
} from '../../queries/useSessionsQuery'
import { useChatUiStore } from '../../store/chatUiStore'
import HistorySessionItem from './HistorySessionItem'

// Search debounce: each keystroke would otherwise trigger a full scan over
// every session's messages, which is O(sessions × messages-per-session) —
// prohibitive for users with a long history.
const SEARCH_DEBOUNCE_MS = 180

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  tabId: string
}

const HistoryModal = memo(function HistoryModal({ isOpen, onClose, tabId }: HistoryModalProps) {
  const { t } = useTranslation()
  const { data: sessions = [] } = useSessionsQuery()
  const activeSessionId = useChatUiStore((s) => s.activeSessionIdByTab[tabId])
  const { mutate: deleteSession } = useDeleteSessionMutation()
  const { mutate: renameSession } = useRenameSessionMutation()
  const { mutate: clearAllSessions } = useClearAllSessionsMutation()
  const selectSession = useChatUiStore((s) => s.setActiveSessionId)

  const [modalSearch, setModalSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Debounce the search string so we don't re-run the full O(n*m) filter on
  // every keystroke. The input updates instantly for typing; the actual
  // filtering catches up ~180ms after the user stops.
  const debouncedSearch = useDebouncedValue(modalSearch, SEARCH_DEBOUNCE_MS)

  // Escape key handler + body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          s.messages.some((m) => m.content.toLowerCase().includes(debouncedSearch.toLowerCase()))
      ),
    [sessions, debouncedSearch]
  )

  // Hooks MUST be declared unconditionally and BEFORE any early return.
  // If we return early for !isOpen before useRef/useCallback, React will
  // see a different number of hooks on the next render and throw:
  //   "Rendered more hooks than during the previous render"
  // See: https://react.dev/link/rules-of-hooks

  // Stable refs for values that change frequently so callbacks don't churn
  // every render (which would defeat HistorySessionItem's memo).
  const editTitleRef = useRef(editTitle)
  editTitleRef.current = editTitle
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const handleStartEdit = useCallback((sessionId: string, currentTitle: string) => {
    setEditingId(sessionId)
    setEditTitle(currentTitle)
  }, [])

  const handleConfirmEdit = useCallback(
    (sessionId: string) => {
      const title = editTitleRef.current.trim()
      if (title) renameSession({ sessionId, title })
      setEditingId(null)
    },
    [renameSession]
  )

  const handleCancelEdit = () => setEditingId(null)

  // Per-row handlers (id is provided by the child, tabId via ref so the
  // callback reference is stable across re-renders triggered by editTitle
  // typing or other state).
  const handleSelect = useCallback(
    (id: string) => {
      selectSession(tabIdRef.current, id)
      onClose()
    },
    [selectSession, onClose]
  )

  const handleDelete = useCallback((id: string) => deleteSession(id), [deleteSession])

  if (!isOpen) return null

  return (
    <div
      className="z-modal animate-fade-in fixed inset-0 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-md"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {/* Modal Backdrop Subtle Golden Halo */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[130px]" />

      <div
        role="presentation"
        className="animate-scale-in relative flex h-[560px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.08] border-t-amber-500/30 bg-gradient-to-b from-zinc-900/95 to-zinc-950/99 shadow-[0_25px_65px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-950/40 px-6 py-5">
          <div className="absolute right-0 bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />

          <div className="flex items-center gap-3.5">
            <div className="group/modal-logo relative flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-amber-500/[0.02] shadow-[0_0_15px_rgba(245,158,11,0.12)]">
              <Clock className="h-5 w-5 shrink-0 text-amber-500" />
            </div>
            <div>
              <h3 className="text-ql-15 bg-gradient-to-r from-white to-zinc-300 bg-clip-text font-bold tracking-tight text-transparent">
                {t('api_chat_modal_title')}
              </h3>
              <p className="text-ql-11 mt-0.5 font-normal text-zinc-500">
                {t('api_chat_modal_subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(t('api_chat_confirm_clear_all'))) {
                    clearAllSessions()
                    onClose()
                  }
                }}
                className="text-ql-11 flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-semibold text-red-400 shadow-[0_2px_10px_rgba(239,68,68,0.1)] transition-colors duration-350 hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300 active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>{t('api_chat_clear_all')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400 shadow-sm transition-colors duration-300 hover:rotate-90 hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-90"
              aria-label={t('tab_close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/20 px-6 py-4.5">
          <div className="group/modal-search relative">
            <Input
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              placeholder={t('api_chat_modal_search_placeholder')}
              className="pl-11"
            />
            <Search className="absolute top-3.5 left-4 h-4 w-4 transform-gpu text-zinc-500 transition-colors duration-300 will-change-transform group-focus-within/modal-search:scale-110 group-focus-within/modal-search:text-amber-500" />
          </div>
        </div>

        {/* Sessions List */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-zinc-950/5 p-6">
          {filteredSessions.length > 0 ? (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <HistorySessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  tabId={tabId}
                  editingId={editingId}
                  editTitle={session.id === editingId ? editTitle : ''}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onStartEdit={handleStartEdit}
                  onEditTitleChange={setEditTitle}
                  onCancelEdit={handleCancelEdit}
                  onConfirmEdit={handleConfirmEdit}
                />
              ))}
            </div>
          ) : (
            <div className="animate-fade-in flex h-full flex-col items-center justify-center p-8 text-center select-none">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] text-white/20">
                <CircleOff className="h-8 w-8 text-zinc-600" />
              </div>
              <h4 className="text-ql-13 mb-1 font-bold text-white/60">
                {t('api_chat_no_results_title')}
              </h4>
              <p className="text-ql-11 max-w-xs leading-normal text-zinc-500">
                {modalSearch ? t('api_chat_no_search_results') : t('api_chat_no_history_yet')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

HistoryModal.displayName = 'HistoryModal'

export default HistoryModal
