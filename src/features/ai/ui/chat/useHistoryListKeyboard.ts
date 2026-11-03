import { type RefObject, useCallback, useEffect, useRef } from 'react'

import { getFocusableElements, LIST_ROW_GAP } from './historyListVirtualization'

interface HistoryListKeyboardOptions {
  isOpen: boolean
  listRef: RefObject<HTMLDivElement | null>
  sessions: readonly { id: string }[]
  offsets: readonly number[]
  windowStart: number
  windowEnd: number
  editingId: string | null
  onScrollTopChange: (scrollTop: number) => void
}

/**
 * Keyboard navigation across a virtualised list.
 *
 * Virtualisation removes off-screen rows from the DOM, so the browser's own
 * Tab order would leave the list as soon as the rendered window ends. At that
 * boundary we advance the window ourselves and hand focus to the neighbouring
 * row after it renders. The target is pinned by session id, not just index, so
 * a list change in between cannot move focus to a different chat.
 */
export function useHistoryListKeyboard({
  isOpen,
  listRef,
  sessions,
  offsets,
  windowStart,
  windowEnd,
  editingId,
  onScrollTopChange
}: HistoryListKeyboardOptions) {
  const pendingFocusRowRef = useRef<{
    index: number
    sessionId: string
    fromEnd: boolean
  } | null>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return

      const list = listRef.current
      if (!list) return
      const focusable = getFocusableElements(list)
      if (focusable.length === 0) return

      const active = document.activeElement as HTMLElement | null
      if (!active || !list.contains(active)) return
      const position = focusable.indexOf(active)
      if (position === -1) return

      const rowElement = active.closest<HTMLElement>('[data-history-row-index]')
      const rowIndex = rowElement ? Number(rowElement.dataset.historyRowIndex) : -1
      if (rowIndex < 0) return

      let targetIndex: number
      if (event.shiftKey) {
        if (position !== 0) return
        targetIndex = rowIndex - 1
        if (targetIndex < 0) return
      } else {
        if (position !== focusable.length - 1) return
        targetIndex = rowIndex + 1
        if (targetIndex >= sessions.length) return
      }

      const target = sessions[targetIndex]
      if (!target) return

      event.preventDefault()
      const offset = offsets[targetIndex]
      list.scrollTop = Math.max(0, offset - LIST_ROW_GAP)
      onScrollTopChange(list.scrollTop)
      pendingFocusRowRef.current = {
        index: targetIndex,
        sessionId: target.id,
        fromEnd: event.shiftKey
      }
    },
    [listRef, offsets, onScrollTopChange, sessions]
  )

  // Registered imperatively: the scroll container is not an interactive
  // element itself, so a JSX key handler would be an a11y anti-pattern.
  useEffect(() => {
    if (!isOpen) return
    const list = listRef.current
    if (!list) return

    list.addEventListener('keydown', handleKeyDown)
    return () => list.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, isOpen, listRef])

  // Focus the row requested by the keyboard handler once the window includes
  // it. Runs after commit, so the target row is in the DOM by now.
  useEffect(() => {
    const pending = pendingFocusRowRef.current
    if (!pending) return

    // Bail out rather than focus a different session that happens to occupy
    // the remembered index after a delete, filter change or external refresh.
    if (sessions[pending.index]?.id !== pending.sessionId) {
      pendingFocusRowRef.current = null
      return
    }

    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-history-row-index="${pending.index}"]`
    )
    if (!row) return
    if (row.dataset.historySessionId !== pending.sessionId) {
      pendingFocusRowRef.current = null
      return
    }

    const focusable = getFocusableElements(row)
    if (focusable.length === 0) return

    focusable[pending.fromEnd ? focusable.length - 1 : 0]?.focus()
    pendingFocusRowRef.current = null
  }, [editingId, listRef, sessions, windowEnd, windowStart])
}
