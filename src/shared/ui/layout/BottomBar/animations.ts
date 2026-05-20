import { Easing, Transition, Variants } from 'framer-motion'

export const smoothEase: Easing = [0.16, 1, 0.3, 1]

// Premium spring for panels
export const panelSpring: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 1.1
}

// Faster spring for items
export const itemSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
  mass: 0.8
}

export const panelVariantsVertical: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1]
    },
    transitionEnd: {
      display: 'none'
    }
  },
  visible: {
    display: 'block',
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...panelSpring,
      opacity: { duration: 0.2, ease: smoothEase }
    }
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1]
    }
  }
}

export const toolItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.85
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: itemSpring
  },
  exit: {
    opacity: 0,
    y: 5,
    scale: 0.9,
    transition: {
      duration: 0.12,
      ease: [0.4, 0, 1, 1]
    }
  }
}

export const hubGlowVariants: Variants = {
  idle: {
    opacity: 0.2,
    scale: 1,
    transition: {
      duration: 2,
      ease: 'easeInOut'
    }
  },
  active: {
    opacity: 0.45,
    scale: 1.12,
    transition: {
      duration: 0.3,
      ease: smoothEase
    }
  }
}

export const hubIconVariants: Variants = {
  closed: {
    rotate: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  },
  open: {
    rotate: 135,
    scale: 1.15,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 20
    }
  }
}

export const hubIconTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 20
}

export const toolListVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1
    }
  }
}

export const iconStyleVariants: Variants = {
  closed: {
    color: 'rgba(226, 232, 240, 0.75)',
    transition: { duration: 0.3, ease: smoothEase }
  },
  open: {
    color: '#ffffff',
    transition: { duration: 0.3, ease: smoothEase }
  }
}
