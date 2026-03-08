import { useCallback, useMemo } from 'react'
import type { ComponentProps, DragEvent } from 'react'
import { useLanguage } from '@app/providers'
import { useTextSelection } from '@app/hooks/useTextSelection'
import { usePdfSelection } from '@features/pdf'
import LeftPanel from '@ui/layout/LeftPanel'

interface UsePdfWorkspaceStateParams {
    isInteractionBlocked: boolean
}

export function usePdfWorkspaceState({ isInteractionBlocked }: UsePdfWorkspaceStateParams) {
    const { t } = useLanguage()
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
        updateReadingProgress,
        resumeLastPdf,
        getRecentReadingInfo,
        clearLastReading,
        restoreRecentReading,
        addEmptyPdfTab,
        openGoogleDriveTab,
        activeTabInitialPage
    } = usePdfSelection()
    const {
        handleTextSelection
    } = useTextSelection()

    const lastReadingInfo = getRecentReadingInfo()

    const handleResumePdf = useCallback(async (path?: string) => {
        const target = path
            ? lastReadingInfo.find((item) => item.path === path)
            : lastReadingInfo[0]

        if (target) {
            return await resumeLastPdf(target.path)
        }

        return await resumeLastPdf(path)
    }, [lastReadingInfo, resumeLastPdf])

    const leftPanelProps = useMemo<ComponentProps<typeof LeftPanel>>(() => ({
        width: 100,
        t,
        onPdfDrop: handlePdfDrop,
        pdfFile,
        onSelectPdf: handleSelectPdf,
        onTextSelection: handleTextSelection,
        onResumePdf: handleResumePdf,
        onClearResumePdf: (path?: string) => clearLastReading(path),
        onRestoreResumePdf: restoreRecentReading,
        onReadingProgressChange: updateReadingProgress,
        lastReadingInfo,
        initialPage: activeTabInitialPage,
        activePdfTab,
        pdfTabs,
        activePdfTabId,
        onSetActivePdfTab: setActivePdfTab,
        onClosePdfTab: closePdfTab,
        onRenamePdfTab: renamePdfTab,
        onAddEmptyPdfTab: addEmptyPdfTab,
        onOpenGoogleDrive: openGoogleDriveTab,
        isInteractionBlocked
    }), [
        t,
        handlePdfDrop,
        pdfFile,
        handleSelectPdf,
        handleTextSelection,
        handleResumePdf,
        clearLastReading,
        restoreRecentReading,
        updateReadingProgress,
        lastReadingInfo,
        activeTabInitialPage,
        activePdfTab,
        pdfTabs,
        activePdfTabId,
        setActivePdfTab,
        closePdfTab,
        renamePdfTab,
        addEmptyPdfTab,
        openGoogleDriveTab,
        isInteractionBlocked
    ])

    const handleRootDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
    }, [])

    const handleRootDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            void handlePdfDrop(event.dataTransfer.files[0])
        }
    }, [handlePdfDrop])

    return {
        t,
        pdfFile,
        leftPanelProps,
        rootDragHandlers: {
            onDragOver: handleRootDragOver,
            onDrop: handleRootDrop
        }
    }
}
