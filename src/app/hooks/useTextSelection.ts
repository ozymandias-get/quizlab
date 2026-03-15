import { useCallback, useRef } from 'react'
import { useAppTools } from '@app/providers/AppToolContext'

export function useTextSelection() {
  const { queueTextForAi } = useAppTools()
  const lastQueuedSignatureRef = useRef<string | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTextSelection = useCallback(
    (text: string, position: { top: number; left: number } | null) => {
      const normalizedText = text.trim()
      if (!normalizedText || !position) {
        return
      }

      const signature = `${normalizedText}::${Math.round(position.top)}:${Math.round(position.left)}`
      if (signature === lastQueuedSignatureRef.current) {
        return
      }

      lastQueuedSignatureRef.current = signature
      queueTextForAi(normalizedText)

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }

      resetTimerRef.current = setTimeout(() => {
        lastQueuedSignatureRef.current = null
      }, 250)
    },
    [queueTextForAi]
  )

  return {
    handleTextSelection
  }
}
