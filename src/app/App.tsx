import React, { useCallback, useState } from 'react'
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion'
import { AiWebview } from '@features/ai'
import BottomBar from '@ui/layout/BottomBar'
import FloatingButton from '@ui/components/FloatingButton'
import { ScreenshotTool } from '@features/screenshot'
import UpdateBanner from '@ui/components/UpdateBanner'
import AestheticLoader from '@ui/components/AestheticLoader'
import LeftPanel from '@ui/layout/LeftPanel'
import AppBackground from '@ui/layout/AppBackground'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import { UsageAssistant } from '@features/tutorial'
import { QuizModule } from '@features/quiz'
import { usePdfSelection } from '@features/pdf/hooks/usePdfSelection'

// Context & Constants
import { useAppTools, useUpdate, useAppearance, useLanguage } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

// Hooks
import {
    usePanelResize,
    useOnlineStatus,
    useWebviewMount,
    useTextSelection
} from '@shared/hooks'
import { useAppAnimations } from '@app/hooks/useAppAnimations'

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
    const {
        pdfFile,
        pdfTabs,
        activePdfTabId,
        setActivePdfTab,
        closePdfTab,
        renamePdfTab,
        handleSelectPdf,
        handlePdfDrop,
        resumeLastPdf,
        getRecentReadingInfo,
        clearLastReading,
        restoreRecentReading
    } = usePdfSelection()

    // Last reading info list for resume section
    const lastReadingInfo = getRecentReadingInfo()
    const [initialPage, setInitialPage] = useState<number | undefined>(undefined)

    const handleSelectPdfWithReset = useCallback(async () => {
        setInitialPage(undefined)
        await handleSelectPdf()
    }, [handleSelectPdf])

    const handlePdfDropWithReset = useCallback(async (file: File) => {
        setInitialPage(undefined)
        await handlePdfDrop(file)
    }, [handlePdfDrop])

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
                        void handlePdfDropWithReset(e.dataTransfer.files[0])
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
                                    onPdfDrop={handlePdfDropWithReset}
                                    pdfFile={pdfFile}
                                    onSelectPdf={handleSelectPdfWithReset}
                                    onTextSelection={handleTextSelection}
                                    onResumePdf={async (path?: string) => {
                                        const target = path
                                            ? lastReadingInfo.find((item) => item.path === path)
                                            : lastReadingInfo[0]
                                        if (target) {
                                            setInitialPage(target.page)
                                            return await resumeLastPdf(target.path)
                                        }
                                        return await resumeLastPdf(path)
                                    }}
                                    onClearResumePdf={(path?: string) => clearLastReading(path)}
                                    onRestoreResumePdf={(info, index) => restoreRecentReading(info, index)}
                                    lastReadingInfo={lastReadingInfo}
                                    initialPage={initialPage}
                                    pdfTabs={pdfTabs}
                                    activePdfTabId={activePdfTabId}
                                    onSetActivePdfTab={setActivePdfTab}
                                    onClosePdfTab={closePdfTab}
                                    onRenamePdfTab={renamePdfTab}
                                />
                            </motion.div>

                            {/* Hub Resizer - BottomBar integrated in the center */}
                            <motion.div
                                ref={resizerRef as React.RefObject<HTMLDivElement>}
                                variants={resizerVariants}
                                className="h-full flex-shrink-0 relative z-30"
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





