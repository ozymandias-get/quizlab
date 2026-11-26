import { DURATION } from '@shared/lib/motion'

import type { Easing } from 'motion/react'
import { useMemo } from 'react'

const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

/**
 * Panel transitions use `DURATION.slow` (200 ms), the same surface budget as an
 * accordion or a focus handoff. They used to run at 400 ms with a 0.97 scale and
 * a 30 ms-per-child stagger; a workspace swap is a positional change, not an
 * entrance, so it must not be slower or heavier than the panel it moves.
 */
const DEFAULT_TRANSITION = {
  duration: DURATION.slow,
  ease: ANIMATION_EASE
}

// Static variants defined once outside the component to avoid re-creating
// them on every render. These never change, so useMemo is unnecessary.
const LEFT_PANEL_VARIANTS = {
  visible: {
    opacity: 1,
    x: 0,
    transition: DEFAULT_TRANSITION
  },
  hidden: {
    opacity: 0,
    x: -30,
    transition: DEFAULT_TRANSITION
  }
}

const RIGHT_PANEL_VARIANTS = {
  visible: {
    opacity: 1,
    x: 0,
    transition: DEFAULT_TRANSITION
  },
  hidden: {
    opacity: 0,
    x: 30,
    transition: DEFAULT_TRANSITION
  }
}

/**
 * The resizer belongs to the same gesture as the two panels: same duration and
 * same curve, so a swap reads as one surface separating instead of three
 * elements arriving one after another.
 */
const RESIZER_VARIANTS = {
  visible: {
    opacity: 1,
    scaleY: 1,
    transition: DEFAULT_TRANSITION
  },
  hidden: {
    opacity: 0,
    scaleY: 0,
    transition: DEFAULT_TRANSITION
  }
}

/**
 * No `staggerChildren` / `when: 'beforeChildren'`. The panels and their divider
 * are one unit; a 30 ms cascade made the right panel and the resizer visibly lag
 * the left one, and the workspace is not a list whose children need reading in
 * order.
 */
const CONTAINER_VARIANTS = {
  visible: {},
  hidden: {}
}

export const useAppAnimations = (isLayoutSwapped: boolean = false) => {
  // Only `isLayoutSwapped` can change, so only this useMemo is needed.
  // All variants are module-level constants — no allocation per render.
  return useMemo(
    () => ({
      leftPanelVariants: isLayoutSwapped ? RIGHT_PANEL_VARIANTS : LEFT_PANEL_VARIANTS,
      rightPanelVariants: isLayoutSwapped ? LEFT_PANEL_VARIANTS : RIGHT_PANEL_VARIANTS,
      resizerVariants: RESIZER_VARIANTS,
      containerVariants: CONTAINER_VARIANTS
    }),
    [isLayoutSwapped]
  )
}
