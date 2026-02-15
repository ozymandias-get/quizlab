import { Variants, Easing } from 'framer-motion'
import React from 'react'

export const ANIMATION_DURATION = 0.4
export const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

export const LEFT_PANEL_VARIANTS: Variants = {
    visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: {
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE
        }
    },
    hidden: {
        opacity: 0,
        x: -30,
        scale: 0.97,
        transition: {
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE
        }
    }
}

export const RIGHT_PANEL_VARIANTS: Variants = {
    visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: {
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE
        }
    },
    hidden: {
        opacity: 0,
        x: 30,
        scale: 0.97,
        transition: {
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE
        }
    }
}

export const RESIZER_VARIANTS: Variants = {
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

export const CONTAINER_VARIANTS: Variants = {
    visible: {
        transition: {
            staggerChildren: 0.03,
            delayChildren: 0,
            when: "beforeChildren"
        }
    },
    hidden: {
        transition: {
            staggerChildren: 0.03,
            staggerDirection: -1,
            when: "afterChildren"
        }
    }
}

export const QUIZ_PANEL_VARIANTS: Variants = {
    initial: {
        opacity: 0,
        scale: 0.96,
        y: 20
    },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE,
            delay: 0.05
        }
    },
    exit: {
        opacity: 0,
        scale: 0.96,
        y: 20,
        transition: {
            duration: ANIMATION_DURATION * 0.85,
            ease: ANIMATION_EASE
        }
    }
}

export const SLIDE_VARIANTS = {
    enter: (direction: number) => ({
        x: direction > 0 ? 60 : -60,
        opacity: 0,
        scale: 0.98
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        scale: 1
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? 60 : -60,
        opacity: 0,
        scale: 0.98
    })
}

export const GPU_ACCELERATED_STYLE: React.CSSProperties = {
    willChange: 'transform, opacity',
    transform: 'translateZ(0)', // Force GPU layer
    backfaceVisibility: 'hidden'
}
