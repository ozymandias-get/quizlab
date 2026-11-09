/**
 * Geometry helpers for the virtualised chat-history list.
 *
 * Rows are uniform except for the single row being renamed, whose height is
 * measured separately. Keeping the prefix-offset maths here lets the modal
 * stay focused on interaction logic and keeps it under the component size
 * budget.
 */

// 80px leaves room for the title plus metadata at large text scales; virtual
// offsets still use one uniform row height, and the edited row is measured.
export const LIST_ROW_HEIGHT = 80
export const LIST_ROW_GAP = 8
export const LIST_OVERSCAN = 4
export const LIST_FALLBACK_HEIGHT = 480

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface HistoryRowLayout {
  /** Prefix offsets: row `i` starts at `offsets[i]`. */
  offsets: number[]
  totalHeight: number
  /** Index of the row being edited, or -1. */
  editingIndex: number
}

export function buildRowLayout(
  sessions: readonly { id: string }[],
  editingId: string | null,
  editingRowHeight: number
): HistoryRowLayout {
  const total = sessions.length
  const offsets = new Array<number>(total + 1)
  offsets[0] = 0

  let editingIndex = -1
  for (let index = 0; index < total; index += 1) {
    const height =
      sessions[index].id === editingId
        ? Math.max(LIST_ROW_HEIGHT, editingRowHeight)
        : LIST_ROW_HEIGHT
    offsets[index + 1] = offsets[index] + height + LIST_ROW_GAP
    if (sessions[index].id === editingId) editingIndex = index
  }

  return { offsets, totalHeight: offsets[total] ?? 0, editingIndex }
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
}

/** First row whose bottom edge is past `scrollTop`. */
export function findFirstVisibleRow(
  offsets: readonly number[],
  total: number,
  scrollTop: number
): number {
  let low = 0
  let high = total

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle + 1] <= scrollTop) low = middle + 1
    else high = middle
  }

  return low
}

/** First row starting at or after `windowBottom`, searching from `from`. */
export function findFirstRowAfter(
  offsets: readonly number[],
  total: number,
  from: number,
  windowBottom: number
): number {
  let low = from
  let high = total

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle] < windowBottom) low = middle + 1
    else high = middle
  }

  return low
}
