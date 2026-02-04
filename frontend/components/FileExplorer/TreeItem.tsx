import React, { useState, useCallback, useMemo, memo } from 'react'
import { useFileSystem } from '../../context/FileContext'
import type { FileSystemItem } from '../../context/FileContext'
import { useLanguage } from '../../context/LanguageContext'
import { FolderIcon, PdfIcon, ChevronIcon, TrashIcon, SparklesIcon } from './icons/FileExplorerIcons'
import { formatFileSize, sortFileSystemItems } from '../../utils/fileUtils'
import { useFileDragDrop } from './hooks/useFileDragDrop'
import NewFolderInput from './NewFolderInput'

interface TreeItemProps {
    item: FileSystemItem;
    level: number;
    onFileClick?: (item: FileSystemItem) => void;
    onDeleteItem?: (id: string) => void;
    onDragComplete?: () => void;
    onAddFolder: (parentId: string | null) => void;
    addingToFolderId: string | null | undefined;
    newFolderName: string;
    setNewFolderName: (name: string) => void;
    onSubmitFolder: (e?: React.FormEvent) => void;
    onCancelFolder: () => void;
}

/**
 * TreeItem - Renders an individual item in the file tree
 */
const TreeItem: React.FC<TreeItemProps> = ({
    item,
    level = 0,
    onFileClick,
    onDeleteItem,
    onDragComplete,
    onAddFolder,
    addingToFolderId,
    newFolderName,
    setNewFolderName,
    onSubmitFolder,
    onCancelFolder
}) => {
    const isFolder = item.type === 'folder'
    const [isOpen, setIsOpen] = useState(false)

    const { getChildren } = useFileSystem()
    const { t } = useLanguage()
    const { isDragging, isDragOver, dragHandlers, resetDragState } = useFileDragDrop(item, () => {
        if (onDragComplete) onDragComplete()
        if (isFolder) setIsOpen(true)
    })

    const children = useMemo(() => isFolder ? getChildren(item.id) : [], [isFolder, getChildren, item.id])

    const handleToggle = useCallback(() => {
        if (isFolder) setIsOpen(prev => !prev)
    }, [isFolder])

    const handleClick = useCallback(() => {
        if (!isFolder && onFileClick) {
            onFileClick(item)
        } else {
            handleToggle()
        }
    }, [isFolder, onFileClick, item, handleToggle])

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (onDeleteItem) onDeleteItem(item.id)
    }, [item.id, onDeleteItem])

    const sortedChildren = useMemo(() => {
        if (!isFolder || !isOpen) return []
        return sortFileSystemItems(children)
    }, [isFolder, isOpen, children])

    const isAddingHere = addingToFolderId === item.id

    const containerClasses = [
        'group relative flex items-center gap-2.5 px-3 py-2 mx-1 my-0.5 rounded-xl cursor-pointer',
        'transition-all duration-300 ease-out z-10 select-none',
        isDragging ? 'opacity-40 scale-95 rotate-1' : '',
        isDragOver
            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 ring-2 ring-amber-400/40 ring-inset shadow-lg shadow-amber-500/10'
            : 'hover:bg-white/5'
    ].filter(Boolean).join(' ')

    return (
        <div className="tree-item-wrapper">
            <div
                draggable={true}
                {...dragHandlers}
                className={containerClasses}
                style={{ marginLeft: `${level * 12}px` }}
                onClick={handleClick}
            >
                {/* Level indicator */}
                {level > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-stone-700/50 to-transparent" />
                )}

                {/* Folder Toggle */}
                {isFolder ? (
                    <button
                        className="p-1 -ml-1 hover:bg-white/10 rounded-lg transition-all duration-200"
                        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                    >
                        <ChevronIcon isOpen={isOpen} />
                    </button>
                ) : (
                    <span className="w-5" />
                )}

                <div className="flex-shrink-0">
                    {isFolder ? <FolderIcon isOpen={isOpen || isDragOver} /> : <PdfIcon />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <span className={`
                        block text-sm font-medium truncate transition-colors duration-200
                        ${isFolder
                            ? isDragOver ? 'text-amber-200' : 'text-stone-200'
                            : 'text-stone-300 group-hover:text-rose-200'
                        }
                    `}>
                        {item.name}
                    </span>
                    {!isFolder && item.size && (
                        <span className="text-[10px] text-stone-500 font-medium font-mono">
                            {formatFileSize(item.size)}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {isFolder && isDragOver && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-500/20 px-2 py-0.5 rounded-full">
                            <SparklesIcon />
                            {t('drop_here')}
                        </span>
                    )}
                    {!isDragOver && (
                        <>
                            {isFolder && (
                                <button
                                    className="p-1.5 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-amber-500/20 
                                               transition-all duration-200 hover:scale-110"
                                    onClick={(e) => { e.stopPropagation(); onAddFolder(item.id); setIsOpen(true); }}
                                    title={t('new_folder')}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </button>
                            )}
                            <button
                                className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-500/20 
                                           transition-all duration-200 hover:scale-110"
                                onClick={handleDelete}
                                title={t('delete')}
                            >
                                <TrashIcon />
                            </button>
                        </>
                    )}
                </div>

                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                    ${isFolder ? 'bg-gradient-to-r from-amber-500/5 to-transparent' : 'bg-gradient-to-r from-rose-500/5 to-transparent'}
                `} />
            </div>

            {isAddingHere && (
                <div className="animate-in slide-in-from-left-2 duration-200" style={{ marginLeft: `${(level + 1) * 12}px` }}>
                    <NewFolderInput
                        value={newFolderName}
                        onChange={setNewFolderName}
                        onSubmit={onSubmitFolder}
                        onCancel={onCancelFolder}
                        autoFocus
                    />
                </div>
            )}

            {isFolder && isOpen && (
                <div className="children-container transition-all duration-300 ease-in-out">
                    {sortedChildren.length > 0 ? (
                        sortedChildren.map((child) => (
                            <TreeItem
                                key={child.id}
                                item={child}
                                level={level + 1}
                                onFileClick={onFileClick}
                                onDeleteItem={onDeleteItem}
                                onDragComplete={resetDragState || onDragComplete}
                                onAddFolder={onAddFolder}
                                addingToFolderId={addingToFolderId}
                                newFolderName={newFolderName}
                                setNewFolderName={setNewFolderName}
                                onSubmitFolder={onSubmitFolder}
                                onCancelFolder={onCancelFolder}
                            />
                        ))
                    ) : (
                        !isAddingHere && (
                            <div
                                className="flex items-center gap-2 text-xs text-stone-600 italic py-3 px-4"
                                style={{ marginLeft: `${(level + 1) * 12 + 16}px` }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-stone-700" />
                                {t('empty_folder')}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    )
}

export default memo(TreeItem)
