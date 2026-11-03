import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { DialogBackdrop } from '@app/components/ui/dialog'
import { Input } from '@app/components/ui/input'
import {
  PanelHeader,
  PanelHeaderIcon,
  PanelHeaderSubtitle,
  PanelHeaderTitle
} from '@app/components/ui/panel-header'
import { useConfirmDialog, useDebouncedValue, useDialogBehavior } from '@shared/hooks'
import { useToastActions } from '@shared/stores/toastStore'
import { Button, EmptyState, IconButton } from '@shared/ui/components/primitives'

import { CircleOff, Clock, Search, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
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
  const { mutateAsync: clearAllSessions, isPending: isClearingAll } = useClearAllSessionsMutation()
  const selectSession = useChatUiStore((s) => s.setActiveSessionId)
  const { showError } = useToastActions()

  const [modalSearch, setModalSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { confirm, props: confirmProps } = useConfirmDialog()

  useDialogBehavior({ isOpen, onClose, dialogRef, initialFocusRef: closeButtonRef })

  // Every open starts clean. The parent currently unmounts the modal when it
  // closes, but that is the parent's choice: a search left behind here would
  // make the reopened list look empty.
  useEffect(() => {
    if (!isOpen) return
    setModalSearch('')
    setEditingId(null)
    setEditTitle('')
  }, [isOpen])

  // Debounce the search string so we don't re-run the filter on every
  // keystroke. The input updates instantly for typing; the actual filtering
  // catches up ~180ms after the user stops.
  const debouncedSearch = useDebouncedValue(modalSearch, SEARCH_DEBOUNCE_MS)

  /**
   * Lowercased haystacks, built once per session list instead of once per
   * keystroke. `toLowerCase()` on every message for every query was the real
   * O(n*m) cost; the scan itself stays synchronous because chat archives are
   * small and a worker would add more latency than it saves.
   */
  const searchIndex = useMemo(
    () =>
      sessions.map((session) => ({
        session,
        title: session.title.toLowerCase(),
        contents: session.messages.map((message) => message.content.toLowerCase())
      })),
    [sessions]
  )

  const filteredSessions = useMemo(() => {
    if (!isOpen) return []
    const query = debouncedSearch.trim().toLowerCase()
    if (!query) return sessions
    return searchIndex
      .filter(
        (entry) =>
          entry.title.includes(query) || entry.contents.some((content) => content.includes(query))
      )
      .map((entry) => entry.session)
  }, [isOpen, sessions, searchIndex, debouncedSearch])

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

  /** Wait for the wipe before closing: a failure must stay visible. */
  const handleClearAll = useCallback(async () => {
    const confirmed = await confirm({
      title: t('api_chat_confirm_clear_all'),
      variant: 'destructive'
    })
    if (!confirmed) return

    try {
      await clearAllSessions()
      onClose()
    } catch (error) {
      showError(
        t('api_chat_clear_all_failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }, [clearAllSessions, confirm, onClose, showError, t])

  if (!isOpen) return null

  return (
    <>
      <DialogBackdrop onClick={onClose}>
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.14 }}
          className="border-border bg-popover text-popover-foreground shadow-ambient-xl relative flex h-[540px] max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border"
          onClick={(e) => e.stopPropagation()}
        >
          <PanelHeader>
            <div className="flex items-center gap-3">
              <PanelHeaderIcon>
                <Clock className="h-4 w-4 shrink-0" />
              </PanelHeaderIcon>
              <div>
                <PanelHeaderTitle id="history-modal-title">
                  {t('api_chat_modal_title')}
                </PanelHeaderTitle>
                <PanelHeaderSubtitle>{t('api_chat_modal_subtitle')}</PanelHeaderSubtitle>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessions.length > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleClearAll()}
                  disabled={isClearingAll}
                  className="text-ql-11 active:scale-98"
                >
                  <Trash2 />
                  <span>{t('api_chat_clear_all')}</span>
                </Button>
              )}
              <IconButton
                ref={closeButtonRef}
                type="button"
                variant="outline"
                size="compact"
                onClick={onClose}
                className="text-muted-foreground"
                aria-label={t('tab_close')}
              >
                <X />
              </IconButton>
            </div>
          </PanelHeader>

          {/* Search Input */}
          <div className="border-border bg-muted/20 shrink-0 border-b px-5 py-3">
            <div className="group/modal-search relative">
              <Input
                ref={searchInputRef}
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder={t('api_chat_modal_search_placeholder')}
                className="text-ql-14 pr-9 pl-9"
                data-testid="history-search-input"
              />
              <Search className="text-muted-foreground group-focus-within/modal-search:text-primary absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
              {modalSearch && (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => {
                    setModalSearch('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label={t('api_chat_clear_search')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
                  data-testid="history-search-clear"
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              )}
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
              <EmptyState
                icon={CircleOff}
                title={t('api_chat_no_results_title')}
                description={
                  modalSearch ? t('api_chat_no_search_results') : t('api_chat_no_history_yet')
                }
                className="h-full"
              />
            )}
          </div>
        </motion.div>
      </DialogBackdrop>
      <ConfirmDialog {...confirmProps} />
    </>
  )
})

HistoryModal.displayName = 'HistoryModal'

export default HistoryModal
