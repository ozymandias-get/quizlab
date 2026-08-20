import { DURATION } from '@shared/lib/motion'
import { hexToRgba } from '@shared/lib/uiUtils'

import type { Variants } from 'motion/react'
import { useMemo } from 'react'

export const EXPANDED_PREF_KEY = 'aiSendComposerExpanded'

export function usePanelVariants(prefersReducedMotion: boolean | undefined): Variants {
  return useMemo(
    () =>
      prefersReducedMotion
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: DURATION.fast } },
            exit: { opacity: 0, transition: { duration: DURATION.fast } }
          }
        : {
            hidden: { opacity: 0, scale: 0.94, y: 8 },
            visible: {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }
            },
            exit: {
              opacity: 0,
              scale: 0.94,
              y: 8,
              transition: { duration: DURATION.fast, ease: [0.32, 0, 0.67, 0] }
            }
          },
    [prefersReducedMotion]
  )
}

export function useAccentStrong(selectionColor: string) {
  return useMemo(() => hexToRgba(selectionColor, 0.9), [selectionColor])
}
