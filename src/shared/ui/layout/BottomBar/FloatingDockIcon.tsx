import { motion, useSpring } from 'motion/react'
import type { CSSProperties } from 'react'
import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

export const DOCK_ICON_BASE = 32
export const DOCK_ICON_HOVER = 44

export const ICON_CONTAINER_STYLE: CSSProperties = {
  width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
  height: 'calc(1.25rem * var(--bar-scale-factor, 1))'
}

export interface FloatingDockIconProps {
  title: string
  children: ReactNode
  id?: string
  onClick: () => void
}

export const FloatingDockIcon = memo(function FloatingDockIcon({
  title,
  children,
  id,
  onClick
}: FloatingDockIconProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const isMountedRef = useRef(true)

  const handleMouseEnter = useCallback(() => {
    if (isMountedRef.current) setIsHovered(true)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (isMountedRef.current) setIsHovered(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  const scale = useSpring(isHovered ? DOCK_ICON_HOVER / DOCK_ICON_BASE : 1, {
    mass: 0.1,
    stiffness: 150,
    damping: 20
  })

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return (
    <motion.div
      ref={ref}
      id={id}
      role="button"
      tabIndex={0}
      aria-label={title}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ width: DOCK_ICON_BASE, height: DOCK_ICON_BASE, scale }}
      className="relative flex shrink-0 origin-center cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/10 transition-colors duration-150 hover:border-white/20 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 8, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 4, x: '-50%' }}
          className="z-tooltip absolute -top-8 left-1/2 w-max rounded-md border border-white/10 bg-neutral-900 px-2 py-0.5 text-xs whitespace-nowrap text-white"
          role="tooltip"
        >
          {title}
        </motion.div>
      )}
      <div className="flex items-center justify-center text-white/70" style={ICON_CONTAINER_STYLE}>
        {children}
      </div>
    </motion.div>
  )
})
