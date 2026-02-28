import { useState, useCallback, useRef } from 'react'
import { Logger } from '@shared/lib/logger'
import { useToast, useLanguage } from '@app/providers'
import type { PdfFile } from '@shared-core/types'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useSelectPdf, useRegisterPdfPath } from '@platform/electron/api/usePdfApi'

type DroppedPdfFile = File & { path?: string }
type LastReadingInfo = { name: string; page: number; totalPages: number; path: string }

const parseLastReadingInfo = (stored: string | null): LastReadingInfo | null => {
    if (!stored) return null

    try {
        const data = JSON.parse(stored)
        if (!data.path || !data.name) return null

        return {
            name: data.name,
            page: data.page || 1,
            totalPages: data.totalPages || 0,
            path: data.path
        }
    } catch {
        return null
    }
}

const readLastReadingInfo = (): LastReadingInfo | null => {
    try {
        return parseLastReadingInfo(localStorage.getItem(STORAGE_KEYS.LAST_PDF_READING))
    } catch {
        return null
    }
}

export const usePdfSelection = () => {
    const { showError, showSuccess } = useToast()
    const { t } = useLanguage()

    const [pdfFile, setPdfFile] = useState<PdfFile | null>(null)
    const [lastReadingInfo, setLastReadingInfo] = useState<LastReadingInfo | null>(() => readLastReadingInfo())

    const { mutateAsync: selectPdf } = useSelectPdf()
    const { mutateAsync: registerPdfPath } = useRegisterPdfPath()

    const lastLoadRequestId = useRef<number>(0)

    const persistLastReadingInfo = useCallback((info: LastReadingInfo | null) => {
        try {
            if (info) {
                localStorage.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(info))
            } else {
                localStorage.removeItem(STORAGE_KEYS.LAST_PDF_READING)
            }
        } catch {
            // ignore localStorage errors
        }

        setLastReadingInfo(info)
    }, [])

    const handleSelectPdf = useCallback(async () => {
        const currentRequestId = ++lastLoadRequestId.current

        try {
            const result = await selectPdf({ filterName: t('pdf_documents') })

            if (currentRequestId === lastLoadRequestId.current && result) {
                setPdfFile(result)
                persistLastReadingInfo({
                    name: result.name,
                    path: result.path,
                    page: 1,
                    totalPages: 0
                })
            }
        } catch (error) {
            if (currentRequestId === lastLoadRequestId.current) {
                Logger.error('[usePdfSelection] PDF Selection Error:', error)
            }
        }
    }, [selectPdf, t, persistLastReadingInfo])

    const handlePdfDrop = useCallback(async (file: File) => {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showError('error_invalid_pdf')
            return
        }

        const filePath = (file as DroppedPdfFile).path
        if (!filePath) return

        try {
            const result = await registerPdfPath(filePath)
            if (result) {
                setPdfFile(result)
                showSuccess('toast_opened', undefined, { fileName: result.name })
                persistLastReadingInfo({
                    name: result.name,
                    path: result.path || filePath,
                    page: 1,
                    totalPages: 0
                })
            }
        } catch (error) {
            Logger.error('[usePdfSelection] Drop Error:', error)
            showError('error_pdf_load')
        }
    }, [registerPdfPath, showSuccess, showError, persistLastReadingInfo])

    const resumeLastPdf = useCallback(async () => {
        try {
            const storedInfo = readLastReadingInfo()
            if (!storedInfo) return

            const result = await registerPdfPath(storedInfo.path)
            if (result) {
                setPdfFile(result)
                persistLastReadingInfo({
                    ...storedInfo,
                    name: result.name || storedInfo.name,
                    path: result.path || storedInfo.path,
                    page: storedInfo.page || 1
                })
            }
        } catch (error) {
            Logger.error('[usePdfSelection] Resume Error:', error)
            persistLastReadingInfo(null)
            showError('error_pdf_load')
        }
    }, [registerPdfPath, showError, persistLastReadingInfo])

    const getLastReadingInfo = useCallback((): LastReadingInfo | null => {
        return readLastReadingInfo() || lastReadingInfo
    }, [lastReadingInfo])

    const clearLastReading = useCallback(() => {
        persistLastReadingInfo(null)
    }, [persistLastReadingInfo])

    return {
        pdfFile,
        handleSelectPdf,
        handlePdfDrop,
        resumeLastPdf,
        getLastReadingInfo,
        clearLastReading
    }
}


