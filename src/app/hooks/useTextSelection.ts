import { useCallback, useRef } from 'react'
import { useAppToolActions } from '@app/providers/AppToolContext'

export function useTextSelection() {
  const { queueTextForAi } = useAppToolActions()
  const lastQueuedTextRef = useRef<string | null>(null)

  const handleTextSelection = useCallback(
    (text: string, position: { top: number; left: number } | null) => {
      const normalizedText = text.trim()
      if (!normalizedText || !position) {
        return
      }

      if (normalizedText === lastQueuedTextRef.current) {
        return
      }

      lastQueuedTextRef.current = normalizedText
      queueTextForAi(normalizedText)
    },
    [queueTextForAi]
  )

  return {
    handleTextSelection
  }
}
