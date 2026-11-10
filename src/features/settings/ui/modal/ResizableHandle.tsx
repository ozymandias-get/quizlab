import { memo, useEffect, useRef, useState } from 'react'

interface ResizableHandleProps {
  onResize: (delta: number) => void
  /** Current sidebar width in pixels, for screen readers. */
  value?: number
  min?: number
  max?: number
  label?: string
}

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResizeRef.current(delta)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        setIsDragActive(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      // Unmounting mid-drag must not leave the whole document stuck with the
      // resize cursor and selection disabled.
      isDragging.current = false
      setIsDragActive(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

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
        e.preventDefault()
        isDragging.current = true
        setIsDragActive(true)
        startXRef.current = e.clientX
        document.body.style.cursor = 'col-resize'
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
          isDragActive ? 'bg-primary/60' : 'bg-muted-foreground/45'
        }`}
      />
      <div className="group-hover:bg-ring/10 absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 rounded-sm transition-colors" />
      {/* Grip dots: the divider's position stays legible even on low-contrast
          displays, and the accent guide line confirms an active drag. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-full p-0.5 opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="bg-muted-foreground/70 size-0.5 rounded-full" />
        <span className="bg-muted-foreground/70 size-0.5 rounded-full" />
        <span className="bg-muted-foreground/70 size-0.5 rounded-full" />
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
