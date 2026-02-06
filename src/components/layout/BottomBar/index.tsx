import React, { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense, lazy } from 'react'
import { motion, PanInfo } from 'framer-motion'
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
}

function BottomBar({ onHoverChange, isQuizMode, onToggleQuizMode }: BottomBarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // Refs
    const barRef = useRef<HTMLDivElement>(null)
    const constraintsRef = useRef<HTMLDivElement>(null)
    const dragStartPosition = useRef({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const lastDragTime = useRef(0)
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    // Layout thrashing prevention: Cache bar dimensions
    const barDimensions = useRef({ width: 400, height: 60 })

    const {
        bottomBarOpacity,
        bottomBarScale,
        floatingBarPos,
        setFloatingBarPos,
        showOnlyIcons,
        bottomBarLayout,
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
            // Sadece modülü indirip cache'lemesi için çağırıyoruz
            import('@src/features/settings/components/SettingsModal')
                .catch(err => console.error('Error prefetching SettingsModal:', err))
        }, 1500)
        return () => clearTimeout(timer)
    }, [])

    // Click outside handler - Tur sırasında devre dışı
    useEffect(() => {
        if (!isOpen || isTourActive) return
        const handler = (e: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [isOpen, isTourActive])

    // Update dimensions on mount and resize
    useEffect(() => {
        const updateDimensions = () => {
            if (barRef.current) {
                const rect = barRef.current.getBoundingClientRect()
                barDimensions.current = {
                    width: rect.width || 400,
                    height: rect.height || 60
                }
            }
        }

        updateDimensions()
        window.addEventListener('resize', updateDimensions)
        return () => window.removeEventListener('resize', updateDimensions)
    }, [])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        }
    }, [])

    // Drag Logic
    const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const proposedX = floatingBarPos.x + info.offset.x
        const proposedY = floatingBarPos.y + info.offset.y

        const { width: barWidth, height: barHeight } = barDimensions.current
        const margin = 12

        // X Axis Boundaries
        const xLimit = (window.innerWidth - barWidth) / 2 - margin
        const clampedX = Math.min(Math.max(proposedX, -xLimit), xLimit)

        // Y Axis Boundaries
        const minY = -(window.innerHeight - 24 - barHeight) + margin
        const maxY = 24 - margin
        const clampedY = Math.min(Math.max(proposedY, minY), maxY)

        setFloatingBarPos({
            x: clampedX,
            y: clampedY
        })

        if (isDragging.current) {
            lastDragTime.current = Date.now()
        }
        isDragging.current = false
    }, [floatingBarPos, setFloatingBarPos])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return
        dragStartPosition.current = { x: e.clientX, y: e.clientY }
        isDragging.current = false
    }, [])

    // Toggle Logic
    const handleToggle = useCallback((e?: React.MouseEvent) => {
        const timeSinceDrag = Date.now() - lastDragTime.current
        if (isDragging.current || isAnimating || timeSinceDrag < 150) {
            e?.stopPropagation()
            return
        }

        setIsAnimating(true)
        setIsOpen(prev => !prev)

        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), 400)
    }, [isAnimating])

    // Hub Interaction Handler
    const handleHubPointerUp = useCallback((e: React.PointerEvent) => {
        const dx = Math.abs(e.clientX - dragStartPosition.current.x)
        const dy = Math.abs(e.clientY - dragStartPosition.current.y)

        if (dx < 5 && dy < 5) {
            handleToggle(e as unknown as React.MouseEvent)
        }

        if (dx > 3 || dy > 3) {
            isDragging.current = true
        }
    }, [handleToggle])

    const handleSettingsClick = useCallback(() => setIsSettingsOpen(true), [])
    const handleSettingsClose = useCallback(() => setIsSettingsOpen(false), [])

    // Memoized panel style
    const panelStyle = useMemo<React.CSSProperties>(() => ({
        background: `linear-gradient(165deg, 
            rgba(28, 28, 32, ${bottomBarOpacity}) 0%, 
            rgba(20, 20, 24, ${bottomBarOpacity}) 50%,
            rgba(16, 16, 18, ${bottomBarOpacity}) 100%)`,
        backdropFilter: 'blur(12px) saturate(150%)',
        WebkitBackdropFilter: 'blur(12px) saturate(150%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
            0 20px 40px -10px rgba(0,0,0,0.5),
            0 8px 16px -6px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 -1px 0 rgba(0,0,0,0.15)
        `,
        borderRadius: 18,
        transform: 'translateZ(0)',
        willChange: 'width, opacity, height'
    }), [bottomBarOpacity])

    const hubStyle = useMemo<React.CSSProperties>(() => ({
        ...panelStyle,
        boxShadow: isOpen
            ? `
                0 0 30px -8px rgba(255,255,255,0.15),
                0 20px 40px -10px rgba(0,0,0,0.5),
                inset 0 1px 0 rgba(255,255,255,0.12),
                inset 0 -1px 0 rgba(0,0,0,0.15)
            `
            : panelStyle.boxShadow,
        border: isOpen ? '1px solid rgba(255,255,255,0.15)' : panelStyle.border,
        willChange: 'transform',
        width: 'auto',
        opacity: 1
    }), [panelStyle, isOpen])

    return (
        <>
            <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-50">
                <motion.div
                    drag
                    dragConstraints={constraintsRef}
                    dragElastic={0.05}
                    dragMomentum={false}
                    onDragEnd={handleDragEnd}
                    onPointerDown={handlePointerDown}
                    initial={floatingBarPos}
                    animate={floatingBarPos}
                    className="absolute pointer-events-auto left-1/2 bottom-6"
                    style={{ transform: 'translateX(-50%)' }}
                >
                    <div
                        ref={barRef}
                        className="relative"
                        style={{ transform: `scale(${bottomBarScale})`, transformOrigin: 'center' }}
                        onMouseEnter={() => onHoverChange?.(true)}
                        onMouseLeave={() => onHoverChange?.(false)}
                    >
                        {/* CENTER HUB */}
                        <CenterHub
                            handleHubPointerUp={handleHubPointerUp}
                            isOpen={isOpen}
                            hubStyle={hubStyle}
                        />

                        {/* LEFT PANEL - TOOLS */}
                        <ToolsPanel
                            isOpen={isOpen}
                            bottomBarLayout={bottomBarLayout as 'horizontal' | 'vertical'}
                            panelStyle={panelStyle}
                            handleSettingsClick={handleSettingsClick}
                            toggleLayoutSwap={toggleLayoutSwap}
                            isQuizMode={isQuizMode}
                            onToggleQuizMode={onToggleQuizMode}
                        />

                        {/* RIGHT PANEL - AI MODELS */}
                        <ModelsPanel
                            isOpen={isOpen}
                            bottomBarLayout={bottomBarLayout as 'horizontal' | 'vertical'}
                            panelStyle={panelStyle}
                            showOnlyIcons={showOnlyIcons}
                        />
                    </div>
                </motion.div>
            </div>

            <Suspense fallback={<SettingsLoadingSpinner />}>
                {isSettingsOpen && (
                    <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
                )}
            </Suspense>
        </>
    )
}

export default memo(BottomBar)

