import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@app/components/ui/tooltip'

import { motion, useSpring } from 'motion/react'
import type { CSSProperties } from 'react'
import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const DOCK_ICON_BASE = 32
const DOCK_ICON_HOVER = 34

const ICON_CONTAINER_STYLE: CSSProperties = {
  width: 'calc(1.125rem * var(--bar-scale-factor, 1))',
  height: 'calc(1.125rem * var(--bar-scale-factor, 1))'
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
    stiffness: 200,
    damping: 25
  })

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
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
            className="group border-border bg-card hover:border-ring/40 hover:bg-muted focus-visible:ring-ring/40 motion-normal relative flex shrink-0 origin-center cursor-pointer items-center justify-center rounded-lg border shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div
              className="text-muted-foreground group-hover:text-foreground flex items-center justify-center transition-colors"
              style={ICON_CONTAINER_STYLE}
            >
              {children}
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={12}>
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
