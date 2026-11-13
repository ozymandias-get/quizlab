import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, type ReactNode } from 'react'

interface CollapsiblePanelProps {
  isOpen: boolean
  children: ReactNode
  className?: string
  /**
   * Keeps the body in the DOM while closed (height 0, inert). Use it only when
   * the closed content must stay addressable — e.g. rows that existing flows
   * query without opening the panel. The default unmounts, like `AiHomeSection`.
   */
  keepMounted?: boolean
}

const ACCORDION_EASE = [0.4, 0, 0.2, 1] as const

/**
 * Shared accordion body for the settings modal. Deliberately body-only: the
 * caller owns the header, button semantics and spacing, so this stays a thin
 * motion contract rather than a second accordion component.
 *
 * Same tempo as the AI home sections: height auto + opacity over
 * `DURATION.slow`, one easing curve, instant when reduced motion is requested.
 */
function CollapsiblePanel({
  isOpen,
  children,
  className = '',
  keepMounted = false
}: CollapsiblePanelProps) {
  const prefersReducedMotion = useReducedMotion()
  const transition = {
    duration: prefersReducedMotion ? 0 : DURATION.slow,
    ease: ACCORDION_EASE
  }

  if (keepMounted) {
    return (
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={transition}
        className={cn('overflow-hidden', className)}
        aria-hidden={!isOpen ? true : undefined}
        inert={!isOpen ? true : undefined}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(CollapsiblePanel)
