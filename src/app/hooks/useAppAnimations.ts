import type { Easing } from 'motion/react'
import { type CSSProperties, useMemo } from 'react'

const ANIMATION_DURATION = 0.4
const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

const DEFAULT_TRANSITION = {
  duration: ANIMATION_DURATION,
  ease: ANIMATION_EASE
}

// Static variants defined once outside the component to avoid re-creating
// them on every render. These never change, so useMemo is unnecessary.
const GPU_ACCELERATED_STYLE: CSSProperties = {
  willChange: 'transform, opacity',
  transform: 'translateZ(0)'
}

const LEFT_PANEL_VARIANTS = {
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: DEFAULT_TRANSITION
  },
  hidden: {
    opacity: 0,
    x: -30,
    scale: 0.97,
    transition: DEFAULT_TRANSITION
  }
}

const RIGHT_PANEL_VARIANTS = {
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: DEFAULT_TRANSITION
  },
  hidden: {
    opacity: 0,
    x: 30,
    scale: 0.97,
    transition: DEFAULT_TRANSITION
  }
}

const RESIZER_VARIANTS = {
  visible: {
    opacity: 1,
    scaleY: 1,
    transition: { duration: ANIMATION_DURATION * 0.75, ease: ANIMATION_EASE }
  },
  hidden: {
    opacity: 0,
    scaleY: 0,
    transition: { duration: ANIMATION_DURATION * 0.5, ease: ANIMATION_EASE }
  }
}

const CONTAINER_VARIANTS = {
  visible: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0,
      when: 'beforeChildren'
    }
  },
  hidden: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
      when: 'afterChildren'
    }
  }
}

export const useAppAnimations = (isLayoutSwapped: boolean = false) => {
  // Only `isLayoutSwapped` can change, so only this useMemo is needed.
  // All variants are module-level constants — no allocation per render.
  return useMemo(
    () => ({
      leftPanelVariants: isLayoutSwapped ? RIGHT_PANEL_VARIANTS : LEFT_PANEL_VARIANTS,
      rightPanelVariants: isLayoutSwapped ? LEFT_PANEL_VARIANTS : RIGHT_PANEL_VARIANTS,
      resizerVariants: RESIZER_VARIANTS,
      containerVariants: CONTAINER_VARIANTS,
      gpuAcceleratedStyle: GPU_ACCELERATED_STYLE
    }),
    [isLayoutSwapped]
  )
}
