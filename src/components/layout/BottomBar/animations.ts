import { Easing } from 'framer-motion'

// Horizontal layout variants
export const panelVariantsHorizontal = {
    hidden: { width: 0, opacity: 0 },
    visible: { width: 'auto', opacity: 1 },
    exit: { width: 0, opacity: 0 }
}

// Vertical layout variants
export const panelVariantsVertical = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 }
}

export const panelTransition = {
    duration: 0.28,
    ease: [0.16, 1, 0.3, 1] as Easing
}
