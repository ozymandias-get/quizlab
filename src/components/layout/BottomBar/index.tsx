import React, { useState, useEffect, useRef, useCallback, memo, Suspense, lazy } from 'react'
import { Logger } from '@src/utils/logger'
import { createPortal } from 'react-dom'

import { useAppearance, useAi } from '@src/app/providers'
import { CenterHub } from './CenterHub'
import { ToolsPanel } from './ToolsPanel'
import { ModelsPanel } from './ModelsPanel'
import { SettingsLoadingSpinner } from './SettingsLoadingSpinner'
import { useBottomBarStyles } from './useBottomBarStyles'

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

    const { tabs } = useAi()

    // Using custom hook for styles
    const { shellStyle, stackStyle, panelStyle, hubStyle } = useBottomBarStyles(isOpen, bottomBarOpacity, bottomBarScale)

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
                .catch(err => Logger.error('Error prefetching SettingsModal:', err))
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
                            tabsCount={tabs.length}
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
