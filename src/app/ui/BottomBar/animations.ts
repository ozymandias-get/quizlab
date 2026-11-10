import { DURATION } from '@shared/lib/motion'

import type { Easing, Variants } from 'motion/react'

const smoothEase: Easing = [0.16, 1, 0.3, 1]

// Fullscreen FocusOverlay — used when a single panel (PDF or AI) takes over
// the whole window. The backdrop fades in with a slight blur; the content
// panel fades and reveals through a clip-path inset, so the two motion
// languages feel like one product without resampling the panel's contents.
// Exits are a hair faster (~200ms) to feel snappy on close, and skip the heavy
// `filter: blur` work for users who prefer reduced motion.
const FOCUS_EXIT_EASE: Easing = [0.4, 0, 1, 1]

export const focusBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.slower, ease: smoothEase }
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.slow, ease: FOCUS_EXIT_EASE }
  }
}

/**
 * No `scale`, no `filter: blur`: both force Chromium to rasterise the whole
 * panel (PDF canvases included) at a fractional scale, so text and hairlines
 * shimmer until the animation settles. A pixel-based `clip-path` inset plus
 * opacity gives the same "expanding panel" read without touching the raster.
 */
export const focusContentVariants: Variants = {
  hidden: {
    opacity: 0,
    clipPath: 'inset(1.5% 1.5% 1.5% 1.5% round 16px)',
    transition: { duration: DURATION.slow, ease: FOCUS_EXIT_EASE }
  },
  visible: {
    opacity: 1,
    clipPath: 'inset(0% 0% 0% 0% round 16px)',
    transition: {
      clipPath: { duration: DURATION.slower, ease: smoothEase },
      opacity: { duration: DURATION.slower, ease: smoothEase }
    }
  },
  exit: {
    opacity: 0,
    clipPath: 'inset(1% 1% 1% 1% round 16px)',
    transition: { duration: DURATION.slow, ease: FOCUS_EXIT_EASE }
  }
}

// Reduced-motion variant: keep the opacity transition but drop scale, blur
// and translate — those are exactly the properties that trigger
// vestibular discomfort.
export const focusBackdropReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.normal } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } }
}

export const focusContentReducedVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: DURATION.normal } },
  visible: { opacity: 1, transition: { duration: DURATION.slow } },
  exit: { opacity: 0, transition: { duration: DURATION.normal } }
}
