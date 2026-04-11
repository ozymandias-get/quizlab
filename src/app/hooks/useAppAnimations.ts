import { useMemo, type CSSProperties } from 'react'
import type { Easing } from 'framer-motion'

const ANIMATION_DURATION = 0.4
const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

const DEFAULT_TRANSITION = {
  duration: ANIMATION_DURATION,
  ease: ANIMATION_EASE
}

export const useAppAnimations = (isLayoutSwapped: boolean = false) => {
  const gpuAcceleratedStyle = useMemo<CSSProperties>(
    () => ({
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden'
    }),
    []
  )

  const leftPanelVariants = useMemo(
    () => ({
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
    }),
    []
  )

  const rightPanelVariants = useMemo(
    () => ({
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
    }),
    []
  )

  const resizerVariants = useMemo(
    () => ({
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
    }),
    []
  )

  const containerVariants = useMemo(
    () => ({
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
    }),
    []
  )

  return useMemo(
    () => ({
      leftPanelVariants: isLayoutSwapped ? rightPanelVariants : leftPanelVariants,
      rightPanelVariants: isLayoutSwapped ? leftPanelVariants : rightPanelVariants,
      resizerVariants,
      containerVariants,
      gpuAcceleratedStyle
    }),
    [
      isLayoutSwapped,
      rightPanelVariants,
      leftPanelVariants,
      resizerVariants,
      containerVariants,
      gpuAcceleratedStyle
    ]
  )
}
