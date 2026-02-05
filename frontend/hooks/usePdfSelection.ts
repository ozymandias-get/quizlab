import { useState, useCallback, useRef } from 'react'
import { useToast, useLanguage, useNavigation } from '../context'
import { APP_CONSTANTS } from '../constants/appConstants'
import type { PdfFile } from '../types/pdf'

const { LEFT_PANEL_TABS } = APP_CONSTANTS

export const usePdfSelection = () => {
    const { showError, showSuccess } = useToast()
    const { t } = useLanguage()
    const { setLeftPanelTab } = useNavigation()

    const [pdfFile, setPdfFile] = useState<PdfFile | null>(null)

    // Race condition protection for file loading
    const lastLoadRequestId = useRef<number>(0)

    /**
     * PDF selection from local file system
     */
    const handleSelectPdf = useCallback(async () => {
        const api = window.electronAPI
        if (!api?.selectPdf) {
            showError('toast_api_unavailable')
            return
        }

        const currentRequestId = ++lastLoadRequestId.current

        try {
            const result = await api.selectPdf({ filterName: t('pdf_documents') })
            // Only update if this is still the latest request
            if (currentRequestId === lastLoadRequestId.current && result) {
                setPdfFile(result)
                setLeftPanelTab(LEFT_PANEL_TABS.VIEWER)
            }
        } catch (error) {
            if (currentRequestId === lastLoadRequestId.current) {
                const message = error instanceof Error ? error.message : t('error_unknown_error')
                console.error('[usePdfSelection] PDF Selection Error:', error)
                showError('toast_pdf_load_error', undefined, { error: message })
            }
        }
    }, [showError, t, setLeftPanelTab])

    /**
     * File selection from the Explorer sidebar
     */
    const handleFileSelect = useCallback(async (file: PdfFile) => {
        if (file.type !== 'file') return

        const currentRequestId = ++lastLoadRequestId.current
        const api = window.electronAPI

        // 1. Refresh stream URL if possible (session safety)
        if (file.path && api?.getPdfStreamUrl) {
            try {
                const result = await api.getPdfStreamUrl(file.path)

                // Check race condition before updating
                if (currentRequestId !== lastLoadRequestId.current) return

                if (result?.streamUrl) {
                    setPdfFile({ ...file, streamUrl: result.streamUrl })
                    setLeftPanelTab(LEFT_PANEL_TABS.VIEWER)
                    showSuccess('toast_opened', undefined, { fileName: file.name || 'document.pdf' })
                    return
                }
            } catch (error) {
                console.error('[usePdfSelection] PDF Refresh Error:', error)
            }
        }

        // Check race condition again before fallback
        if (currentRequestId !== lastLoadRequestId.current) return

        // 2. Fallback: Use existing streamUrl
        if (file.streamUrl) {
            setPdfFile(file)
            setLeftPanelTab(LEFT_PANEL_TABS.VIEWER)
            showSuccess('toast_opened', undefined, { fileName: file.name || 'document.pdf' })
        } else {
            showError('error_pdf_load')
        }
    }, [showSuccess, showError, setLeftPanelTab])

    return {
        pdfFile,
        setPdfFile,
        handleSelectPdf,
        handleFileSelect
    }
}
