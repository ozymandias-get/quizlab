import React, { useState } from 'react'
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion'
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
import { useAppTools, useUpdate, useAppearance, useLanguage } from '@src/app/providers'
import { STORAGE_KEYS } from '@src/constants/storageKeys'

// Hooks
import {
    usePanelResize,
    useOnlineStatus,
    usePdfSelection,
    useWebviewMount,
    useTextSelection
} from '@src/hooks'
import { useAppAnimations } from '@src/app/hooks/useAppAnimations'

const App: React.FC = () => {
    const { t } = useLanguage()
    useOnlineStatus() // Activate global connection monitoring

    // Global state from specific contexts
    const { isScreenshotMode, handleCapture, closeScreenshot } = useAppTools()
    const { updateAvailable, updateInfo } = useUpdate()
    const { isLayoutSwapped, isTourActive, setIsTourActive, bottomBarScale } = useAppearance()

    // Panel resize logic
    const clampedBarScale = Math.min(1.3, Math.max(0.7, bottomBarScale))
    const resizerShellWidth = Math.round(48 * clampedBarScale)

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
        isReversed: isLayoutSwapped,
        resizerWidth: resizerShellWidth
    })

    // PDF Selection Hook
    const { pdfFile, handleSelectPdf, handlePdfDrop, resumeLastPdf, getLastReadingInfo } = usePdfSelection()

    // Last reading info for resume button
    const lastReadingInfo = getLastReadingInfo()
    const [initialPage, setInitialPage] = useState<number | undefined>(undefined)

    // Local State
    const [isBarHovered, setIsBarHovered] = useState<boolean>(false)
    const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState<boolean>(true)
    const [isQuizMode, setIsQuizMode] = useState<boolean>(false)

    // Custom Hooks
    const isWebviewMounted = useWebviewMount()
    const {
        handleTextSelection,
        handleSendToAI,
        selectedText,
        selectionPosition
    } = useTextSelection()

    // Animations
    const {
        leftPanelVariants,
        rightPanelVariants,
        resizerVariants,
        containerVariants,
        quizPanelVariants,
        gpuAcceleratedStyle
    } = useAppAnimations(isLayoutSwapped)

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
                                variants={leftPanelVariants}
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

                            {/* Hub Resizer — BottomBar integrated in the center */}
                            <motion.div
                                ref={resizerRef as React.RefObject<HTMLDivElement>}
                                variants={resizerVariants}
                                className="h-full flex-shrink-0"
                                style={gpuAcceleratedStyle}
                            >
                                <BottomBar
                                    onHoverChange={setIsBarHovered}
                                    isQuizMode={isQuizMode}
                                    onToggleQuizMode={() => setIsQuizMode(prev => !prev)}
                                    onMouseDown={handleMouseDown}
                                />
                            </motion.div>

                            {/* Right Panel (AI Webview) */}
                            <motion.div
                                variants={rightPanelVariants}
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
