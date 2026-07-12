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
    bg: 'bg-violet-500/[0.15]',
    bgActive: 'bg-violet-500/25',
    text: 'text-violet-400/85',
    textActive: 'text-violet-300',
    glow: 'shadow-[0_0_14px_-3px_rgba(139,92,246,0.4)]',
    toggleTrack: 'bg-violet-500/35'
  },
  amber: {
    bg: 'bg-amber-500/[0.15]',
    bgActive: 'bg-amber-500/25',
    text: 'text-amber-400/85',
    textActive: 'text-amber-300',
    glow: 'shadow-[0_0_14px_-3px_rgba(245,158,11,0.4)]',
    toggleTrack: 'bg-amber-500/35'
  },
  sky: {
    bg: 'bg-sky-500/[0.15]',
    bgActive: 'bg-sky-500/25',
    text: 'text-sky-400/85',
    textActive: 'text-sky-300',
    glow: 'shadow-[0_0_14px_-3px_rgba(56,189,248,0.4)]',
    toggleTrack: 'bg-sky-500/35'
  },
  emerald: {
    bg: 'bg-emerald-500/[0.15]',
    bgActive: 'bg-emerald-500/25',
    text: 'text-emerald-400/85',
    textActive: 'text-emerald-300',
    glow: 'shadow-[0_0_14px_-3px_rgba(16,185,129,0.4)]',
    toggleTrack: 'bg-emerald-500/35'
  }
}
