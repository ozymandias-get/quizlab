import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { DialogBackdrop } from '@app/components/ui/dialog'
import {
  PanelHeader,
  PanelHeaderIcon,
  PanelHeaderSubtitle,
  PanelHeaderTitle
} from '@app/components/ui/panel-header'
import { useConfirmDialog, useDebouncedValue, useDialogBehavior } from '@shared/hooks'
import { DURATION } from '@shared/lib/motion'
import { useToastActions } from '@shared/stores/toastStore'
import { Button, EmptyState, IconButton } from '@shared/ui/components/primitives'

import { CircleOff, Clock, Loader2, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearAllSessionsMutation,
  useDeleteSessionMutation,
  useRenameSessionMutation,
  useSessionsQuery
} from '../../queries/useSessionsQuery'
import type { ChatSession } from '../../store/apiChatSessionUtils'
import { useChatUiStore } from '../../store/chatUiStore'
import { handleHistoryListArrowKey } from './historyListArrowNavigation'
import { buildRowLayout, LIST_ROW_GAP, LIST_ROW_HEIGHT } from './historyListVirtualization'
import HistorySearchField from './HistorySearchField'
import HistorySessionItem from './HistorySessionItem'
import { useHistoryListKeyboard } from './useHistoryListKeyboard'
import { useHistorySearchIndex } from './useHistorySearchIndex'
import { useHistoryVirtualWindow } from './useHistoryVirtualWindow'

// Debounced so keystrokes don't trigger a full O(sessions × messages) scan.
const SEARCH_DEBOUNCE_MS = 180

/**
 * Stable empty list: `sessions = []` as a default would be a new reference on
 * every render, which would re-run the index effect for no reason (and could
 * loop while the query is still loading).
 */
const EMPTY_SESSIONS: ChatSession[] = []

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  tabId: string
}

const HistoryModal = memo(function HistoryModal({ isOpen, onClose, tabId }: HistoryModalProps) {
  const { t } = useTranslation()
  const { data: sessions = EMPTY_SESSIONS } = useSessionsQuery()
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
  const scrollTopRef = useRef(0)
  const [scrollTick, setScrollTick] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [keyboardIndex, setKeyboardIndex] = useState(-1)
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

  /** Programmatic scroll (keyboard, reset, clamp): always re-render. */
  const bumpScrollWindow = useCallback(() => {
    setScrollTick((tick) => tick + 1)
  }, [])

  const commitScrollTop = useCallback(
    (nextScrollTop: number) => {
      scrollTopRef.current = nextScrollTop
      bumpScrollWindow()
    },
    [bumpScrollWindow]
  )

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
    commitScrollTop(0)
  }, [isOpen, debouncedSearch, commitScrollTop])

  const isSearchActive = debouncedSearch.trim().length > 0

  /**
   * Lowercased haystacks are only built while a search is active, in slices and
   * once per session-list change. `isIndexBuilding` drives the same pending state
   * as the debounce, so a partially built index never shows a truncated result.
   */
  const { index: searchIndex, isBuilding: isIndexBuilding } = useHistorySearchIndex({
    isOpen,
    isSearchActive,
    sessions
  })

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

  // A new query starts a new result set; the keyboard cursor has to reset.
  useEffect(() => {
    setKeyboardIndex(-1)
  }, [debouncedSearch, isOpen])

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

  const { virtualRows, handleListScroll } = useHistoryVirtualWindow(
    filteredSessions.length,
    rowLayout.offsets,
    viewportHeight,
    scrollTopRef,
    scrollTick,
    bumpScrollWindow
  )

  // Once the virtual window includes the keyboard target, hand it focus.
  useEffect(() => {
    if (keyboardIndex < 0) return
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-history-row-index="${keyboardIndex}"]`
    )
    row?.querySelector<HTMLElement>('button')?.focus()
  }, [keyboardIndex, virtualRows.start, virtualRows.end])

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
      commitScrollTop(maxScrollTop)
    }
  }, [
    filteredSessions.length,
    editingRowHeight,
    baseRowHeight,
    isOpen,
    viewportHeight,
    commitScrollTop
  ])

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

  const handleClearSearch = useCallback(() => {
    setModalSearch('')
    searchInputRef.current?.focus()
  }, [])

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
        role="presentation"
        ref={isEditing ? measureEditingRow : undefined}
        data-history-row=""
        data-history-editing={isEditing ? '' : undefined}
        data-history-row-index={index}
        data-history-session-id={session.id}
        className={`rounded-lg transition-colors ${
          absoluteTop === undefined ? 'mb-2' : 'absolute right-0 left-0 z-10 mb-2'
        } ${
          keyboardIndex === index
            ? 'border-primary bg-accent/40 border-l-2'
            : 'border-l-2 border-transparent'
        }`}
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

  const isSearchPending = modalSearch !== debouncedSearch || isIndexBuilding
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
    onScrollTopChange: commitScrollTop
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
          transition={{ duration: DURATION.normal }}
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
          <HistorySearchField
            value={modalSearch}
            isSearchActive={isSearchActive}
            isSearchPending={isSearchPending}
            resultCount={filteredSessions.length}
            inputRef={searchInputRef}
            onChange={setModalSearch}
            onClear={handleClearSearch}
          />

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
                onClick={handleClearSearch}
                className="text-ql-11 shrink-0 font-semibold"
              >
                {t('api_chat_clear_search')}
              </Button>
            </div>
          )}

          {/* Sessions List */}
          <div
            ref={listRef}
            role="presentation"
            onScroll={handleListScroll}
            onKeyDown={(event) =>
              handleHistoryListArrowKey({
                event,
                list: listRef.current,
                total: filteredSessions.length,
                keyboardIndex,
                offsets: rowLayout.offsets,
                baseRowHeight,
                onKeyboardIndexChange: setKeyboardIndex,
                onScrollTopChange: commitScrollTop
              })
            }
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
