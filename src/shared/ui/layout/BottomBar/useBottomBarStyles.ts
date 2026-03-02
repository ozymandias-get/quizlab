import { useMemo } from 'react'

const HUB_VISUAL_TOKENS = {
    openBackground: `linear-gradient(155deg,
        rgba(14, 30, 42, var(--hub-open-bg-a, 0.92)) 0%,
        rgba(34, 27, 47, var(--hub-open-bg-b, 0.94)) 52%,
        rgba(58, 39, 21, var(--hub-open-bg-c, 0.92)) 100%)`,
    closedBackground: `linear-gradient(155deg,
        rgba(20, 24, 30, var(--hub-closed-bg-a, 0.86)) 0%,
        rgba(10, 13, 18, var(--hub-closed-bg-b, 0.9)) 100%)`,
    openShadow: `
        0 0 0 1px rgba(56, 189, 248, 0.3),
        0 0 28px -7px rgba(56, 189, 248, 0.45),
        0 0 42px -16px rgba(245, 158, 11, 0.38),
        inset 0 1px 0 rgba(255, 255, 255, 0.24),
        inset 0 -10px 18px rgba(3, 7, 18, 0.42),
        inset 0 0 20px rgba(56, 189, 248, 0.12)
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
    const clampedOpacity = useMemo(() => Math.min(1, Math.max(0.1, bottomBarOpacity)), [bottomBarOpacity])
    const clampedScale = useMemo(() => Math.min(1.3, Math.max(0.7, bottomBarScale)), [bottomBarScale])
    const scaledBaseSize = useMemo(() => Math.round(48 * clampedScale), [clampedScale])

    const shellStyle = useMemo<React.CSSProperties>(() => ({
        '--bar-opacity-factor': clampedOpacity,
        '--bar-scale-factor': clampedScale,
        width: scaledBaseSize,
        minWidth: scaledBaseSize,
        maxWidth: scaledBaseSize,
        flexBasis: scaledBaseSize,
    } as React.CSSProperties), [clampedOpacity, clampedScale, scaledBaseSize])

    const stackStyle = useMemo<React.CSSProperties>(() => ({
        zIndex: 50,
        width: scaledBaseSize,
        minWidth: scaledBaseSize,
        maxWidth: scaledBaseSize,
        transform: 'translateZ(0)',
        willChange: 'auto',
    }), [scaledBaseSize])

    const panelStyle = useMemo<React.CSSProperties>(() => ({
        background: `linear-gradient(165deg,
            rgba(30, 30, 36, ${Math.min(0.92, 0.12 + (clampedOpacity * 0.76))}) 0%,
            rgba(19, 19, 24, ${Math.min(0.95, 0.1 + (clampedOpacity * 0.8))}) 58%,
            rgba(12, 12, 16, ${Math.min(0.98, 0.12 + (clampedOpacity * 0.82))}) 100%)`,
        backdropFilter: 'blur(24px) saturate(190%)',
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        border: `1px solid rgba(255, 255, 255, ${0.03 + (clampedOpacity * 0.09)})`,
        boxShadow: `
            0 24px 45px -28px rgba(0,0,0,${0.52 + (clampedOpacity * 0.38)}),
            0 0 0 1px rgba(0,0,0,${0.18 + (clampedOpacity * 0.34)}),
            inset 0 1px 0 rgba(255,255,255,${0.05 + (clampedOpacity * 0.12)}),
            inset 0 -12px 24px -22px rgba(148,163,184,${0.08 + (clampedOpacity * 0.22)})
        `,
        borderRadius: Math.max(10, Math.round(14 * clampedScale)),
        transform: 'translateZ(0)',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden' as const,
    }), [clampedOpacity, clampedScale])

    const hubStyle = useMemo<React.CSSProperties>(() => ({
        ...panelStyle,
        width: '100%',
        height: scaledBaseSize,
        borderRadius: Math.max(12, Math.round(16 * clampedScale)),
        padding: 0,
        overflow: 'hidden',
        '--hub-open-bg-a': Math.min(0.94, 0.34 + (clampedOpacity * 0.58)),
        '--hub-open-bg-b': Math.min(0.96, 0.38 + (clampedOpacity * 0.56)),
        '--hub-open-bg-c': Math.min(0.95, 0.34 + (clampedOpacity * 0.58)),
        '--hub-closed-bg-a': Math.min(0.9, 0.28 + (clampedOpacity * 0.58)),
        '--hub-closed-bg-b': Math.min(0.95, 0.34 + (clampedOpacity * 0.56)),

        background: isOpen ? HUB_VISUAL_TOKENS.openBackground : HUB_VISUAL_TOKENS.closedBackground,
        boxShadow: isOpen ? HUB_VISUAL_TOKENS.openShadow : HUB_VISUAL_TOKENS.closedShadow,

        border: 'none',
        willChange: 'transform, box-shadow, background',
        transition: 'all 0.4s cubic-bezier(0.2, 0.9, 0.22, 1)',
        opacity: 1,
        backfaceVisibility: 'hidden' as const,
        cursor: 'pointer',
    } as React.CSSProperties), [panelStyle, isOpen, clampedOpacity, scaledBaseSize, clampedScale])

    return { shellStyle, stackStyle, panelStyle, hubStyle }
}
