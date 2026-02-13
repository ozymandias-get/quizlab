import React, { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion, LayoutGroup, Easing } from 'framer-motion'
import AiWebview from '@src/features/ai/components/AiWebview'
import BottomBar from '@src/components/layout/BottomBar'
import FloatingButton from '@ui/FloatingButton'
import ScreenshotTool from '@ui/ScreenshotTool'
import UpdateBanner from '@ui/UpdateBanner'
import AestheticLoader from '@src/components/ui/AestheticLoader'
import LeftPanel from '@src/components/layout/LeftPanel'
import AppBackground from '@src/components/layout/AppBackground'
import ToastContainer from '@ui/Toast/ToastContainer'
import UsageAssistant from '@src/features/tutorial/components/UsageAssistant'
import { QuizModule } from '@src/features/quiz/components'


// Context & Constants
import { useAi, useAppTools, useUpdate, useAppearance, useLanguage } from './providers'

import { STORAGE_KEYS } from '@src/constants/storageKeys'



// Hooks
import { usePanelResize, useOnlineStatus, usePdfSelection } from '@src/hooks'



const App: React.FC = () => {

    const { t } = useLanguage()
    useOnlineStatus() // Activate global connection monitoring

    // Global state from specific contexts
    const { sendTextToAI } = useAi()
    const { isScreenshotMode, handleCapture, closeScreenshot } = useAppTools()
    const { updateAvailable, updateInfo } = useUpdate()
    const { isLayoutSwapped, isTourActive, setIsTourActive } = useAppearance()


    // Panel resize hook
    const {
        leftPanelWidth,
        isResizing,
        handleMouseDown,
        leftPanelRef,
        resizerRef
    } = usePanelResize({
        initialWidth: 50,
        minLeft: 300,
        minRight: 400,
        storageKey: STORAGE_KEYS.LEFT_PANEL_WIDTH,
        isReversed: isLayoutSwapped
    })

    // PDF Selection Hook
    const { pdfFile, handleSelectPdf, handlePdfDrop, resumeLastPdf, getLastReadingInfo } = usePdfSelection()

    // Last reading info for resume button
    const lastReadingInfo = getLastReadingInfo()
    const [initialPage, setInitialPage] = React.useState<number | undefined>(undefined)

    // Local State
    const [selectedText, setSelectedText] = useState<string>('')
    const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null)
    const [isBarHovered, setIsBarHovered] = useState<boolean>(false)
    const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState<boolean>(true)
    const [isQuizMode, setIsQuizMode] = useState<boolean>(false) // Quiz Mode toggle
    const [isWebviewMounted, setIsWebviewMounted] = useState<boolean>(false)

    useEffect(() => {
        let cancelled = false
        const browserWindow = window as Window & {
            requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
            cancelIdleCallback?: (handle: number) => void;
        }

        const mountWebview = () => {
            if (!cancelled) setIsWebviewMounted(true)
        }

        if (browserWindow.requestIdleCallback) {
            const idleId = browserWindow.requestIdleCallback(mountWebview, { timeout: 300 })
            return () => {
                cancelled = true
                browserWindow.cancelIdleCallback?.(idleId)
            }
        }

        const timeoutId = globalThis.setTimeout(mountWebview, 120)
        return () => {
            cancelled = true
            globalThis.clearTimeout(timeoutId)
        }
    }, [])
    const handleTextSelection = useCallback((text: string, position: { top: number; left: number } | null) => {
        setSelectedText(text)
        setSelectionPosition(position)
    }, [])

    const handleSendToAI = useCallback(async () => {
        if (!selectedText) return
        const result = await sendTextToAI(selectedText)

        if (result.success) {
            setSelectedText('')
            setSelectionPosition(null)
        }
    }, [selectedText, sendTextToAI])

    // Shared animation timing for synchronization
    const ANIMATION_DURATION = 0.4
    const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

    // GPU-accelerated panel animation variants settings wrapped in useMemo
    const leftPanelVariants = React.useMemo(() => ({
        visible: {
            opacity: 1,
            x: 0,
            scale: 1,
            transition: {
                duration: ANIMATION_DURATION,
                ease: ANIMATION_EASE
            }
        },
        hidden: {
            opacity: 0,
            x: -30,
            scale: 0.97,
            transition: {
                duration: ANIMATION_DURATION,
                ease: ANIMATION_EASE
            }
        }
    }), [])

    const rightPanelVariants = React.useMemo(() => ({
        visible: {
            opacity: 1,
            x: 0,
            scale: 1,
            transition: {
                duration: ANIMATION_DURATION,
                ease: ANIMATION_EASE
            }
        },
        hidden: {
            opacity: 0,
            x: 30,
            scale: 0.97,
            transition: {
                duration: ANIMATION_DURATION,
                ease: ANIMATION_EASE
            }
        }
    }), [])

    const resizerVariants = React.useMemo(() => ({
        visible: {
            opacity: 1,
            scaleY: 1,
            transition: { duration: ANIMATION_DURATION * 0.75, ease: ANIMATION_EASE }
        },
        hidden: {
            opacity: 0,
            scaleY: 0,
            transition: { duration: ANIMATION_DURATION * 0.5, ease: ANIMATION_EASE }
        }
    }), [])

    // Container variants for synchronized children animation
    const containerVariants = React.useMemo(() => ({
        visible: {
            transition: {
                staggerChildren: 0.03,
                delayChildren: 0,
                when: "beforeChildren"
            }
        },
        hidden: {
            transition: {
                staggerChildren: 0.03,
                staggerDirection: -1,
                when: "afterChildren"
            }
        }
    }), [])

    // Quiz panel variants
    const quizPanelVariants = React.useMemo(() => ({
        initial: {
            opacity: 0,
            scale: 0.96,
            y: 20
        },
        animate: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                duration: ANIMATION_DURATION,
                ease: ANIMATION_EASE,
                delay: 0.05
            }
        },
        exit: {
            opacity: 0,
            scale: 0.96,
            y: 20,
            transition: {
                duration: ANIMATION_DURATION * 0.85,
                ease: ANIMATION_EASE
            }
        }
    }), [])

    // GPU acceleration styles
    const gpuAcceleratedStyle = React.useMemo<React.CSSProperties>(() => ({
        willChange: 'transform, opacity',
        transform: 'translateZ(0)', // Force GPU layer
        backfaceVisibility: 'hidden'
    }), [])

    return (
        <LayoutGroup>
            <div
                className="h-screen w-screen overflow-hidden relative animate-app-enter"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handlePdfDrop(e.dataTransfer.files[0])
                    }
                }}
            >
                <AppBackground />

                {/* Global Toast Notifications */}
                <ToastContainer />

                <UpdateBanner
                    updateAvailable={updateAvailable}
                    updateInfo={updateInfo}
                    isVisible={isUpdateBannerVisible}
                    onClose={() => setIsUpdateBannerVisible(false)}
                    t={t}
                />

                {/* Main Content Area with AnimatePresence for Quiz transition */}
                <AnimatePresence mode="wait" initial={false}>
                    {!isQuizMode ? (
                        /* Normal Mode - Two Panels */
                        <motion.main
                            key="main-panels"
                            initial={false}
                            animate="visible"
                            exit="hidden"
                            variants={containerVariants}
                            className={`flex h-screen w-screen p-5 ${isLayoutSwapped ? 'flex-row-reverse' : 'flex-row'}`}
                            style={gpuAcceleratedStyle}
                        >
                            {/* Left Panel Wrapper */}
                            <motion.div
                                ref={leftPanelRef as React.RefObject<HTMLDivElement>}
                                variants={isLayoutSwapped ? rightPanelVariants : leftPanelVariants}
                                style={{
                                    ...gpuAcceleratedStyle,
                                    width: `${leftPanelWidth}%`,
                                    flexShrink: 0
                                }}
                            >
                                <LeftPanel
                                    width={100}
                                    t={t}
                                    onPdfDrop={handlePdfDrop}
                                    pdfFile={pdfFile}
                                    onSelectPdf={handleSelectPdf}
                                    onTextSelection={handleTextSelection}
                                    onResumePdf={async () => {
                                        if (lastReadingInfo) {
                                            setInitialPage(lastReadingInfo.page)
                                            await resumeLastPdf()
                                        }
                                    }}
                                    lastReadingInfo={lastReadingInfo}
                                    initialPage={initialPage}
                                />
                            </motion.div>

                            {/* Resizer */}
                            <motion.div
                                ref={resizerRef as React.RefObject<HTMLDivElement>}
                                className="resizer"
                                onMouseDown={handleMouseDown}
                                variants={resizerVariants}
                                style={gpuAcceleratedStyle}
                            />

                            {/* Right Panel (AI Webview) */}
                            <motion.div
                                variants={isLayoutSwapped ? leftPanelVariants : rightPanelVariants}
                                className="glass-panel flex-1 min-w-[350px] flex flex-col overflow-hidden relative"
                                style={gpuAcceleratedStyle}
                            >
                                {isWebviewMounted ? (
                                    <AiWebview
                                        isResizing={isResizing}
                                        isBarHovered={isBarHovered}
                                    />
                                ) : (
                                    <AestheticLoader />
                                )}
                            </motion.div>
                        </motion.main>
                    ) : (
                        /* Quiz Mode - Full Screen */
                        <motion.div
                            key="quiz-panel"
                            className="h-screen w-screen p-5"
                            variants={quizPanelVariants}
                            initial={false}
                            animate="animate"
                            exit="exit"
                            style={gpuAcceleratedStyle}
                        >
                            <QuizModule
                                onClose={() => setIsQuizMode(false)}
                                initialPdfPath={pdfFile?.path ?? undefined}
                                initialPdfName={pdfFile?.name}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <BottomBar
                    onHoverChange={setIsBarHovered}
                    isQuizMode={isQuizMode}
                    onToggleQuizMode={() => setIsQuizMode(prev => !prev)}
                />

                {selectedText && selectionPosition && (
                    <FloatingButton
                        onClick={handleSendToAI}
                        position={{ top: selectionPosition.top, left: selectionPosition.left }}
                    />
                )}

                <ScreenshotTool
                    isActive={isScreenshotMode}
                    onCapture={handleCapture}
                    onClose={closeScreenshot}
                />

                {/* Usage Assistant (Global Overlay) */}
                <UsageAssistant
                    isActive={isTourActive}
                    onClose={() => setIsTourActive(false)}
                />
            </div>
        </LayoutGroup>
    )
}

export default App

