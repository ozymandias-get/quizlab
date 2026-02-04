import { useState, useCallback } from 'react'
import { useFileSystem } from '../../../context/FileContext'
import type { FileSystemItem, FileInput } from '../../../context/FileContext'

interface DragData {
    id: string;
    type: string;
    name: string;
    parentId: string | null;
}

interface DragHandlers {
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

interface UseFileDragDropReturn {
    isDragging: boolean;
    isDragOver: boolean;
    dragHandlers: DragHandlers;
    resetDragState?: () => void;
}

/**
 * TreeItem için sürükle-bırak mantığını yöneten custom hook
 * Hem dahili öğe taşımayı hem de harici dosya bırakmayı destekler
 */
export function useFileDragDrop(item: FileSystemItem, onDragComplete?: () => void): UseFileDragDropReturn {
    const [isDragging, setIsDragging] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    const { moveItem, addFiles } = useFileSystem()

    const isFolder = item.type === 'folder'
    // Eylem hedefi: Klasörse kendisi, dosyaysa parent'ı
    const targetId = isFolder ? item.id : item.parentId

    const handleDragStart = useCallback((e: React.DragEvent) => {
        setIsDragging(true)
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: item.id,
            type: item.type,
            name: item.name,
            parentId: item.parentId
        }))
        e.dataTransfer.effectAllowed = 'move'
    }, [item])

    const handleDragEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Harici dosyalar için 'copy', dahili için 'move'
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy'
        } else {
            e.dataTransfer.dropEffect = 'move'
        }

        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        if (onDragComplete) onDragComplete()

        // 1. Harici dosya (OS'den sürüklenen) kontrolü
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files)
            const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'))

            if (pdfFiles.length > 0) {
                const filesToAdd: FileInput[] = pdfFiles.map((f) => {
                    const fileWithPath = f as File & { path?: string }
                    return {
                    name: f.name,
                    path: fileWithPath.path || null,
                    size: f.size,
                    streamUrl: null
                }
                })
                addFiles(filesToAdd, targetId)
            }
            return
        }

        // 2. Dahili öğe taşıma
        try {
            const jsonData = e.dataTransfer.getData('application/json')
            if (!jsonData) return

            const data = JSON.parse(jsonData) as DragData
            if (!data?.id || data.id === item.id || data.parentId === targetId) return

            moveItem(data.id, targetId ?? null)
        } catch (error) {
            console.error('Drop error:', error)
        }
    }, [item.id, targetId, addFiles, moveItem, onDragComplete])

    return {
        isDragging,
        isDragOver,
        dragHandlers: {
            onDragStart: handleDragStart,
            onDragEnd: handleDragEnd,
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop
        },
        resetDragState: () => setIsDragOver(false) // Added helper just in case
    }
}
