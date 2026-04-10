import { useMemo, type CSSProperties } from 'react'

const HUB_VISUAL_TOKENS = {
  openBackground: `linear-gradient(155deg,
        rgba(12, 10, 8, var(--hub-open-bg-a, 0.92)) 0%,
        rgba(18, 16, 14, var(--hub-open-bg-b, 0.94)) 52%,
        rgba(40, 28, 18, var(--hub-open-bg-c, 0.92)) 100%)`,
  closedBackground: `linear-gradient(155deg,
        rgba(22, 20, 18, var(--hub-closed-bg-a, 0.86)) 0%,
        rgba(10, 10, 10, var(--hub-closed-bg-b, 0.9)) 100%)`,
  openShadow: `
        0 0 0 1px rgba(136, 102, 58, 0.2),
        0 0 24px -8px rgba(102, 76, 42, 0.2),
        0 0 34px -18px rgba(176, 118, 54, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.18),
        inset 0 -10px 18px rgba(8, 7, 6, 0.42),
        inset 0 0 16px rgba(124, 90, 48, 0.06)
    `,
  closedShadow: `
        0 14px 26px -14px rgba(0, 0, 0, 0.62),
        0 0 0 1px rgba(255, 255, 255, 0.07),
        inset 0 1.2px 0 rgba(255, 255, 255, 0.14),
        inset 0 -1px 0 rgba(0, 0, 0, 0.34),
        inset 0 0 14px rgba(0, 0, 0, 0.24)
    `
} as const

export const useBottomBarStyles = (
  isOpen: boolean,
  bottomBarOpacity: number,
  bottomBarScale: number
) => {
  const clampedOpacity = Math.min(1, Math.max(0.1, bottomBarOpacity))
  const clampedScale = Math.min(1.3, Math.max(0.7, bottomBarScale))
  const scaledBaseSize = Math.round(48 * clampedScale)

  const shellStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--bar-opacity-factor': clampedOpacity,
        '--bar-scale-factor': clampedScale,
        width: scaledBaseSize,
        minWidth: scaledBaseSize,
        maxWidth: scaledBaseSize,
        flexBasis: scaledBaseSize
      }) as CSSProperties,
    [clampedOpacity, clampedScale, scaledBaseSize]
  )

  const stackStyle = useMemo<CSSProperties>(
    () => ({
      zIndex: 50,
      width: scaledBaseSize,
      minWidth: scaledBaseSize,
      maxWidth: scaledBaseSize,
      transform: 'translateZ(0)',
      willChange: 'auto'
    }),
    [scaledBaseSize]
  )

  const panelStyle = useMemo<CSSProperties>(
    () => ({
      background: `linear-gradient(165deg,
            rgba(24, 20, 16, ${Math.min(0.9, 0.18 + clampedOpacity * 0.6)}) 0%,
            rgba(14, 12, 10, ${Math.min(0.94, 0.15 + clampedOpacity * 0.68)}) 42%,
            rgba(5, 5, 5, ${Math.min(0.97, 0.2 + clampedOpacity * 0.72)}) 100%)`,
      backdropFilter: 'blur(16px) saturate(118%)',
      WebkitBackdropFilter: 'blur(16px) saturate(118%)',
      border: `1px solid rgba(255, 255, 255, ${0.06 + clampedOpacity * 0.06})`,
      boxShadow: `
            0 24px 48px -28px rgba(0,0,0,${0.6 + clampedOpacity * 0.28}),
            0 14px 30px -24px rgba(8,12,20,${0.46 + clampedOpacity * 0.22}),
            0 0 0 1px rgba(255,255,255,${0.014 + clampedOpacity * 0.03}),
            inset 0 1px 0 rgba(255,255,255,${0.07 + clampedOpacity * 0.08}),
            inset 0 12px 20px -28px rgba(255,255,255,${0.05 + clampedOpacity * 0.05}),
            inset 0 -18px 28px -24px rgba(15,23,42,${0.16 + clampedOpacity * 0.16})
        `,
      borderRadius: Math.max(10, Math.round(14 * clampedScale)),
      transform: 'translateZ(0)',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden' as const
    }),
    [clampedOpacity, clampedScale]
  )

  const hubStyle = useMemo<CSSProperties>(
    () =>
      ({
        ...panelStyle,
        width: '100%',
        height: scaledBaseSize,
        borderRadius: Math.max(12, Math.round(16 * clampedScale)),
        padding: 0,
        overflow: 'hidden',
        '--hub-open-bg-a': Math.min(0.94, 0.34 + clampedOpacity * 0.58),
        '--hub-open-bg-b': Math.min(0.96, 0.38 + clampedOpacity * 0.56),
        '--hub-open-bg-c': Math.min(0.95, 0.34 + clampedOpacity * 0.58),
        '--hub-closed-bg-a': Math.min(0.9, 0.28 + clampedOpacity * 0.58),
        '--hub-closed-bg-b': Math.min(0.95, 0.34 + clampedOpacity * 0.56),

        background: isOpen ? HUB_VISUAL_TOKENS.openBackground : HUB_VISUAL_TOKENS.closedBackground,
        boxShadow: isOpen ? HUB_VISUAL_TOKENS.openShadow : HUB_VISUAL_TOKENS.closedShadow,

        border: 'none',
        willChange: 'transform, box-shadow, background',
        transition: 'all 0.4s cubic-bezier(0.2, 0.9, 0.22, 1)',
        opacity: 1,
        backfaceVisibility: 'hidden' as const,
        cursor: 'pointer'
      }) as CSSProperties,
    [panelStyle, isOpen, clampedOpacity, scaledBaseSize, clampedScale]
  )

  return { shellStyle, stackStyle, panelStyle, hubStyle }
}
