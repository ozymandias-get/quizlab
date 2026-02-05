import React, { useMemo, memo } from 'react'
import { useFileSystem } from '../../context/FileContext'
import type { PdfFile } from '../../types/pdf'
import { useToast } from '../../context/ToastContext'
import { useLanguage } from '../../context/LanguageContext'

// Sub-components
import TreeItem from './TreeItem'
import DeleteConfirmModal from './DeleteConfirmModal'
import NewFolderInput from './NewFolderInput'
import EmptyState from './EmptyState'
import DropOverlay from './DropOverlay'

// Hooks & Utils
import { useExternalDragDrop } from './hooks/useExternalDragDrop'
import { useFileExplorerActions } from './hooks/useFileExplorerActions'
import { sortFileSystemItems } from '../../utils/fileUtils'

interface FileExplorerProps {
    onFileSelect: (file: PdfFile) => void;
    className?: string;
}

/**
 * FileExplorer - Modern file explorer component
 * Features glassmorphism design, animations, and drag & drop support.
 */
const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, className = '' }) => {
    const {
        addFolder,
        importFile,
        addFiles,
        deleteItem,
        getItemById,
        getRootItems,
        clearAll
    } = useFileSystem()

    const { showError, showSuccess } = useToast()
    const { t } = useLanguage()

    // Extract actions and state to custom hook
    const {
        addingToFolderId,
        newFolderName,
        setNewFolderName,
        deleteModal,
        handleAddFolder,
        handleCancelFolder,
        initiateAddFolder,
        handleAddPdf,
        handleDeleteItem,
        handleClearAllClick,
        confirmDelete,
        cancelDelete
    } = useFileExplorerActions({
        addFolder,
        importFile,
        deleteItem,
        clearAll,
        getItemById,
        showError,
        showSuccess,
        t
    })

    // External drag-drop hook for the root level
    const { isExternalDragOver, containerRef, dragHandlers, resetDragState } = useExternalDragDrop(addFiles)

    // Memoized root items sorted (folders first)
    const rootItems = useMemo(() => {
        return sortFileSystemItems(getRootItems())
    }, [getRootItems])

    return (
        <div
            className={`flex flex-col h-full bg-transparent overflow-hidden relative ${className}`}
            ref={containerRef}
            {...dragHandlers}
        >
            <DropOverlay isVisible={isExternalDragOver} />

            {/* Subtle Mini Header - Only if not empty */}
            {rootItems.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-xs font-bold text-stone-200 uppercase tracking-widest">{t('explorer')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => initiateAddFolder(null)}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-stone-400 hover:text-amber-400 transition-colors"
                            title={t('new_folder')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </button>
                        <button
                            onClick={handleAddPdf}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-stone-400 hover:text-rose-400 transition-colors"
                            title={t('add_pdf')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                        <button
                            onClick={handleClearAllClick}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-stone-500 hover:text-red-400 transition-colors"
                            title={t('clear_all')}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {addingToFolderId === null && (
                <NewFolderInput
                    value={newFolderName}
                    onChange={setNewFolderName}
                    onSubmit={handleAddFolder}
                    onCancel={handleCancelFolder}
                />
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar relative">
                {rootItems.length > 0 ? (
                    rootItems.map((item) => (
                        <TreeItem
                            key={item.id}
                            item={item}
                            level={0}
                            onFileClick={onFileSelect}
                            onDeleteItem={handleDeleteItem}
                            onDragComplete={resetDragState}
                            onAddFolder={initiateAddFolder}
                            addingToFolderId={addingToFolderId}
                            newFolderName={newFolderName}
                            setNewFolderName={setNewFolderName}
                            onSubmitFolder={handleAddFolder}
                            onCancelFolder={handleCancelFolder}
                        />
                    ))
                ) : (
                    <EmptyState
                        onAddPdf={handleAddPdf}
                        onAddFolder={() => initiateAddFolder(null)}
                    />
                )}
            </div>

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                type={deleteModal.type}
                itemName={deleteModal.itemName}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />
        </div>
    )
}

export default memo(FileExplorer)
