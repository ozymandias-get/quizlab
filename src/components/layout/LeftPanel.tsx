import React, { memo, Suspense, lazy } from 'react'
import { useLanguage } from '@src/app/providers/LanguageContext'
import type { PdfFile } from '@shared/types'
import { Worker } from '@react-pdf-viewer/core'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import ErrorBoundary from '@src/components/ui/ErrorBoundary'
import { useSharedDragDrop } from '@src/hooks/useSharedDragDrop'
import { ImportIcon, LoaderIcon } from '@src/components/ui/Icons'

const PdfViewer = lazy(() => import('@src/features/pdf/components/PdfViewer'))

interface LeftPanelProps {
    onPdfDrop: (file: File) => void;
    pdfFile: PdfFile | null;
    onSelectPdf: () => void;
    onTextSelection?: (text: string, position: { top: number; left: number } | null) => void;
    width: number;
    t: (key: string) => string;
    onResumePdf?: () => void;
    lastReadingInfo?: { name: string; page: number; totalPages: number; path: string } | null;
    initialPage?: number;
}

const DropOverlay = ({ isVisible, t }: { isVisible: boolean; t: (key: string) => string }) => {
    if (!isVisible) return null
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-stone-800 border-2 border-dashed border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ImportIcon className="w-8 h-8" />
                </div>
                <div className="text-center">
                    <h3 className="text-emerald-400 font-bold text-lg">{t('drop_pdf_title')}</h3>
                    <p className="text-stone-400 text-sm mt-1">{t('drop_pdf_desc')}</p>
                </div>
            </div>
        </div>
    )
}

const LeftPanel: React.FC<LeftPanelProps> = ({
    onPdfDrop,
    pdfFile,
    onSelectPdf,
    onTextSelection,
    onResumePdf,
    lastReadingInfo,
    initialPage
}) => {
    const { t } = useLanguage()

    const { isDragOver, containerRef, dragHandlers } = useSharedDragDrop((file) => {
        onPdfDrop(file as File)
    })

    return (
        <div
            ref={containerRef}
            {...dragHandlers}
            className="glass-panel h-full w-full flex flex-col overflow-hidden relative"
            style={{
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
            }}
        >
            <DropOverlay isVisible={isDragOver} t={t} />

            <ErrorBoundary title={t('error_pdf_handler')}>
                <Worker workerUrl={pdfjsWorkerUrl}>
                    <div className="flex-1 overflow-hidden relative h-full">
                        <Suspense fallback={
                            <div className="flex items-center justify-center h-full">
                                <LoaderIcon className="w-8 h-8 text-amber-500" />
                            </div>
                        }>
                            <div className="absolute inset-0 w-full h-full animate-in fade-in duration-300">
                                <ErrorBoundary title={t('error_pdf_viewer')}>
                                    <PdfViewer
                                        pdfFile={pdfFile}
                                        onSelectPdf={onSelectPdf}
                                        onTextSelection={onTextSelection}
                                        t={t}
                                        initialPage={initialPage}
                                        onResumePdf={onResumePdf}
                                        lastReadingInfo={lastReadingInfo}
                                    />
                                </ErrorBoundary>
                            </div>
                        </Suspense>
                    </div>
                </Worker>
            </ErrorBoundary>
        </div>
    )
}

export default memo(LeftPanel)

