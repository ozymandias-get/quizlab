/**
 * Windowing for the chat transcript.
 *
 * A long conversation used to put every message in the DOM at once; a streaming
 * reply then made React reconcile the whole history on each chunk. This hook
 * renders only the rows around the viewport (plus an overscan band) and keeps
 * the scroll geometry stable by measuring each rendered row.
 *
 * Row heights are variable, so offsets come from the measured map with an
 * estimate for rows that have not been rendered yet. A row that sits above the
 * viewport and turns out taller than its estimate would shift everything below
 * it, so the layout pass compensates `scrollTop` by the delta — but only while
 * the reader is scrolled up, because the pinned-to-bottom path is driven by the
 * transcript's own scroll-to-end effect.
 *
 * Short transcripts bypass the whole mechanism: below `MESSAGE_WINDOW_THRESHOLD`
 * rows everything renders, exactly as before.
 */
import type { ApiChatMessage } from '@shared-core/types'

import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { MessageGroupEntry } from './chatUtils'

/** Below this many rows, rendering everything is cheaper than windowing. */
export const MESSAGE_WINDOW_THRESHOLD = 40

const DATE_ROW_ESTIMATE_PX = 48
const GROUP_BASE_ESTIMATE_PX = 56
const GROUP_MESSAGE_ESTIMATE_PX = 56
const MESSAGE_LINE_ESTIMATE_PX = 20
const MESSAGE_CHARS_PER_LINE = 88
const MAX_MESSAGE_ESTIMATE_PX = 480
const OVERSCAN_PX = 700
const FALLBACK_VIEWPORT_PX = 600

export interface MessageRowMeta {
  key: string
  estimatedHeight: number
}

function estimateMessageHeight(message: ApiChatMessage): number {
  const lines = Math.max(1, Math.ceil(message.content.length / MESSAGE_CHARS_PER_LINE))
  return Math.min(
    MAX_MESSAGE_ESTIMATE_PX,
    GROUP_MESSAGE_ESTIMATE_PX + lines * MESSAGE_LINE_ESTIMATE_PX
  )
}

export function buildMessageRowMetas(
  groups: readonly MessageGroupEntry[],
  rowOffset = 0
): MessageRowMeta[] {
  return groups.map((group, index) => {
    if (group.kind === 'date') {
      return {
        key: `d-${group.timestamp}-${rowOffset + index}`,
        estimatedHeight: DATE_ROW_ESTIMATE_PX
      }
    }
    const height = group.messages.reduce(
      (total, message) => total + estimateMessageHeight(message),
      GROUP_BASE_ESTIMATE_PX
    )
    // The first message id identifies the group across appends.
    return { key: `g-${group.messages[0].id}`, estimatedHeight: height }
  })
}

/** Prefix sums of row heights: `offsets[i]` is the top of row `i`. */
export function buildRowOffsets(
  rows: readonly MessageRowMeta[],
  heights: ReadonlyMap<string, number>
): number[] {
  const offsets = new Array<number>(rows.length + 1)
  offsets[0] = 0
  for (let i = 0; i < rows.length; i += 1) {
    offsets[i + 1] = offsets[i] + (heights.get(rows[i].key) ?? rows[i].estimatedHeight)
  }
  return offsets
}

/** First row whose bottom edge is after `y`. */
function findFirstRowAfter(offsets: readonly number[], rowCount: number, y: number): number {
  let low = 0
  let high = rowCount
  while (low < high) {
    const mid = (low + high) >> 1
    if (offsets[mid + 1] <= y) low = mid + 1
    else high = mid
  }
  return low
}

export function findMessageWindow(
  offsets: readonly number[],
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
  pinnedToBottom: boolean
): { start: number; end: number } {
  if (rowCount === 0) return { start: 0, end: 0 }
  if (rowCount <= MESSAGE_WINDOW_THRESHOLD) return { start: 0, end: rowCount }

  const viewport = viewportHeight > 0 ? viewportHeight : FALLBACK_VIEWPORT_PX
  const total = offsets[rowCount]
  // While pinned, the scroll event that follows the auto-scroll may not have
  // arrived yet; window from the bottom so the new tail is always rendered.
  const effectiveTop = pinnedToBottom ? Math.max(scrollTop, total - viewport) : scrollTop
  const top = Math.max(0, effectiveTop - OVERSCAN_PX)
  const bottom = effectiveTop + viewport + OVERSCAN_PX

  const start = Math.min(findFirstRowAfter(offsets, rowCount, top), rowCount - 1)
  let end = findFirstRowAfter(offsets, rowCount, bottom)
  if (end <= start) end = Math.min(rowCount, start + 1)
  return { start, end }
}

interface UseMessageListWindowOptions {
  rows: readonly MessageRowMeta[]
  containerRef: RefObject<HTMLElement | null>
  pinnedToBottom: boolean
}

interface UseMessageListWindowResult {
  start: number
  end: number
  topPad: number
  bottomPad: number
}

export function useMessageListWindow({
  rows,
  containerRef,
  pinnedToBottom
}: UseMessageListWindowOptions): UseMessageListWindowResult {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  // Whether the reader was at the bottom *when the last scroll happened*. This
  // is deliberately not `pinnedToBottom`: that prop can lag one frame behind a
  // scroll-up, and correcting against a stale value would yank the reader down.
  const nearBottomRef = useRef(true)

  const offsets = useMemo(() => buildRowOffsets(rows, heights), [rows, heights])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncSize = () => setViewportHeight(container.clientHeight)
    syncSize()

    const onScroll = () => {
      setScrollTop(container.scrollTop)
      nearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <= 24
    }
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncSize)
      observer.observe(container)
    }

    return () => {
      container.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [containerRef])

  const { start, end } = useMemo(
    () => findMessageWindow(offsets, rows.length, scrollTop, viewportHeight, pinnedToBottom),
    [offsets, rows.length, scrollTop, viewportHeight, pinnedToBottom]
  )

  // Measure the rows that were just rendered, and keep the reader's place when
  // a row above the viewport turns out to be a different height than estimated.
  // The window bounds are dependencies because a scroll exposes new rows that
  // have not been measured yet.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('[data-message-row]')
    if (nodes.length === 0) return

    const containerTop = container.getBoundingClientRect().top
    const nearBottom = nearBottomRef.current
    const updates = new Map<string, number>()
    let shift = 0

    for (const node of nodes) {
      const key = node.dataset.messageRow
      if (!key) continue
      const rect = node.getBoundingClientRect()
      const height = rect.height
      if (!(height > 0)) continue
      const previous = heights.get(key)
      if (previous !== undefined && Math.abs(previous - height) <= 0.5) continue

      if (previous !== undefined && !nearBottom && rect.bottom <= containerTop + 1) {
        shift += height - previous
      }
      updates.set(key, height)
    }

    if (updates.size === 0) return
    if (nearBottom) {
      // Content resized while the reader was at the bottom: stay pinned instead
      // of letting the growth look like a scroll-up on the next read.
      container.scrollTop = container.scrollHeight
    } else if (shift !== 0) {
      container.scrollTop += shift
    }
    setHeights((previous) => {
      const next = new Map(previous)
      for (const [key, height] of updates) next.set(key, height)
      return next
    })
  }, [containerRef, heights, pinnedToBottom, start, end])

  return {
    start,
    end,
    topPad: offsets[start] ?? 0,
    bottomPad: (offsets[rows.length] ?? 0) - (offsets[end] ?? 0)
  }
}
