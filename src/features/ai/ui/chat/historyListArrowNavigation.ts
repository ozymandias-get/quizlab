import { LIST_ROW_GAP } from './historyListVirtualization'

interface HistoryListArrowKeyEvent {
  key: string
  target: EventTarget | null
  preventDefault: () => void
}

interface HandleHistoryListArrowKeyOptions {
  event: HistoryListArrowKeyEvent
  list: HTMLDivElement | null
  total: number
  keyboardIndex: number
  offsets: readonly number[]
  baseRowHeight: number
  onKeyboardIndexChange: (index: number) => void
  onScrollTopChange: (scrollTop: number) => void
}

/**
 * Moves the keyboard cursor with ArrowUp/ArrowDown and keeps the virtual list
 * scrolled to it.
 *
 * The row that actually owns focus wins over the remembered index, so a user
 * who tabbed into the middle of the list is not sent back to row 0. The target
 * row may not be mounted yet, so the scroll offset is computed from the layout
 * rather than from `scrollIntoView`.
 */
export function handleHistoryListArrowKey({
  event,
  list,
  total,
  keyboardIndex,
  offsets,
  baseRowHeight,
  onKeyboardIndexChange,
  onScrollTopChange
}: HandleHistoryListArrowKeyOptions): void {
  const target = event.target as HTMLElement | null
  // The rename input owns its own arrow keys (caret movement).
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (total === 0) return

  event.preventDefault()
  const focusedRow = target?.closest<HTMLElement>('[data-history-row-index]')
  const fromIndex = focusedRow ? Number(focusedRow.dataset.historyRowIndex) : keyboardIndex
  const next =
    event.key === 'ArrowDown'
      ? Math.min(total - 1, fromIndex + 1)
      : Math.max(0, fromIndex <= 0 ? 0 : fromIndex - 1)
  onKeyboardIndexChange(next)

  if (!list) return
  const top = offsets[next] ?? 0
  const height = (offsets[next + 1] ?? top + baseRowHeight) - top
  const viewTop = list.scrollTop
  const viewBottom = viewTop + list.clientHeight
  let nextTop = viewTop
  if (top < viewTop + LIST_ROW_GAP) {
    nextTop = Math.max(0, top - LIST_ROW_GAP)
  } else if (top + height > viewBottom - LIST_ROW_GAP) {
    nextTop = top + height - list.clientHeight + LIST_ROW_GAP
  }
  if (nextTop === viewTop) return
  list.scrollTop = nextTop
  onScrollTopChange(nextTop)
}
