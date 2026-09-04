import { useCallback, useRef, useState } from 'react'

const DEFAULT_SIZE = { width: 520, height: 520 }
const MIN_SIZE = { width: 320, height: 300 }
const MAX_SIZE = { width: 720, height: 760 }

/**
 * Resize behavior of the draggable OCR result panel.
 *
 * Extracted from `OcrResultPanel.tsx`: pointer-capture + window-listener
 * lifecycle is a stateful responsibility independent of the panel's
 * copy/save/AI-submit handlers.
 */
export function useOcrPanelResize() {
  const [size, setSize] = useState(DEFAULT_SIZE)
  const resizingRef = useRef(false)
  const startSizeRef = useRef({ w: DEFAULT_SIZE.width, h: DEFAULT_SIZE.height, x: 0, y: 0 })

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizingRef.current = true
      startSizeRef.current = {
        w: size.width,
        h: size.height,
        x: e.clientX,
        y: e.clientY
      }
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        if (!resizingRef.current) return
        const dx = ev.clientX - startSizeRef.current.x
        const dy = ev.clientY - startSizeRef.current.y
        const nextW = Math.min(
          Math.max(MIN_SIZE.width, startSizeRef.current.w + dx),
          Math.min(MAX_SIZE.width, window.innerWidth - 32)
        )
        const nextH = Math.min(
          Math.max(MIN_SIZE.height, startSizeRef.current.h + dy),
          Math.min(MAX_SIZE.height, window.innerHeight - 80)
        )
        setSize({ width: nextW, height: nextH })
      }
      const onUp = () => {
        resizingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      // Cleanup on unmount: ensure listeners removed if component unmounts mid-resize
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    },
    [size.height, size.width]
  )

  return { size, handleResizePointerDown }
}
