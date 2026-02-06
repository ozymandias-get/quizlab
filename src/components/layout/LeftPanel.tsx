import React, { memo, Suspense, lazy } from 'react'
import { APP_CONSTANTS } from '@src/constants/appConstants'
import { useLanguage } from '@src/app/providers/LanguageContext'
import type { PdfFile } from '@shared/types'

const { LEFT_PANEL_TABS } = APP_CONSTANTS

import { Worker } from '@react-pdf-viewer/core'

import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import ErrorBoundary from '@src/components/ui/ErrorBoundary'

// Lazy Load Components
const FileExplorer = lazy(() => import('@src/features/library/components'))
const PdfViewer = lazy(() => import('@src/features/pdf/components/PdfViewer'))

interface LeftPanelProps {
    activeTab: string;
    onFileSelect: (file: PdfFile) => void;
    pdfFile: PdfFile | null;
    onSelectPdf: () => void;
    onTextSelection?: (text: string, position: { top: number; left: number } | null) => void;
    width: number;
    onTabChange?: (tab: string) => void;
    t: (key: string) => string;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
    activeTab,
    onFileSelect,
    pdfFile,
    onSelectPdf,
    onTextSelection
}) => {
    const { t } = useLanguage()

    return (
        <div
            className="glass-panel h-full w-full flex flex-col overflow-hidden"
            style={{
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
            }}
        >
            <ErrorBoundary title={t('error_pdf_handler')}>
                <Worker workerUrl={pdfjsWorkerUrl}>
                    {/* Tab Contents - Now Full Screen without Header */}
                    <div className="flex-1 overflow-hidden relative">
                        <Suspense fallback={
                            <div className="flex items-center justify-center h-full">
                                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-amber-500 animate-spin" />
                            </div>
                        }>
                            {/* FileExplorer */}
                            {activeTab === LEFT_PANEL_TABS.EXPLORER && (
                                <div className="absolute inset-0 w-full h-full animate-in fade-in duration-300">
                                    <ErrorBoundary title={t('error_file_explorer')}>
                                        <FileExplorer
                                            onFileSelect={onFileSelect}
                                            className="h-full"
                                        />
                                    </ErrorBoundary>
                                </div>
                            )}

                            {/* PdfViewer */}
                            {activeTab === LEFT_PANEL_TABS.VIEWER && (
                                <div className="absolute inset-0 w-full h-full animate-in fade-in duration-300">
                                    <ErrorBoundary title={t('error_pdf_viewer')}>
                                        <PdfViewer
                                            pdfFile={pdfFile}
                                            onSelectPdf={onSelectPdf}
                                            onTextSelection={onTextSelection}
                                            t={t}
                                        />
                                    </ErrorBoundary>
                                </div>
                            )}
                        </Suspense>
                    </div>
                </Worker>
            </ErrorBoundary>
        </div>
    )
}

export default memo(LeftPanel)

