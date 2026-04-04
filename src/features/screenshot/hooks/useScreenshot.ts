import { useState, useCallback } from 'react'

interface UseScreenshotReturn {
  isScreenshotMode: boolean
  startScreenshot: () => void
  closeScreenshot: () => void
  handleCapture: (imageData: string) => Promise<void>
}

/** Full-screen crop overlay: toggles mode and forwards captured image to the caller. */
export function useScreenshot(
  onSendToAI?: (imageData: string) => Promise<unknown>
): UseScreenshotReturn {
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)

  const startScreenshot = useCallback(() => {
    setIsScreenshotMode(true)
  }, [])

  const closeScreenshot = useCallback(() => {
    setIsScreenshotMode(false)
  }, [])

  const handleCapture = useCallback(
    async (imageData: string) => {
      setIsScreenshotMode(false)
      await onSendToAI?.(imageData)
    },
    [onSendToAI]
  )

  return {
    isScreenshotMode,
    startScreenshot,
    closeScreenshot,
    handleCapture
  }
}
