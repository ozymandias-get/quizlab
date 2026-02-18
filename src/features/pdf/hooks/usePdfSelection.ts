import { useState, useCallback, useRef } from 'react'
import { Logger } from '@src/utils/logger'
import { useToast, useLanguage } from '@src/app/providers'
import type { PdfFile } from '@shared/types'
import { STORAGE_KEYS } from '@src/constants/storageKeys'
import { useSelectPdf, useRegisterPdfPath } from '@platform/electron/api/usePdfApi'

export const usePdfSelection = () => {
    const { showError, showSuccess } = useToast()
    const { t } = useLanguage()

    const [pdfFile, setPdfFile] = useState<PdfFile | null>(null)

    // React Query mutations
    const { mutateAsync: selectPdf } = useSelectPdf()
    const { mutateAsync: registerPdfPath } = useRegisterPdfPath()

    // Race condition protection for file loading
    const lastLoadRequestId = useRef<number>(0)

    /**
     * PDF selection from local file system
     */
    const handleSelectPdf = useCallback(async () => {
        const currentRequestId = ++lastLoadRequestId.current

        try {
            const result = await selectPdf({ filterName: t('pdf_documents') })

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
            // Error handling is mostly done by hook, but race condition check is local
            if (currentRequestId === lastLoadRequestId.current) {
                Logger.error('[usePdfSelection] PDF Selection Error:', error)
                // If the error message is generic "Failed to...", hook might have already shown toast.
                // But keeping existing logic safe.
            }
        }
    }, [selectPdf, t])

    /**
     * Handle PDF file drop
     */
    const handlePdfDrop = useCallback(async (file: File) => {
        // Check if it's a PDF
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showError('error_invalid_pdf')
            return
        }

        const filePath = (file as any).path
        if (!filePath) return

        try {
            const result = await registerPdfPath(filePath)
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
    }, [registerPdfPath, showSuccess, showError])

    /**
     * Resume last PDF reading session
     * Reads saved info from localStorage and re-opens the PDF at the saved page
     */
    const resumeLastPdf = useCallback(async () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING)
            if (!stored) return

            const data = JSON.parse(stored)
            if (!data.path) return

            const result = await registerPdfPath(data.path)
            if (result) {
                setPdfFile(result)
                // Update stored info with fresh streamUrl if needed (though result has it)
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify({
                    ...data,
                    page: data.page || 1
                }))
            }
        } catch (error) {
            Logger.error('[usePdfSelection] Resume Error:', error)
            // PDF artýk mevcut deðilse kayýtlý bilgiyi sil
            localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
            showError('error_pdf_load')
        }
    }, [registerPdfPath, showError])

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

