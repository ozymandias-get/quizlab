import { Easing, Transition, Variants } from 'framer-motion'

// Smooth spring easing
const smoothEase: Easing = [0.16, 1, 0.3, 1]

// ─── Panel Variants (Horizontal) ───────────────────────────────────
export const panelVariantsHorizontal: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.88,
        x: 12,
        // Remove blur animation if it causes issues, or use simple fade
        // filter: 'blur(8px)', 
    },
    visible: {
        opacity: 1,
        scale: 1,
        x: 0,
        // filter: 'blur(0px)',
        transition: {
            duration: 0.4,
            ease: smoothEase,
            staggerChildren: 0.05,
            delayChildren: 0.05,
        }
    },
    exit: {
        opacity: 0,
        scale: 0.92,
        x: 8,
        // filter: 'blur(6px)',
        transition: {
            duration: 0.25,
            ease: [0.4, 0, 1, 1],
            staggerChildren: 0.02,
            staggerDirection: -1,
        }
    }
}

// ─── Panel Variants (Vertical) ─────────────────────────────────────
export const panelVariantsVertical: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.88,
        y: 12,
        // filter: 'blur(8px)',
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        // filter: 'blur(0px)',
        transition: {
            duration: 0.4,
            ease: smoothEase,
            staggerChildren: 0.05,
            delayChildren: 0.05,
        }
    },
    exit: {
        opacity: 0,
        scale: 0.92,
        y: 8,
        // filter: 'blur(6px)',
        transition: {
            duration: 0.25,
            ease: [0.4, 0, 1, 1],
            staggerChildren: 0.02,
            staggerDirection: -1,
        }
    }
}

// ─── Panel transition (fallback) ───────────────────────────────────
export const panelTransition: Transition = {
    duration: 0.35,
    ease: smoothEase,
}

// ─── Individual tool item variants (stagger children) ──────────────
export const toolItemVariants: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.7,
        y: 8,
        // filter: 'blur(4px)',
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        // filter: 'blur(0px)',
        transition: {
            type: 'spring',
            stiffness: 420,
            damping: 26,
            mass: 0.8,
        }
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        y: 4,
        // filter: 'blur(3px)',
        transition: {
            duration: 0.15,
            ease: [0.4, 0, 1, 1],
        }
    }
}

// ─── Hub glow pulse animation ──────────────────────────────────────
export const hubGlowVariants: Variants = {
    idle: {
        opacity: [0.15, 0.35, 0.15],
        scale: [1, 1.08, 1],
        transition: {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
        }
    },
    active: {
        opacity: 0.5,
        scale: 1.15,
        transition: {
            duration: 0.3,
            ease: smoothEase,
        }
    }
}

// ─── Hub icon rotation (open/close) ────────────────────────────────
export const hubIconVariants: Variants = {
    closed: {
        rotate: 0,
        scale: 1,
    },
    open: {
        rotate: 135,
        scale: 1.1,
    }
}

export const hubIconTransition: Transition = {
    type: 'spring',
    stiffness: 300,
    damping: 20,
    mass: 0.7,
}

// ─── Tool List Staggering Container ────────────────────────────────
export const toolListVariants: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.08,
        }
    },
    exit: {
        transition: {
            staggerChildren: 0.03,
            staggerDirection: -1,
        }
    }
}

// ─── WebGL-like Icon Styles ────────────────────────────────────────
export const iconStyleVariants: Variants = {
    closed: {
        color: 'rgba(255,255,255,0.45)',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    },
    open: {
        color: '#ffffff',
        filter: 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.8)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.4))',
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }
}
