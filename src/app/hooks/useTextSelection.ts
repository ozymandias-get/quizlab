import { useAppToolActions } from '@app/providers/AppToolContext'

import { useCallback, useMemo, useRef } from 'react'

const DEDUP_WINDOW_MS = 2000

export function useTextSelection() {
  const { queueTextForAi } = useAppToolActions()
  const lastQueuedTextRef = useRef<string | null>(null)
  const lastQueuedTimeRef = useRef<number>(0)

  const handleTextSelection = useCallback(
    (text: string, position: { top: number; left: number } | null) => {
      const normalizedText = text.trim()
      if (!normalizedText || !position) {
        return
      }

      const now = Date.now()
      if (
        normalizedText === lastQueuedTextRef.current &&
        now - lastQueuedTimeRef.current < DEDUP_WINDOW_MS
      ) {
        return
      }

      lastQueuedTextRef.current = normalizedText
      lastQueuedTimeRef.current = now
      queueTextForAi(normalizedText)
    },
    [queueTextForAi]
  )

  return useMemo(() => ({ handleTextSelection }), [handleTextSelection])
}
