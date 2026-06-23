import { memo, useEffect, useRef } from 'react'

interface ResizableHandleProps {
  onResize: (delta: number) => void
}

const ResizableHandle = memo(function ResizableHandle({ onResize }: ResizableHandleProps) {
  const isDragging = useRef(false)
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
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      className="group relative w-1.5 shrink-0 cursor-col-resize"
      onMouseDown={(e) => {
        e.preventDefault()
        isDragging.current = true
        startXRef.current = e.clientX
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          onResizeRef.current(-10)
        } else if (e.key === 'ArrowRight') {
          onResizeRef.current(10)
        }
      }}
    >
      <div className="bg-border group-hover:bg-ring/50 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors" />
      <div className="group-hover:bg-ring/10 absolute inset-y-0 left-1/2 -ml-1 w-2 translate-x-0 rounded-sm transition-colors" />
    </div>
  )
})

export default ResizableHandle
