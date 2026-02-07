import { Easing } from 'framer-motion'

// Horizontal layout variants
export const panelVariantsHorizontal = {
    hidden: { opacity: 0, scale: 0.96, x: 6 },
    visible: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.96, x: 6 }
}

// Vertical layout variants
export const panelVariantsVertical = {
    hidden: { opacity: 0, scale: 0.96, y: 6 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 6 }
}

export const panelTransition = {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1] as Easing
}
