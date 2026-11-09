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

import { CircleOff, Clock, Loader2, Search, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearAllSessionsMutation,
  useDeleteSessionMutation,
  useRenameSessionMutation,
  useSessionsQuery
} from '../../queries/useSessionsQuery'
import { useChatUiStore } from '../../store/chatUiStore'
import {
  buildRowLayout,
  findFirstRowAfter,
  findFirstVisibleRow,
  LIST_FALLBACK_HEIGHT,
  LIST_OVERSCAN,
  LIST_ROW_GAP,
  LIST_ROW_HEIGHT
} from './historyListVirtualization'
import HistorySessionItem from './HistorySessionItem'
import { useHistoryListKeyboard } from './useHistoryListKeyboard'

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
  const { mutateAsync: deleteSession } = useDeleteSessionMutation()
  const { mutateAsync: renameSession } = useRenameSessionMutation()
  const { mutateAsync: clearAllSessions, isPending: isClearingAll } = useClearAllSessionsMutation()
  const selectSession = useChatUiStore((s) => s.setActiveSessionId)
  const { showError } = useToastActions()

  const [modalSearch, setModalSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [editingRowHeight, setEditingRowHeight] = useState(LIST_ROW_HEIGHT)
  // Normal rows grow with the text scale/localisation. A single measured base
  // keeps virtualization offsets uniform while still avoiding clipped content.
  const [baseRowHeight, setBaseRowHeight] = useState(LIST_ROW_HEIGHT)

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const editingRowObserverRef = useRef<ResizeObserver | null>(null)
  // Sessions whose confirmation dialog is already open. The lock has to exist
  // before `await confirm(...)`, because two rapid clicks would otherwise open
  // two dialogs for the same row.
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set())

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
    setEditingRowHeight(LIST_ROW_HEIGHT)
    setBaseRowHeight(LIST_ROW_HEIGHT)
  }, [isOpen])

  // The editor is the only row whose height can change (the inline validation
  // error and the metadata block can wrap). Measure it instead of assuming the
  // fixed stride, otherwise every row below it is positioned at the wrong
  // offset while editing.
  const measureEditingRow = useCallback((element: HTMLDivElement | null) => {
    editingRowObserverRef.current?.disconnect()
    editingRowObserverRef.current = null
    if (!element) return

    const measure = () => {
      const height = element.getBoundingClientRect().height
      if (height <= 0) return
      setEditingRowHeight((previous) => (Math.abs(previous - height) < 0.5 ? previous : height))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    editingRowObserverRef.current = observer
  }, [])

  useEffect(() => () => editingRowObserverRef.current?.disconnect(), [])

  // Debounce the search string so we don't re-run the filter on every
  // keystroke. The input updates instantly for typing; the actual filtering
  // catches up ~180ms after the user stops.
  const debouncedSearch = useDebouncedValue(modalSearch, SEARCH_DEBOUNCE_MS)

  // Keep the window size in sync with the actual scroll container. jsdom (and
  // the first render before layout) reports 0, so the range calculation falls
  // back to a sensible viewport height instead of rendering nothing.
  useEffect(() => {
    if (!isOpen) return
    const element = listRef.current
    if (!element) return

    const syncHeight = () => setViewportHeight(element.clientHeight)
    syncHeight()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(syncHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isOpen])

  // A new filter starts at the top: keeping the old scroll offset could leave
  // the shortened result list showing blank space.
  useEffect(() => {
    if (!isOpen) return
    const element = listRef.current
    if (element) element.scrollTop = 0
    setScrollTop(0)
  }, [isOpen, debouncedSearch])

  const isSearchActive = debouncedSearch.trim().length > 0

  /**
   * Lowercased haystacks are only built while a search is active. Opening the
   * history to browse therefore costs no extra string memory, and clearing the
   * query releases the index instead of keeping a second copy of every message
   * alive for the lifetime of the modal. While searching, the index is built
   * once per session-list change, not once per keystroke.
   */
  const searchIndex = useMemo(() => {
    if (!isOpen || !isSearchActive) return null
    return sessions.map((session) => ({
      session,
      title: session.title.toLowerCase(),
      contents: session.messages.map((message) => message.content.toLowerCase())
    }))
  }, [isOpen, isSearchActive, sessions])

  const filteredSessions = useMemo(() => {
    if (!isOpen) return []
    const query = debouncedSearch.trim().toLowerCase()
    if (!query) return sessions
    if (!searchIndex) return []
    return searchIndex
      .filter(
        (entry) =>
          entry.title.includes(query) || entry.contents.some((content) => content.includes(query))
      )
      .map((entry) => entry.session)
  }, [isOpen, sessions, searchIndex, debouncedSearch])

  // A search must not destroy an unsaved title. The draft stays in state even
  // when the edited row is filtered out; the editor simply reappears with the
  // same text once the filter is cleared again.
  const editingSessionIsFilteredOut =
    editingId !== null && !filteredSessions.some((session) => session.id === editingId)

  // Uniform rows keep the common case cheap; the single editing row uses its
  // measured height. Prefix offsets let the virtual window and the spacers stay
  // correct when that row grows or shrinks.
  const rowLayout = useMemo(
    () => buildRowLayout(filteredSessions, editingId, editingRowHeight, baseRowHeight),
    [filteredSessions, editingId, editingRowHeight, baseRowHeight]
  )

  const virtualRows = useMemo(() => {
    const total = filteredSessions.length
    if (total === 0) return { start: 0, end: 0, top: 0, bottom: 0 }

    const { offsets, totalHeight } = rowLayout
    const height = viewportHeight > 0 ? viewportHeight : LIST_FALLBACK_HEIGHT

    const firstVisible = findFirstVisibleRow(offsets, total, scrollTop)
    const lastVisible = findFirstRowAfter(offsets, total, firstVisible, scrollTop + height)

    // A shrinking list (delete, external clear) must never leave every row
    // outside the window while the scroll offset is still catching up.
    const start = Math.min(total - 1, Math.max(0, firstVisible - LIST_OVERSCAN))
    const end = Math.min(total, Math.max(start + 1, lastVisible + LIST_OVERSCAN))

    return {
      start,
      end,
      top: offsets[start],
      bottom: totalHeight - offsets[end]
    }
  }, [filteredSessions.length, rowLayout, scrollTop, viewportHeight])

  // Measure the rendered rows once fonts/layout settle. If a localization or a
  // large text scale makes a normal row taller, every virtual offset adopts the
  // tallest measured height so rows no longer overlap or clip.
  useLayoutEffect(() => {
    if (!isOpen) return
    const list = listRef.current
    if (!list) return

    let tallest = 0
    for (const row of list.querySelectorAll<HTMLElement>(
      '[data-history-row]:not([data-history-editing])'
    )) {
      tallest = Math.max(tallest, row.getBoundingClientRect().height)
    }

    if (tallest > baseRowHeight + 0.5) setBaseRowHeight(Math.ceil(tallest))
  }, [baseRowHeight, filteredSessions, isOpen, virtualRows.start, virtualRows.end])

  // Keep the scroll state in sync after the list shrinks (e.g. deleting rows
  // near the bottom). Without this the browser clamps scrollTop but our state
  // still points past the new maximum until the next scroll event.
  useEffect(() => {
    if (!isOpen) return
    const element = listRef.current
    if (!element) return

    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
    if (element.scrollTop > maxScrollTop) {
      element.scrollTop = maxScrollTop
      setScrollTop(maxScrollTop)
    }
  }, [filteredSessions.length, editingRowHeight, baseRowHeight, isOpen, viewportHeight])

  // Hooks must be unconditional and before any early return (rules-of-hooks).
  const editTitleRef = useRef(editTitle)
  editTitleRef.current = editTitle
  const editingIdRef = useRef(editingId)
  editingIdRef.current = editingId
  const renamingRef = useRef(false)
  const renamingIdRef = useRef<string | null>(null)
  renamingIdRef.current = renamingId
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const handleStartEdit = useCallback(
    (sessionId: string, currentTitle: string) => {
      // A rename that is still in flight owns the draft. Opening a second editor
      // now would let the first request's completion clear the new draft.
      if (renamingRef.current) return

      // Start from the current uniform height; the row's real height is measured
      // during commit and replaces this estimate before the observer takes over.
      setEditingRowHeight(baseRowHeight)
      setEditingId(sessionId)
      setEditTitle(currentTitle)
    },
    [baseRowHeight]
  )

  const handleConfirmEdit = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const title = editTitleRef.current.trim()
      // Empty titles never close the editor: the inline error in the row
      // explains what is missing and the save button stays disabled.
      if (!title || renamingRef.current) return false

      renamingRef.current = true
      setRenamingId(sessionId)
      try {
        await renameSession({ sessionId, title })
        if (editingIdRef.current === sessionId) {
          setEditingId(null)
          setEditTitle('')
        }
        return true
      } catch (error) {
        showError(
          t('api_chat_rename_failed', {
            error: error instanceof Error ? error.message : String(error)
          })
        )
        // Keep both the editor and the typed draft so the user can retry.
        return false
      } finally {
        renamingRef.current = false
        setRenamingId(null)
      }
    },
    [renameSession, showError, t]
  )

  const handleCancelEdit = () => setEditingId(null)

  const handleSelect = useCallback(
    (id: string) => {
      selectSession(tabIdRef.current, id)
      onClose()
    },
    [selectSession, onClose]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      // Rename and delete for the same session must never be in flight at the
      // same time; the row disables its delete button while saving, and this
      // guard covers programmatic callers too.
      if (renamingIdRef.current === id) return
      // The lock is taken before the dialog opens, so a second click (or a
      // programmatic replay) cannot stack a second confirmation on top.
      if (pendingDeleteIdsRef.current.has(id)) return
      pendingDeleteIdsRef.current.add(id)

      try {
        const confirmed = await confirm({
          title: t('api_chat_confirm_delete'),
          variant: 'destructive'
        })
        if (!confirmed) return

        setDeletingIds((current) => new Set(current).add(id))
        try {
          await deleteSession(id)
        } catch (error) {
          showError(
            t('api_chat_delete_failed', {
              error: error instanceof Error ? error.message : String(error)
            })
          )
        } finally {
          setDeletingIds((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
          })
        }
      } finally {
        pendingDeleteIdsRef.current.delete(id)
      }
    },
    [confirm, deleteSession, showError, t]
  )

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

  const renderSessionRow = (
    session: (typeof filteredSessions)[number],
    index: number,
    absoluteTop?: number
  ) => {
    const isEditing = session.id === editingId
    return (
      <div
        key={session.id}
        ref={isEditing ? measureEditingRow : undefined}
        data-history-row=""
        data-history-editing={isEditing ? '' : undefined}
        data-history-row-index={index}
        data-history-session-id={session.id}
        className={absoluteTop === undefined ? 'mb-2' : 'absolute right-0 left-0 z-10 mb-2'}
        style={
          absoluteTop === undefined
            ? isEditing
              ? { minHeight: Math.max(baseRowHeight, editingRowHeight) }
              : { minHeight: baseRowHeight }
            : { top: absoluteTop }
        }
      >
        <HistorySessionItem
          session={session}
          isActive={session.id === activeSessionId}
          isDeleting={deletingIds.has(session.id)}
          tabId={tabId}
          editingId={editingId}
          editTitle={session.id === editingId ? editTitle : ''}
          isSavingEdit={renamingId === session.id}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onStartEdit={handleStartEdit}
          onEditTitleChange={setEditTitle}
          onCancelEdit={handleCancelEdit}
          onConfirmEdit={handleConfirmEdit}
        />
      </div>
    )
  }

  const isSearchPending = modalSearch !== debouncedSearch
  const editingSession =
    rowLayout.editingIndex >= 0 ? filteredSessions[rowLayout.editingIndex] : undefined

  useHistoryListKeyboard({
    isOpen,
    listRef,
    sessions: filteredSessions,
    offsets: rowLayout.offsets,
    windowStart: virtualRows.start,
    windowEnd: virtualRows.end,
    editingId,
    onScrollTopChange: setScrollTop
  })

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

          {editingSessionIsFilteredOut && (
            <div
              role="status"
              className="border-border bg-muted/20 text-muted-foreground flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2"
            >
              <span className="text-ql-11">{t('api_chat_edit_hidden_by_search')}</span>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => {
                  setModalSearch('')
                  searchInputRef.current?.focus()
                }}
                className="text-ql-11 shrink-0 font-semibold"
              >
                {t('api_chat_clear_search')}
              </Button>
            </div>
          )}

          {/* Sessions List */}
          <div
            ref={listRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            aria-busy={isSearchPending || undefined}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4"
          >
            {filteredSessions.length > 0 ? (
              <div className="relative">
                {virtualRows.top > 0 && (
                  <div aria-hidden="true" style={{ height: virtualRows.top }} />
                )}
                {filteredSessions
                  .slice(virtualRows.start, virtualRows.end)
                  .map((session, sliceIndex) => {
                    const index = virtualRows.start + sliceIndex
                    if (session.id === editingId) {
                      // Reserve the editor's layout slot here; the real row is
                      // rendered once below so scrolling cannot remount it.
                      return (
                        <div
                          key={`editing-slot-${session.id}`}
                          aria-hidden="true"
                          style={{
                            height: Math.max(baseRowHeight, editingRowHeight) + LIST_ROW_GAP
                          }}
                        />
                      )
                    }
                    return renderSessionRow(session, index)
                  })}
                {virtualRows.bottom > 0 && (
                  <div aria-hidden="true" style={{ height: virtualRows.bottom }} />
                )}
                {/* The row being edited always lives outside the virtual slice.
                    It stays mounted while scrolling (keeping draft, focus and
                    validation state) and is positioned over its reserved slot. */}
                {editingSession &&
                  renderSessionRow(
                    editingSession,
                    rowLayout.editingIndex,
                    rowLayout.offsets[rowLayout.editingIndex]
                  )}
              </div>
            ) : isSearchPending ? (
              <div
                role="status"
                aria-live="polite"
                className="text-muted-foreground flex h-full items-center justify-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-ql-13">{t('api_chat_searching')}</span>
              </div>
            ) : (
              <EmptyState
                icon={CircleOff}
                title={t('api_chat_no_results_title')}
                description={
                  debouncedSearch.trim()
                    ? t('api_chat_no_search_results')
                    : t('api_chat_no_history_yet')
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
