import { useState, useCallback, useRef } from 'react'
import type { FileInput } from '../../../context/FileContext'

interface FileToAdd extends FileInput {
    size?: number;
}

interface UseExternalDragDropReturn {
    isExternalDragOver: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    dragHandlers: {
        onDragEnter: (e: React.DragEvent) => void;
        onDragOver: (e: React.DragEvent) => void;
        onDragLeave: (e: React.DragEvent) => void;
        onDrop: (e: React.DragEvent) => void;
    };
    resetDragState: () => void;
}

/**
 * Harici dosya sürükle-bırak işlemlerini yöneten custom hook
 * @param {Function} addFiles - Dosyaları eklemek için callback
 * @returns {Object} Drag-drop state ve event handler'ları
 */
export function useExternalDragDrop(addFiles: (files: FileToAdd[], parentId: string | null) => void): UseExternalDragDropReturn {
    const [isExternalDragOver, setIsExternalDragOver] = useState(false)
    const dragCounterRef = useRef(0)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleExternalDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Sadece dosya sürüklemesi ise sayacı arttır
        if (!e.dataTransfer.types.includes('Files')) return

        dragCounterRef.current++
        setIsExternalDragOver(true)
    }, [])

    const handleExternalDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy'
        }
    }, [])

    const handleExternalDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        dragCounterRef.current--

        // Sayaç 0 veya negatif olursa kaplamayı kaldır (Güvenlik önlemi)
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0
            setIsExternalDragOver(false)
        }
    }, [])

    const handleExternalDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        dragCounterRef.current = 0
        setIsExternalDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith('.pdf'))

        if (pdfFiles.length === 0) {
            return
        }

        // CRITICAL FIX: Register each PDF with backend to add to allowlist
        const filesToAdd: FileToAdd[] = []

        for (const file of pdfFiles) {
            const fileWithPath = file as File & { path?: string }
            const filePath = fileWithPath.path

            if (!filePath) {
                console.warn('[DragDrop] File has no path, skipping:', file.name)
                continue
            }

            try {
                // Register with backend to add to allowlist and get streamUrl
                const api = window.electronAPI
                if (api?.registerPdfPath) {
                    const result = await api.registerPdfPath(filePath)

                    if (result) {
                        filesToAdd.push({
                            name: result.name,
                            path: result.path,
                            size: result.size,
                            streamUrl: result.streamUrl
                        })
                    } else {
                        console.warn('[DragDrop] Failed to register:', filePath)
                    }
                } else {
                    console.error('[DragDrop] registerPdfPath API not available')
                }
            } catch (error) {
                console.error('[DragDrop] Error registering PDF:', error)
            }
        }

        if (filesToAdd.length > 0) {
            // Add successfully registered files
            addFiles(filesToAdd, null)
        }
    }, [addFiles])

    const resetDragState = useCallback(() => {
        dragCounterRef.current = 0
        setIsExternalDragOver(false)
    }, [])

    return {
        isExternalDragOver,
        containerRef,
        dragHandlers: {
            onDragEnter: handleExternalDragEnter,
            onDragOver: handleExternalDragOver,
            onDragLeave: handleExternalDragLeave,
            onDrop: handleExternalDrop
        },
        resetDragState
    }
}

export default useExternalDragDrop
