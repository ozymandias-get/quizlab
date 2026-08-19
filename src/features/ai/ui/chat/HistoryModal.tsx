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

// Debounced so keystrokes don't trigger a full O(sessions × messages) scan.
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

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Debounce the search string so we don't re-run the full O(n*m) filter on
  // every keystroke. The input updates instantly for typing; the actual
  // filtering catches up ~180ms after the user stops.
  const debouncedSearch = useDebouncedValue(modalSearch, SEARCH_DEBOUNCE_MS)

  // Escape key handler + body scroll lock + dialog focus management
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Focus trap: keep Tab/Shift+Tab cycling inside the dialog panel.
      if (e.key !== 'Tab') return
      const dialogEl = dialogRef.current
      if (!dialogEl) return
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Move focus into the dialog (after layout settles).
    requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
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

  // Hooks must be unconditional and before any early return (rules-of-hooks).
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
    // Click-outside-to-close is a pointer-only convenience; keyboard users
    // close via Escape (handled above) and focus is trapped inside the panel.
    /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="z-modal bg-background/60 fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        className="border-border bg-popover text-popover-foreground shadow-ambient-xl relative flex h-[540px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        {/* Modal Header */}
        <div className="border-border bg-card/80 relative flex shrink-0 items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="border-primary/20 bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg border shadow-xs">
              <Clock className="h-4 w-4 shrink-0" />
            </div>
            <div>
              <h3 id="history-modal-title" className="text-ql-14 text-foreground font-semibold">
                {t('api_chat_modal_title')}
              </h3>
              <p className="text-ql-11 text-muted-foreground">{t('api_chat_modal_subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(t('api_chat_confirm_clear_all'))) {
                    clearAllSessions()
                    onClose()
                  }
                }}
                className="text-ql-11 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors active:scale-98"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>{t('api_chat_clear_all')}</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label={t('tab_close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="border-border bg-muted/20 shrink-0 border-b px-5 py-3">
          <div className="group/modal-search relative">
            <Input
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              placeholder={t('api_chat_modal_search_placeholder')}
              className="h-8 pl-9 text-sm"
            />
            <Search className="text-muted-foreground group-focus-within/modal-search:text-primary absolute top-2.5 left-3 h-3.5 w-3.5 transition-colors" />
          </div>
        </div>

        {/* Sessions List */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {filteredSessions.length > 0 ? (
            <div className="space-y-2">
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
            <div className="flex h-full flex-col items-center justify-center p-8 text-center select-none">
              <div className="border-border bg-muted text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-xl border">
                <CircleOff className="h-6 w-6" />
              </div>
              <h4 className="text-ql-13 text-foreground mb-1 font-semibold">
                {t('api_chat_no_results_title')}
              </h4>
              <p className="text-ql-11 text-muted-foreground max-w-xs leading-normal">
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
