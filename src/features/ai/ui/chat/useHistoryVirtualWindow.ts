import type { RefObject } from 'react'
import { useCallback, useMemo, useRef } from 'react'

import { computeHistoryVirtualWindow, type HistoryVirtualWindow } from './historyListVirtualization'
import { useRafScrollTop } from './useRafScrollTop'

interface UseHistoryVirtualWindowResult {
  virtualRows: HistoryVirtualWindow
  handleListScroll: (event: React.UIEvent<HTMLElement>) => void
}

/**
 * Virtual window for the history list, driven by a scroll offset ref.
 *
 * The parent owns the offset and the render tick; this hook only decides when a
 * scroll crossed into a different row range. Scrolling inside the current
 * overscan window therefore costs no render at all.
 */
export function useHistoryVirtualWindow(
  total: number,
  offsets: readonly number[],
  viewportHeight: number,
  scrollTopRef: RefObject<number>,
  scrollTick: number,
  onWindowChange: () => void
): UseHistoryVirtualWindowResult {
  const windowRef = useRef({ start: 0, end: 0 })
  const inputsRef = useRef({ total, offsets, viewportHeight })
  inputsRef.current = { total, offsets, viewportHeight }

  const virtualRows = useMemo(
    () => computeHistoryVirtualWindow(total, offsets, scrollTopRef.current, viewportHeight),
    // `scrollTick` is the scroll signal; the offset is read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, offsets, viewportHeight, scrollTick]
  )
  windowRef.current = { start: virtualRows.start, end: virtualRows.end }

  const handleScrollTop = useCallback(
    (nextScrollTop: number) => {
      scrollTopRef.current = nextScrollTop
      const inputs = inputsRef.current
      const nextWindow = computeHistoryVirtualWindow(
        inputs.total,
        inputs.offsets,
        nextScrollTop,
        inputs.viewportHeight
      )
      const previous = windowRef.current
      if (previous.start !== nextWindow.start || previous.end !== nextWindow.end) {
        onWindowChange()
      }
    },
    [onWindowChange, scrollTopRef]
  )

  return { virtualRows, handleListScroll: useRafScrollTop(handleScrollTop) }
}
