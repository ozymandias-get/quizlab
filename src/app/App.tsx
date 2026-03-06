import React, { useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { AiWebview } from '@features/ai'
import { QuizModule } from '@features/quiz'
import { ScreenshotTool } from '@features/screenshot'
import { UsageAssistant } from '@features/tutorial'
import { usePdfSelection } from '@features/pdf/hooks/usePdfSelection'
import BottomBar from '@ui/layout/BottomBar'
import FloatingButton from '@ui/components/FloatingButton'
import UpdateBanner from '@ui/components/UpdateBanner'
import AestheticLoader from '@ui/components/AestheticLoader'
import LeftPanel from '@ui/layout/LeftPanel'
import AppBackground from '@ui/layout/AppBackground'
import ToastContainer from '@ui/components/Toast/ToastContainer'
import { GeminiIcon, LoaderIcon } from '@ui/components/Icons'

import { useAppTools, useUpdate, useAppearance, useLanguage } from '@app/providers'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import {
    usePanelResize,
    useOnlineStatus,
    useWebviewMount,
    useTextSelection
} from '@shared/hooks'
import { useAppAnimations } from '@app/hooks/useAppAnimations'

const App: React.FC = () => {
    const { t } = useLanguage()
    useOnlineStatus()

    const {
        isScreenshotMode,
        handleCapture,
        closeScreenshot,
        isGeminiWebLoginInProgress
    } = useAppTools()
    const { updateAvailable, updateInfo } = useUpdate()
    const { isLayoutSwapped, isTourActive, setIsTourActive, bottomBarScale } = useAppearance()

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

    const {
        pdfFile,
        pdfTabs,
        activePdfTab,
        activePdfTabId,
        setActivePdfTab,
        closePdfTab,
        renamePdfTab,
        handleSelectPdf,
        handlePdfDrop,
        resumeLastPdf,
        getRecentReadingInfo,
        clearLastReading,
        restoreRecentReading,
        addEmptyPdfTab,
        openGoogleDriveTab,
        activeTabInitialPage
    } = usePdfSelection()

    const lastReadingInfo = getRecentReadingInfo()

    const [isBarHovered, setIsBarHovered] = useState<boolean>(false)
    const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState<boolean>(true)
    const [isQuizMode, setIsQuizMode] = useState<boolean>(false)

    const isWebviewMounted = useWebviewMount()
    const {
        handleTextSelection,
        handleSendToAI,
        selectedText,
        selectionPosition
    } = useTextSelection()

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
                        void handlePdfDrop(e.dataTransfer.files[0])
                    }
                }}
            >
                <AppBackground />

                <ToastContainer />

                <UpdateBanner
                    updateAvailable={updateAvailable}
                    updateInfo={updateInfo}
                    isVisible={isUpdateBannerVisible}
                    onClose={() => setIsUpdateBannerVisible(false)}
                    t={t}
                />

                <AnimatePresence mode="wait" initial={false}>
                    {!isQuizMode ? (
                        <motion.main
                            key="main-panels"
                            initial={false}
                            animate="visible"
                            exit="hidden"
                            variants={containerVariants}
                            className={`flex h-screen w-screen p-5 ${isLayoutSwapped ? 'flex-row-reverse' : 'flex-row'}`}
                            style={gpuAcceleratedStyle}
                        >
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
                                    onResumePdf={async (path?: string) => {
                                        const target = path
                                            ? lastReadingInfo.find((item) => item.path === path)
                                            : lastReadingInfo[0]
                                        if (target) {
                                            return await resumeLastPdf(target.path)
                                        }
                                        return await resumeLastPdf(path)
                                    }}
                                    onClearResumePdf={(path?: string) => clearLastReading(path)}
                                    onRestoreResumePdf={(info, index) => restoreRecentReading(info, index)}
                                    lastReadingInfo={lastReadingInfo}
                                    initialPage={activeTabInitialPage}
                                    activePdfTab={activePdfTab}
                                    pdfTabs={pdfTabs}
                                    activePdfTabId={activePdfTabId}
                                    onSetActivePdfTab={setActivePdfTab}
                                    onClosePdfTab={closePdfTab}
                                    onRenamePdfTab={renamePdfTab}
                                    onAddEmptyPdfTab={addEmptyPdfTab}
                                    onOpenGoogleDrive={openGoogleDriveTab}
                                    isInteractionBlocked={isBarHovered || isResizing}
                                />
                            </motion.div>

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

                <AnimatePresence>
                    {isGeminiWebLoginInProgress && (
                        <motion.div
                            key="gemini-web-session-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className="mx-6 w-full max-w-xl rounded-[2rem] border border-white/[0.12] bg-white/[0.08] px-8 py-10 text-center shadow-[0_24px_120px_rgba(15,23,42,0.6)]"
                            >
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                                    <div className="relative flex items-center justify-center">
                                        <GeminiIcon className="h-8 w-8" />
                                        <LoaderIcon className="absolute -right-4 -top-4 h-5 w-5 text-emerald-300" />
                                    </div>
                                </div>
                                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200/70">
                                    {t('gws_toolbar_title')}
                                </p>
                                <h2 className="mt-3 text-3xl font-semibold text-white">
                                    {t('gws_overlay_title')}
                                </h2>
                                <p className="mt-3 text-sm leading-7 text-white/70">
                                    {t('gws_overlay_description')}
                                </p>
                                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-white/55">
                                    <LoaderIcon className="h-3.5 w-3.5" />
                                    <span>{t('gws_toolbar_checking')}</span>
                                </div>
                            </motion.div>
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

                <UsageAssistant
                    isActive={isTourActive}
                    onClose={() => setIsTourActive(false)}
                />
            </div>
        </LayoutGroup>
    )
}

export default App
