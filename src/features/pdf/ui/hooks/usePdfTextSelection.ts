/**
 * @deprecated Backward-compatibility wrapper around usePdfTextActions.
 * Kept for existing consumers (usePdfTextSelection.test.tsx).
 * New code should use usePdfTextActions directly from './text/usePdfTextActions'.
 */

import { useEffect, type RefObject } from 'react'
import { usePdfTextActions } from '../../text/usePdfTextActions'

interface UsePdfTextSelectionOptions {
  containerRef: RefObject<HTMLElement | null>
  onTextSelection: (text: string, position: { top: number; left: number } | null) => void
  enabled?: boolean
}

export function usePdfTextSelection({
  containerRef,
  onTextSelection,
  enabled = true
}: UsePdfTextSelectionOptions) {
  usePdfTextActions({
    containerRef,
    currentPage: 0,
    onTextSelection,
    textSelectionEnabled: enabled
  })

  useEffect(() => {
    if (!enabled) {
      onTextSelection?.('', null)
    }
  }, [enabled, onTextSelection])
}
