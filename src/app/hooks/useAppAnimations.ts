import React, { useMemo } from 'react'
import type { Easing } from 'framer-motion'

export const ANIMATION_DURATION = 0.4
export const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

// Default transition setting
const DEFAULT_TRANSITION = {
    duration: ANIMATION_DURATION,
    ease: ANIMATION_EASE
}

export const useAppAnimations = (isLayoutSwapped: boolean = false) => {
    // GPU acceleration styles
    const gpuAcceleratedStyle = useMemo<React.CSSProperties>(() => ({
        willChange: 'transform, opacity',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
    }), [])

    const leftPanelVariants = useMemo(() => ({
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
    }), [])

    const rightPanelVariants = useMemo(() => ({
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
    }), [])

    const resizerVariants = useMemo(() => ({
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
    }), [])

    const containerVariants = useMemo(() => ({
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
    }), [])

    const quizPanelVariants = useMemo(() => ({
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
    }), [])

    return {
        leftPanelVariants: isLayoutSwapped ? rightPanelVariants : leftPanelVariants,
        rightPanelVariants: isLayoutSwapped ? leftPanelVariants : rightPanelVariants, // Swap logic handled here
        resizerVariants,
        containerVariants,
        quizPanelVariants,
        gpuAcceleratedStyle
    }
}
