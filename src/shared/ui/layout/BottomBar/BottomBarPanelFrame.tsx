import { memo, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { panelTransition, panelVariantsVertical } from './animations'
import { BottomScrollCue } from './BottomScrollCue'
import { useBottomScrollCue } from './useBottomScrollCue'

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
    children
  }: BottomBarPanelFrameProps) => {
    const { scrollAreaRef, showScrollCue } = useBottomScrollCue<HTMLDivElement>(isOpen, maxHeight)
    const resolvedMaxHeight = maxHeight
      ? `${Math.max(0, Math.floor(maxHeight))}px`
      : fallbackMaxHeight

    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            variants={panelVariantsVertical}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={panelTransition}
            className={className}
            style={{
              ...panelStyle,
              maxHeight: resolvedMaxHeight
            }}
            id={id}
          >
            <div className="relative flex flex-col items-center w-full">
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
        )}
      </AnimatePresence>
    )
  }
)

BottomBarPanelFrame.displayName = 'BottomBarPanelFrame'
