import { useState, useCallback, useRef } from 'react'
import { useToast, useLanguage } from '@src/app/providers'
import type { PdfFile } from '@shared/types'

export const usePdfSelection = () => {
    const { showError, showSuccess } = useToast()
    const { t } = useLanguage()

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
            }
        } catch (error) {
            if (currentRequestId === lastLoadRequestId.current) {
                const message = error instanceof Error ? error.message : t('error_unknown_error')
                console.error('[usePdfSelection] PDF Selection Error:', error)
                showError('toast_pdf_load_error', undefined, { error: message })
            }
        }
    }, [showError, t])

    /**
     * Handle PDF file drop
     */
    const handlePdfDrop = useCallback(async (file: File) => {
        const api = window.electronAPI
        if (!api?.registerPdfPath) return

        // Check if it's a PDF
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showError('error_invalid_pdf')
            return
        }

        const filePath = (file as any).path
        if (!filePath) return

        try {
            const result = await api.registerPdfPath(filePath)
            if (result) {
                setPdfFile(result)
                showSuccess('toast_opened', undefined, { fileName: result.name })
            }
        } catch (error) {
            console.error('[usePdfSelection] Drop Error:', error)
            showError('error_pdf_load')
        }
    }, [showError, showSuccess])

    return {
        pdfFile,
        setPdfFile,
        handleSelectPdf,
        handlePdfDrop
    }
}

