import React, { useState, useEffect, useRef, useCallback, memo, Suspense, lazy } from 'react'
import { Logger } from '@src/utils/logger'
import { createPortal } from 'react-dom'

import { useAppearance, useAi } from '@src/app/providers'
import { CenterHub } from './CenterHub'
import { ToolsPanel } from './ToolsPanel'
import { ModelsPanel } from './ModelsPanel'
import { SettingsLoadingSpinner } from './SettingsLoadingSpinner'
import { useBottomBarStyles } from './useBottomBarStyles'

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

    const { shellStyle, stackStyle, panelStyle, hubStyle } = useBottomBarStyles(isOpen, bottomBarOpacity, bottomBarScale)

    useEffect(() => {
        if (isTourActive) {
            setIsOpen(true)
        }
    }, [isTourActive])

    useEffect(() => {
        const timer = setTimeout(() => {
            import('@src/features/settings/components/SettingsModal')
                .catch(err => Logger.error('Error prefetching SettingsModal:', err))
        }, 1500)
        return () => clearTimeout(timer)
    }, [])

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

    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        }
    }, [])

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

    const pointerStart = useRef({ x: 0, y: 0 })

    const handleHubPointerDown = useCallback((e: React.PointerEvent) => {
        pointerStart.current = { x: e.clientX, y: e.clientY }
    }, [])

    const handleHubPointerUp = useCallback((e: React.PointerEvent) => {
        const dx = Math.abs(e.clientX - pointerStart.current.x)
        const dy = Math.abs(e.clientY - pointerStart.current.y)

        if (dx < 5 && dy < 5) {
            handleToggle(e as unknown as React.MouseEvent)
        }
    }, [handleToggle])

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

    const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
        onMouseDown?.(e)
    }, [onMouseDown])

    return (
        <>

            <div
                ref={barRef}
                className={`resizer-hub-container bottom-bar-shell ${isOpen ? 'resizer-hub-container--open' : ''}`}
                style={shellStyle}
                onMouseEnter={() => onHoverChange?.(true)}
                onMouseLeave={() => onHoverChange?.(false)}
            >

                <div
                    className="resizer-drag-area"
                    onMouseDown={handleResizerMouseDown}
                />


                <div className="bottom-bar-stack relative flex flex-col items-center w-full" style={stackStyle}>

                    <ToolsPanel
                        isOpen={isOpen}
                        panelStyle={panelStyle}
                        handleSettingsClick={handleSettingsClick}
                        toggleLayoutSwap={toggleLayoutSwap}
                        isQuizMode={isQuizMode}
                        onToggleQuizMode={onToggleQuizMode}
                    />


                    <div onPointerDown={handleHubPointerDown} className="w-full">
                        <CenterHub
                            handleHubPointerUp={handleHubPointerUp}
                            onMouseDown={handleHubMouseDown}
                            isOpen={isOpen}
                            hubStyle={hubStyle}
                            tabsCount={tabs.length}
                        />
                    </div>


                    <ModelsPanel
                        isOpen={isOpen}
                        panelStyle={panelStyle}
                        showOnlyIcons={showOnlyIcons}
                    />
                </div>


                <div
                    className="resizer-drag-area"
                    onMouseDown={handleResizerMouseDown}
                />
            </div>


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
