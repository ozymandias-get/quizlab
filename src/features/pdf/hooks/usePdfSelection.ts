import { useState, useCallback, useRef } from 'react'
import { Logger } from '@src/utils/logger'
import { useToast, useLanguage } from '@src/app/providers'
import type { PdfFile } from '@shared/types'
import { STORAGE_KEYS } from '@src/constants/storageKeys'

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
                // Son okunan PDF bilgisini kaydet
                try {
                    localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify({
                        name: result.name,
                        path: result.path,
                        page: 1
                    }))
                } catch { /* ignore */ }
            }
        } catch (error) {
            if (currentRequestId === lastLoadRequestId.current) {
                const message = error instanceof Error ? error.message : t('error_unknown_error')
                Logger.error('[usePdfSelection] PDF Selection Error:', error)
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
                // Son okunan PDF bilgisini kaydet
                try {
                    localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify({
                        name: result.name,
                        path: result.path || filePath,
                        page: 1
                    }))
                } catch { /* ignore */ }
            }
        } catch (error) {
            Logger.error('[usePdfSelection] Drop Error:', error)
            showError('error_pdf_load')
        }
    }, [showError, showSuccess])

    /**
     * Resume last PDF reading session
     * Reads saved info from localStorage and re-opens the PDF at the saved page
     */
    const resumeLastPdf = useCallback(async () => {
        const api = window.electronAPI
        if (!api?.registerPdfPath) {
            showError('toast_api_unavailable')
            return
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (!stored) return

            const data = JSON.parse(stored)
            if (!data.path) return

            const result = await api.registerPdfPath(data.path)
            if (result) {
                setPdfFile(result)
                // Update stored info with fresh streamUrl
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify({
                    ...data,
                    page: data.page || 1
                }))
            }
        } catch (error) {
            Logger.error('[usePdfSelection] Resume Error:', error)
            // PDF artık mevcut değilse kayıtlı bilgiyi sil
            localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
            showError('error_pdf_load')
        }
    }, [showError])

    /**
     * Get last reading info from localStorage (for display purposes)
     */
    const getLastReadingInfo = useCallback((): { name: string; page: number; totalPages: number; path: string } | null => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (!stored) return null
            const data = JSON.parse(stored)
            if (!data.path || !data.name) return null
            return { name: data.name, page: data.page || 1, totalPages: data.totalPages || 0, path: data.path }
        } catch {
            return null
        }
    }, [])

    return {
        pdfFile,
        setPdfFile,
        handleSelectPdf,
        handlePdfDrop,
        resumeLastPdf,
        getLastReadingInfo
    }
}

