import { useState, useCallback } from 'react'
import { validateFileName } from '@src/utils/fileUtils'
import type { FileSystemItem } from '@src/app/providers/FileContext'
import type { PdfSelection } from '@shared/types'

interface UseFileExplorerActionsProps {
    addFolder: (name: string, parentId: string | null | undefined) => Promise<FileSystemItem | null>;
    importFile: (path: string) => Promise<boolean>;
    deleteItem: (id: string) => Promise<boolean>;
    clearAll: () => void;
    getItemById: (id: string) => FileSystemItem | undefined;
    showError: (key: string, title?: string, params?: Record<string, string>) => void;
    showSuccess: (key: string, title?: string, params?: Record<string, string>) => void;
    t: (key: string, params?: Record<string, string>) => string;
}

interface DeleteModalState {
    isOpen: boolean;
    type: 'single' | 'all';
    itemId: string | null;
    itemName: string;
}

/**
 * Hook to manage FileExplorer actions (Folder, PDF, Delete operations)
 */
export function useFileExplorerActions({
    addFolder,
    importFile,
    deleteItem,
    clearAll,
    getItemById,
    showError,
    showSuccess,
    t
}: UseFileExplorerActionsProps) {
    // undefined = not adding, null = adding to root, string = adding to folderId
    const [addingToFolderId, setAddingToFolderId] = useState<string | null | undefined>(undefined)
    const [newFolderName, setNewFolderName] = useState('')
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        type: 'single',
        itemId: null,
        itemName: ''
    })

    // ===== Folder Actions =====

    const handleAddFolder = useCallback(async () => {
        const validation = validateFileName(newFolderName)

        if (!validation.valid || !validation.name) {
            showError(validation.error || 'error_unknown_error') // 'empty_name' or 'invalid_chars'
            return
        }

        const parentId = addingToFolderId // might be null or string
        const result = await addFolder(validation.name, parentId)

        if (result) {
            setNewFolderName('')
            setAddingToFolderId(undefined)
            showSuccess('toast_folder_created', undefined, { folderName: validation.name })
        }
    }, [newFolderName, addFolder, addingToFolderId, showError, showSuccess])

    const handleCancelFolder = useCallback(() => {
        setAddingToFolderId(undefined)
        setNewFolderName('')
    }, [])

    const initiateAddFolder = useCallback((parentId: string | null = null) => {
        setAddingToFolderId(parentId)
    }, [])

    // ===== PDF Actions =====

    const handleAddPdf = useCallback(async () => {
        const api = window.electronAPI
        if (!api?.selectPdf) {
            showError('toast_api_unavailable')
            return
        }

        try {
            const result: PdfSelection | null = await api.selectPdf({ filterName: t('pdf_documents') })

            // Eğer dosya seçildiyse DİREKT olarak kütüphaneye import et (Kalıcı Ekleme)
            if (result && result.path) {
                const success = await importFile(result.path)
                if (success) {
                    showSuccess('toast_file_imported', undefined, { name: result.name || 'document' })
                } else {
                    showError('toast_import_error')
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown'
            console.error('[FileExplorer] PDF Selection Error:', error)
            showError('toast_pdf_load_error', undefined, { error: message })
        }
    }, [importFile, showSuccess, showError, t])

    // ===== Delete Actions =====

    const handleDeleteItem = useCallback((itemId: string) => {
        const item = getItemById(itemId)
        if (item) {
            setDeleteModal({ isOpen: true, type: 'single', itemId, itemName: item.name })
        }
    }, [getItemById])

    const handleClearAllClick = useCallback(() => {
        setDeleteModal({ isOpen: true, type: 'all', itemId: null, itemName: t('all_files') })
    }, [t])

    const confirmDelete = useCallback(() => {
        if (deleteModal.type === 'all') {
            clearAll()
        } else if (deleteModal.itemId) {
            deleteItem(deleteModal.itemId)
        }
        setDeleteModal({ isOpen: false, type: 'single', itemId: null, itemName: '' })
    }, [deleteItem, clearAll, deleteModal])

    const cancelDelete = useCallback(() => {
        setDeleteModal({ isOpen: false, type: 'single', itemId: null, itemName: '' })
    }, [])

    const handleImportItem = useCallback(async (id: string) => {
        const item = getItemById(id);
        if (!item || !item.path) return;

        try {
            const success = await importFile(item.path);
            if (success) {
                showSuccess('toast_file_imported', undefined, { name: item.name });
            } else {
                showError('toast_import_error');
            }
        } catch (e) {
            showError('toast_import_error');
        }
    }, [getItemById, importFile, showSuccess, showError]);

    return {
        // State
        addingToFolderId,
        newFolderName,
        setNewFolderName,
        deleteModal,

        // Actions
        handleAddFolder,
        handleCancelFolder,
        initiateAddFolder,
        handleAddPdf,
        handleDeleteItem,
        handleImportItem, // Exported
        handleClearAllClick,
        confirmDelete,
        cancelDelete
    }
}

