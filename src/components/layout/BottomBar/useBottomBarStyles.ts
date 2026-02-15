import { useMemo } from 'react'

export const useBottomBarStyles = (
    isOpen: boolean,
    bottomBarOpacity: number,
    bottomBarScale: number
) => {
    const clampedOpacity = useMemo(() => Math.min(1, Math.max(0.1, bottomBarOpacity)), [bottomBarOpacity])
    const clampedScale = useMemo(() => Math.min(1.3, Math.max(0.7, bottomBarScale)), [bottomBarScale])
    const scaledShellWidth = useMemo(() => Math.round(48 * clampedScale), [clampedScale])

    const shellStyle = useMemo<React.CSSProperties>(() => ({
        '--bar-opacity-factor': clampedOpacity,
        '--bar-scale-factor': clampedScale,
        width: scaledShellWidth,
        minWidth: scaledShellWidth,
        maxWidth: scaledShellWidth,
        flexBasis: scaledShellWidth,
    } as React.CSSProperties), [clampedOpacity, clampedScale, scaledShellWidth])

    const stackStyle = useMemo<React.CSSProperties>(() => ({
        zIndex: 50,
        width: 48,
        minWidth: 48,
        transform: `translateZ(0) scale(${clampedScale})`,
        transformOrigin: 'center',
        willChange: 'transform',
    }), [clampedScale])

    // Memoized panel style — segmented glass capsules between the two main panels
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
        borderRadius: 14,
        transform: 'translateZ(0)',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden' as const,
    }), [clampedOpacity])

    const hubStyle = useMemo<React.CSSProperties>(() => ({
        ...panelStyle,
        width: '100%',
        height: 48,
        borderRadius: 16, // Smoother, more organic shape
        padding: 0,

        // Advanced "Holographic Glass" Gradient
        background: isOpen
            ? `linear-gradient(135deg, 
                rgba(60, 50, 80, ${Math.min(0.95, 0.4 + (clampedOpacity * 0.6))}) 0%, 
                rgba(30, 20, 60, ${Math.min(0.98, 0.5 + (clampedOpacity * 0.5))}) 50%,
                rgba(30, 30, 50, ${Math.min(0.95, 0.4 + (clampedOpacity * 0.6))}) 100%)`
            : `linear-gradient(135deg, 
                rgba(40, 40, 45, ${Math.min(0.9, 0.3 + (clampedOpacity * 0.6))}) 0%,
                rgba(20, 20, 24, ${Math.min(0.95, 0.35 + (clampedOpacity * 0.6))}) 100%)`,

        // Deep, layered lighting effects
        boxShadow: isOpen
            ? `
                0 0 0 1px rgba(167, 139, 250, 0.25), /* Outer ring hint */
                0 0 25px -5px rgba(167, 139, 250, 0.5), /* Primary violet glow */
                0 0 50px -10px rgba(79, 70, 229, 0.2), /* Secondary indigo ambient */
                inset 0 1px 0 rgba(255, 255, 255, 0.25), /* Top highlight */
                inset 0 0 20px rgba(167, 139, 250, 0.15) /* Inner volume */
            `
            : `
                0 15px 35px -10px rgba(0, 0, 0, 0.6), /* Deep drop shadow */
                0 0 0 1px rgba(255, 255, 255, 0.08), /* Subtle border */
                inset 0 1.5px 0 rgba(255, 255, 255, 0.12), /* Sharp top edge light */
                inset 0 -1px 0 rgba(0, 0, 0, 0.3), /* Bottom depth */
                inset 0 0 15px rgba(0, 0, 0, 0.3) /* Inner darkness */
            `,

        // Dynamic border handling
        border: 'none', // relying on box-shadow for cleaner borders

        willChange: 'transform, box-shadow, background',
        transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)', // "Expo" ease for premium feel
        opacity: 1,
        backfaceVisibility: 'hidden' as const,
        cursor: 'pointer',
    }), [panelStyle, isOpen, clampedOpacity])

    return { shellStyle, stackStyle, panelStyle, hubStyle }
}
