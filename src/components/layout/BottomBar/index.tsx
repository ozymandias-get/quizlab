import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'

import { useAppearance } from '@src/app/providers'
import { CenterHub } from './CenterHub'
import { ToolsPanel } from './ToolsPanel'
import { ModelsPanel } from './ModelsPanel'
import { SettingsLoadingSpinner } from './SettingsLoadingSpinner'

// Lazy load SettingsModal
const SettingsModal = lazy(() => import('@src/features/settings/components/SettingsModal'))

interface BottomBarProps {
    onHoverChange?: (isHovering: boolean) => void;
    isQuizMode: boolean;
    onToggleQuizMode: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
}

function BottomBar({ onHoverChange, isQuizMode, onToggleQuizMode, onMouseDown }: BottomBarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // Refs
    const barRef = useRef<HTMLDivElement>(null)
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const {
        bottomBarOpacity,
        bottomBarScale,
        showOnlyIcons,
        toggleLayoutSwap,
        isTourActive
    } = useAppearance()

    // Tur aktifken menüyü AÇIK tut
    useEffect(() => {
        if (isTourActive) {
            setIsOpen(true)
        }
    }, [isTourActive])

    // Preload settings modal (Prefetch)
    useEffect(() => {
        const timer = setTimeout(() => {
            import('@src/features/settings/components/SettingsModal')
                .catch(err => console.error('Error prefetching SettingsModal:', err))
        }, 1500)
        return () => clearTimeout(timer)
    }, [])

    // Click outside handler - Tur sırasında ve settings açıkken devre dışı
    useEffect(() => {
        if (!isOpen || isTourActive || isSettingsOpen) return
        const handler = (e: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [isOpen, isTourActive, isSettingsOpen])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        }
    }, [])

    // Toggle Logic
    const handleToggle = useCallback((e?: React.MouseEvent) => {
        if (isAnimating) {
            e?.stopPropagation()
            return
        }

        setIsAnimating(true)
        setIsOpen(prev => !prev)

        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 400)
    }, [isAnimating])

    // Track pointer start for distinguishing click vs drag
    const pointerStart = useRef({ x: 0, y: 0 })

    const handleHubPointerDown = useCallback((e: React.PointerEvent) => {
        pointerStart.current = { x: e.clientX, y: e.clientY }
    }, [])

    const handleHubPointerUp = useCallback((e: React.PointerEvent) => {
        const dx = Math.abs(e.clientX - pointerStart.current.x)
        const dy = Math.abs(e.clientY - pointerStart.current.y)

        // If movement was tiny, it's a click → toggle the menu
        if (dx < 5 && dy < 5) {
            handleToggle(e as unknown as React.MouseEvent)
        }
    }, [handleToggle])

    // When hub is closed, mouse down on the hub also triggers resize
    const handleHubMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isOpen) {
            onMouseDown?.(e)
        }
    }, [isOpen, onMouseDown])

    const handleSettingsClick = useCallback(() => {
        setIsSettingsOpen(true)
    }, [])

    const handleSettingsClose = useCallback(() => {
        setIsSettingsOpen(false)
    }, [])

    // Resizer area mouse down — pass through to parent for panel resize
    const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
        onMouseDown?.(e)
    }, [onMouseDown])

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
        borderRadius: 12,
        padding: 0,
        // Open state: center capsule gets stronger depth and accent light
        // Closed state: Matches panels perfectly
        background: isOpen
            ? `linear-gradient(145deg,
                rgba(40, 40, 48, ${Math.min(0.96, 0.18 + (clampedOpacity * 0.74))}) 0%,
                rgba(24, 24, 30, ${Math.min(0.98, 0.22 + (clampedOpacity * 0.74))}) 55%,
                rgba(14, 14, 18, ${Math.min(0.99, 0.24 + (clampedOpacity * 0.74))}) 100%)`
            : panelStyle.background,
        boxShadow: isOpen
            ? `
                0 18px 34px -24px rgba(0,0,0,${0.56 + (clampedOpacity * 0.38)}),
                0 0 32px -16px rgba(56,189,248,${0.08 + (clampedOpacity * 0.3)}),
                0 0 24px -14px rgba(251,191,36,${0.08 + (clampedOpacity * 0.22)}),
                inset 0 0 0 1px rgba(255,255,255,${0.07 + (clampedOpacity * 0.17)}),
                inset 0 1px 0 rgba(255,255,255,${0.08 + (clampedOpacity * 0.14)})
            `
            : panelStyle.boxShadow,
        border: isOpen
            ? `1px solid rgba(255,255,255,${0.05 + (clampedOpacity * 0.12)})`
            : panelStyle.border,
        willChange: 'transform',
        opacity: 1,
        backfaceVisibility: 'hidden' as const,
    }), [panelStyle, isOpen, clampedOpacity])

    return (
        <>
            {/* Full-height container in the resizer area */}
            <div
                ref={barRef}
                className={`resizer-hub-container bottom-bar-shell ${isOpen ? 'resizer-hub-container--open' : ''}`}
                style={shellStyle}
                onMouseEnter={() => onHoverChange?.(true)}
                onMouseLeave={() => onHoverChange?.(false)}
            >
                {/* Top resizer drag area */}
                <div
                    className="resizer-drag-area"
                    onMouseDown={handleResizerMouseDown}
                />

                {/* Hub + Panels Zone - w-full ensures perfect centering */}
                <div className="bottom-bar-stack relative flex flex-col items-center w-full" style={stackStyle}>
                    {/* TOOLS PANEL — opens upward */}
                    <ToolsPanel
                        isOpen={isOpen}
                        panelStyle={panelStyle}
                        handleSettingsClick={handleSettingsClick}
                        toggleLayoutSwap={toggleLayoutSwap}
                        isQuizMode={isQuizMode}
                        onToggleQuizMode={onToggleQuizMode}
                    />

                    {/* CENTER HUB */}
                    <div onPointerDown={handleHubPointerDown} className="w-full">
                        <CenterHub
                            handleHubPointerUp={handleHubPointerUp}
                            onMouseDown={handleHubMouseDown}
                            isOpen={isOpen}
                            hubStyle={hubStyle}
                        />
                    </div>

                    {/* MODELS PANEL — opens downward */}
                    <ModelsPanel
                        isOpen={isOpen}
                        panelStyle={panelStyle}
                        showOnlyIcons={showOnlyIcons}
                    />
                </div>

                {/* Bottom resizer drag area */}
                <div
                    className="resizer-drag-area"
                    onMouseDown={handleResizerMouseDown}
                />
            </div>

            {/* SettingsModal — rendered via Portal to escape the resizer container */}
            {createPortal(
                <Suspense fallback={<SettingsLoadingSpinner />}>
                    {isSettingsOpen && (
                        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
                    )}
                </Suspense>,
                document.body
            )}
        </>
    )
}

export default memo(BottomBar)
