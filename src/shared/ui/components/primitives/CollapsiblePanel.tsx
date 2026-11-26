import { DURATION } from '@shared/lib/motion'
import { cn } from '@shared/lib/uiUtils'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, type ReactNode, useLayoutEffect, useRef } from 'react'

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
  const bodyRef = useRef<HTMLDivElement>(null)
  const transition = {
    duration: prefersReducedMotion ? 0 : DURATION.slow,
    ease: ACCORDION_EASE
  }

  // AnimatePresence keeps the body mounted for the exit animation. Mark it
  // inert as soon as it starts closing so Tab and clicks cannot land in content
  // that is already collapsing and about to unmount. `keepMounted` already
  // receives these attributes as props.
  useLayoutEffect(() => {
    if (keepMounted) return
    const body = bodyRef.current
    if (!body) return
    if (isOpen) {
      body.removeAttribute('inert')
      body.removeAttribute('aria-hidden')
    } else {
      body.setAttribute('inert', '')
      body.setAttribute('aria-hidden', 'true')
    }
  }, [isOpen, keepMounted])

  if (keepMounted) {
    return (
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={transition}
        data-collapsible-body=""
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
          ref={bodyRef}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          data-collapsible-body=""
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(CollapsiblePanel)
