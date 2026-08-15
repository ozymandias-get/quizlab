import type { Variants } from 'motion/react'

export const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.94,
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] }
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 360,
      damping: 30,
      mass: 0.9,
      opacity: { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
    }
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.96,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] }
  }
}

export const groupVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 }
  }
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }
  }
}

export type ColorKey = 'violet' | 'amber' | 'sky' | 'emerald'

export const colorMap: Record<
  ColorKey,
  {
    bg: string
    bgActive: string
    text: string
    textActive: string
    glow: string
    toggleTrack: string
  }
> = {
  violet: {
    bg: 'bg-primary/10',
    bgActive: 'bg-primary/20',
    text: 'text-primary',
    textActive: 'text-primary',
    glow: 'shadow-xs',
    toggleTrack: 'bg-primary/40'
  },
  amber: {
    bg: 'bg-amber-500/10',
    bgActive: 'bg-amber-500/20',
    text: 'text-amber-500',
    textActive: 'text-amber-500',
    glow: 'shadow-xs',
    toggleTrack: 'bg-amber-500/40'
  },
  sky: {
    bg: 'bg-sky-500/10',
    bgActive: 'bg-sky-500/20',
    text: 'text-sky-500',
    textActive: 'text-sky-500',
    glow: 'shadow-xs',
    toggleTrack: 'bg-sky-500/40'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    bgActive: 'bg-emerald-500/20',
    text: 'text-emerald-500',
    textActive: 'text-emerald-500',
    glow: 'shadow-xs',
    toggleTrack: 'bg-emerald-500/40'
  }
}
