import { memo, useMemo, type CSSProperties, type ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import { BottomScrollCue } from './BottomScrollCue'
import { useBottomScrollCue } from './useBottomScrollCue'
import { panelSpring, smoothEase } from './animations'

const PANEL_ANIM_DISTANCE = 12

function createPanelVariants(direction: 'above' | 'below', performanceMode: boolean): Variants {
  const dy = direction === 'above' ? -PANEL_ANIM_DISTANCE : PANEL_ANIM_DISTANCE

  if (performanceMode) {
    return {
      hidden: {
        opacity: 0,
        y: dy,
        visibility: 'hidden',
        transition: { duration: 0.1 }
      },
      visible: {
        visibility: 'visible',
        opacity: 1,
        y: 0,
        transition: { duration: 0.1 }
      }
    }
  }

  return {
    hidden: {
      opacity: 0,
      y: dy,
      scale: 0.96,
      visibility: 'hidden',
      transition: {
        duration: 0.15,
        ease: [0.4, 0, 1, 1]
      }
    },
    visible: {
      visibility: 'visible',
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...panelSpring,
        opacity: { duration: 0.25, ease: smoothEase }
      }
    }
  }
}

interface BottomBarPanelFrameProps {
  isOpen: boolean
  panelStyle: CSSProperties
  maxHeight?: number
  fallbackMaxHeight?: string
  className: string
  id?: string
  scrollAreaTestId: string
  scrollCueTestId: string
  children: ReactNode
  performanceMode?: boolean
  direction?: 'above' | 'below'
}

export const BottomBarPanelFrame = memo(
  ({
    isOpen,
    panelStyle,
    maxHeight,
    fallbackMaxHeight,
    className,
    id,
    scrollAreaTestId,
    scrollCueTestId,
    children,
    performanceMode = false,
    direction = 'below'
  }: BottomBarPanelFrameProps) => {
    const { scrollAreaRef, showScrollCue } = useBottomScrollCue<HTMLDivElement>(isOpen, maxHeight)
    const resolvedMaxHeight =
      maxHeight && maxHeight > 0 ? `${Math.max(0, Math.floor(maxHeight))}px` : fallbackMaxHeight

    const resolvedVariants = useMemo(
      () => createPanelVariants(direction, performanceMode),
      [direction, performanceMode]
    )

    return (
      <motion.div
        variants={resolvedVariants}
        initial="hidden"
        animate={isOpen ? 'visible' : 'hidden'}
        className={className}
        style={{
          ...panelStyle,
          maxHeight: resolvedMaxHeight,
          pointerEvents: isOpen ? 'auto' : 'none',
          willChange: 'transform, opacity'
        }}
        id={id}
      >
        <div className="relative flex flex-col items-center w-full h-full">
          <div
            ref={scrollAreaRef}
            data-testid={scrollAreaTestId}
            className="w-full overflow-y-auto overflow-x-hidden scrollbar-hidden overscroll-contain"
            style={{ maxHeight: resolvedMaxHeight }}
          >
            {children}
          </div>
          <BottomScrollCue visible={showScrollCue} testId={scrollCueTestId} />
        </div>
      </motion.div>
    )
  }
)

BottomBarPanelFrame.displayName = 'BottomBarPanelFrame'
