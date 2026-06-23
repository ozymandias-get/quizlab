import { type Easing, type Transition, type Variants } from 'motion/react'

const smoothEase: Easing = [0.16, 1, 0.3, 1]

// Premium spring for panels
const panelSpring: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 1.1
}

// Fullscreen FocusOverlay — used when a single panel (PDF or AI) takes over
// the whole window. The backdrop fades in with a slight blur; the content
// panel scales+fades in with the same premium spring the bottom-bar panels
// use, so the two motion languages feel like one product. Exits are a hair
// faster (~200ms) to feel snappy on close, and skip the heavy `filter: blur`
// work for users who prefer reduced motion.
const FOCUS_EXIT_EASE: Easing = [0.4, 0, 1, 1]

export const focusBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.28, ease: smoothEase }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: FOCUS_EXIT_EASE }
  }
}

export const focusContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    filter: 'blur(8px)',
    transition: { duration: 0.18, ease: FOCUS_EXIT_EASE }
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      ...panelSpring,
      opacity: { duration: 0.28, ease: smoothEase },
      filter: { duration: 0.28, ease: smoothEase }
    }
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: FOCUS_EXIT_EASE }
  }
}

// Reduced-motion variant: keep the opacity transition but drop scale, blur
// and translate — those are exactly the properties that trigger
// vestibular discomfort.
export const focusBackdropReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
}

export const focusContentReducedVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.12 } },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.12 } }
}
