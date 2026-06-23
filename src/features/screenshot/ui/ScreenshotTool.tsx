import { useCaptureScreen } from '@platform/electron/api/useSystemApi'

import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MIN_SELECTION_SIZE = 20

interface SelectionRect {
  left: number
  top: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface ScreenshotToolProps {
  isActive: boolean
  onCapture: (image: string, rect: SelectionRect) => void
  onClose: () => void
}

function getSelectionRect(start: Point, end: Point): SelectionRect {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

function ScreenshotTool({ isActive, onCapture, onClose }: ScreenshotToolProps) {
  const { t } = useTranslation()
  const { showError } = useToastActions()
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 })
  const [endPos, setEndPos] = useState<Point>({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)
  const { mutateAsync: captureScreenMutation } = useCaptureScreen()

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    setIsSelecting(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    setEndPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting) return
    setEndPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = async () => {
    if (!isSelecting) return
    setIsSelecting(false)

    const rect = getSelectionRect(startPos, endPos)

    if (rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      onClose()
      return
    }

    await performCapture(rect)
  }

  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, onClose])

  const performCapture = async (rect: SelectionRect) => {
    if (overlayRef.current) {
      overlayRef.current.style.display = 'none'
    }

    await new Promise((resolve) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    )

    try {
      const croppedImage = await captureScreenMutation({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })

      if (croppedImage) {
        try {
          await onCapture(croppedImage, rect)
        } catch (innerError) {
          Logger.error('[ScreenshotTool] onCapture error:', innerError)
          showError('toast_capture_failed')
        }
      } else {
        Logger.warn('[ScreenshotTool] Empty capture result')
      }
      onClose()
    } catch (error) {
      Logger.error('[ScreenshotTool] Capture error:', error)
      showError('toast_capture_failed')
      onClose()
    }
  }

  if (!isActive) return null

  const selectionRect = getSelectionRect(startPos, endPos)
  const hasSelection = isSelecting && selectionRect.width > 0 && selectionRect.height > 0

  return (
    <div
      role="presentation"
      ref={overlayRef}
      className="screenshot-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {hasSelection && (
        <>
          <div
            className="screenshot-dim"
            style={{ top: 0, left: 0, width: '100%', height: selectionRect.top }}
          />
          <div
            className="screenshot-dim"
            style={{
              top: selectionRect.top,
              left: 0,
              width: selectionRect.left,
              height: selectionRect.height
            }}
          />
          <div
            className="screenshot-dim"
            style={{
              top: selectionRect.top,
              left: selectionRect.left + selectionRect.width,
              right: 0,
              height: selectionRect.height
            }}
          />
          <div
            className="screenshot-dim"
            style={{
              top: selectionRect.top + selectionRect.height,
              left: 0,
              width: '100%',
              bottom: 0
            }}
          />

          <div
            className="screenshot-selection"
            style={{
              left: selectionRect.left,
              top: selectionRect.top,
              width: selectionRect.width,
              height: selectionRect.height
            }}
          >
            <div className="screenshot-size-indicator">
              {Math.round(selectionRect.width)} x {Math.round(selectionRect.height)}
            </div>

            <div className="screenshot-handle top-left" />
            <div className="screenshot-handle top-right" />
            <div className="screenshot-handle bottom-left" />
            <div className="screenshot-handle bottom-right" />
          </div>
        </>
      )}

      {!isSelecting && <div className="screenshot-esc-hint">{t('cancel_with_esc')}</div>}
    </div>
  )
}

export default ScreenshotTool
