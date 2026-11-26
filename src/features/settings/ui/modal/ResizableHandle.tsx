import { memo, useCallback, useEffect, useRef, useState } from 'react'

interface ResizableHandleProps {
  onResize: (delta: number) => void
  /** Current sidebar width in pixels, for screen readers. */
  value?: number
  min?: number
  max?: number
  label?: string
}

const DRAG_CURSOR = 'col-resize'

const ResizableHandle = memo(function ResizableHandle({
  onResize,
  value = 0,
  min = 190,
  max = 380,
  label = 'Resize sidebar'
}: ResizableHandleProps) {
  const isDragging = useRef(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const startXRef = useRef(0)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  /**
   * The body styles that were present *before* this handle started a drag.
   * `null` means this component currently owns no body styles, so it must not
   * clear anything on unmount — another surface may own them by then.
   */
  const previousBodyStylesRef = useRef<{ cursor: string; userSelect: string } | null>(null)

  const restoreBodyStyles = useCallback(() => {
    const previous = previousBodyStylesRef.current
    previousBodyStylesRef.current = null
    if (!previous) return
    // Only roll back the values this handle set. If another interaction has
    // already replaced them, leave that interaction's state alone.
    if (document.body.style.cursor === DRAG_CURSOR) document.body.style.cursor = previous.cursor
    if (document.body.style.userSelect === 'none') {
      document.body.style.userSelect = previous.userSelect
    }
  }, [])

  const endDrag = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    setIsDragActive(false)
    restoreBodyStyles()
  }, [restoreBodyStyles])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      // The button was released while the pointer was outside the window, so
      // no mouseup reached us. The next move reports no buttons; stop instead
      // of resizing on a button-less gesture.
      if (e.buttons === 0) {
        endDrag()
        return
      }
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResizeRef.current(delta)
    }

    // mouseup can be lost (Alt+Tab, release outside the window, minimize).
    // `blur` and a cancelled pointer both mean the gesture is over.
    const handleCancel = () => endDrag()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleCancel)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('blur', handleCancel)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleCancel)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('blur', handleCancel)
      // Unmounting mid-drag must not leave the document stuck with the resize
      // cursor or selection disabled — but only roll back what it set.
      isDragging.current = false
      restoreBodyStyles()
    }
  }, [endDrag, restoreBodyStyles])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={0}
      className="group relative w-3 shrink-0 cursor-col-resize outline-none select-none"
      onMouseDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        if (!isDragging.current) {
          previousBodyStylesRef.current = {
            cursor: document.body.style.cursor,
            userSelect: document.body.style.userSelect
          }
        }
        isDragging.current = true
        setIsDragActive(true)
        startXRef.current = e.clientX
        document.body.style.cursor = DRAG_CURSOR
        document.body.style.userSelect = 'none'
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onResizeRef.current(-10)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          onResizeRef.current(10)
        }
      }}
    >
      {/* Single track + a wider hover wash. */}
      <div
        className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
          isDragActive ? 'bg-primary/60' : 'bg-white/[0.07]'
        }`}
      />
      <div className="group-hover:bg-ring/10 absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 rounded-sm transition-colors" />
      {/* Grip dots: the divider's position stays legible even on low-contrast
          displays, and the accent guide line confirms an active drag. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-full p-0.5 opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="size-0.5 rounded-full bg-white/25" />
        <span className="size-0.5 rounded-full bg-white/25" />
        <span className="size-0.5 rounded-full bg-white/25" />
      </div>
      {isDragActive && (
        <div
          aria-hidden
          className="bg-primary/25 pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
        />
      )}
    </div>
  )
})

export default ResizableHandle
