import { useCallback, useState } from 'react'

interface CaptureRect {
  left: number
  top: number
  width: number
  height: number
}

interface UseScreenshotReturn {
  isScreenshotMode: boolean
  startScreenshot: () => void
  closeScreenshot: () => void
  handleCapture: (imageData: string, rect?: CaptureRect | null) => Promise<void>
}

/** Full-screen crop overlay: toggles mode and forwards captured image to the caller. */
export function useScreenshot(
  onSendToAI?: (imageData: string, rect?: CaptureRect | null) => Promise<unknown>
): UseScreenshotReturn {
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)

  const startScreenshot = useCallback(() => {
    setIsScreenshotMode(true)
  }, [])

  const closeScreenshot = useCallback(() => {
    setIsScreenshotMode(false)
  }, [])

  const handleCapture = useCallback(
    async (imageData: string, rect?: CaptureRect | null) => {
      setIsScreenshotMode(false)
      await onSendToAI?.(imageData, rect ?? null)
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
