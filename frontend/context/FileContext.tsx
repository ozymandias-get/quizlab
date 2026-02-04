import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLanguage } from './LanguageContext'
import { validateFileName } from '../utils/fileUtils'
import { generateId } from '../utils/uiUtils'

export interface FileSystemItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    parentId: string | null;
    path?: string | null;
    size?: number | null;
    streamUrl?: string | null;
    error?: boolean;
}

export type FileInput = {
    name: string;
    path?: string | null;
    size?: number | null;
    streamUrl?: string | null;
    type?: 'file' | 'folder';
} & Record<string, unknown>;

interface FileContextType {
    fileSystem: FileSystemItem[];
    addFolder: (name: string, parentId?: string | null) => FileSystemItem | null;
    addFile: (fileObj: FileInput, parentId?: string | null) => FileSystemItem;
    addFiles: (filesArray: FileInput[], parentId?: string | null) => FileSystemItem[];
    moveItem: (itemId: string, newParentId: string | null) => boolean;
    deleteItem: (itemId: string) => boolean;
    getChildren: (parentId?: string | null) => FileSystemItem[];
    getRootItems: () => FileSystemItem[];
    getItemById: (id: string) => FileSystemItem | undefined;
    getItemPath: (itemId: string) => FileSystemItem[];
    clearAll: () => void;
}

const REHYDRATION_BATCH_SIZE = 5
const FileContext = createContext<FileContextType | null>(null)

/**
 * FileProvider - Manages the virtual file system state
 */
export function FileProvider({ children }: { children: React.ReactNode }) {
    const [fileSystem, setFileSystem] = useLocalStorage<FileSystemItem[]>('quizlab-filesystem', [])
    const { t } = useLanguage()

    // PDF Stream URL Re-hydration
    // Since local-pdf:// IDs are session-based, they must be refreshed on app start
    const rehydrationAttempted = useRef(false)

    useEffect(() => {
        // If we already attempted rehydration, don't run again
        if (rehydrationAttempted.current) return

        // If fileSystem is empty, wait until it's populated (e.g. from localStorage)
        // Note: If the user has 0 files, this will simply wait until they add one,
        // which triggers a harmless check. The main goal is to catch the case where 
        // localStorage loads JUST after the initial render.
        if (fileSystem.length === 0) return

        let isMounted = true
        rehydrationAttempted.current = true

        const rehydrateFiles = async () => {
            const api = window.electronAPI
            if (!api) return

            const fileIds = new Set(fileSystem.map(i => i.id))
            const filesToRehydrate = fileSystem.filter(i => i.type === 'file' && i.path)

            if (!filesToRehydrate.length) return

            const updates = new Map<string, Partial<FileSystemItem>>()

            // Process in batches to avoid overwhelming the IPC channel
            for (let i = 0; i < filesToRehydrate.length; i += REHYDRATION_BATCH_SIZE) {
                if (!isMounted) return

                const batch = filesToRehydrate.slice(i, i + REHYDRATION_BATCH_SIZE)
                await Promise.all(batch.map(async (file) => {
                    try {
                        const result = await api.getPdfStreamUrl(file.path!)
                        updates.set(file.id, {
                            streamUrl: result?.streamUrl || null,
                            error: !result?.streamUrl
                        })
                    } catch (err) {
                        updates.set(file.id, { error: true })
                    }
                }))
            }

            if (isMounted && updates.size > 0) {
                setFileSystem(current =>
                    current.map(item =>
                        fileIds.has(item.id) && updates.has(item.id)
                            ? { ...item, ...updates.get(item.id) }
                            : item
                    )
                )
            }
        }

        rehydrateFiles()
        return () => { isMounted = false }
    }, [fileSystem, setFileSystem])

    // ===== Helpers =====

    const findItem = useCallback((id: string) => fileSystem.find(i => i.id === id), [fileSystem])

    const isDescendant = useCallback((parentId: string | null, targetId: string, items: FileSystemItem[]) => {
        if (!parentId || parentId === targetId) return true
        let currentParentId: string | null | undefined = parentId

        while (currentParentId) {
            if (currentParentId === targetId) return true
            const parent: FileSystemItem | undefined = items.find(i => i.id === currentParentId)
            currentParentId = parent?.parentId
        }
        return false
    }, [])

    const internalCreateFile = useCallback((f: FileInput, parentId: string | null): FileSystemItem => {
        const validation = validateFileName(f.name)
        return {
            id: generateId(),
            name: validation.valid && validation.name ? validation.name : t('untitled_file'),
            type: 'file',
            parentId,
            path: typeof f.path === 'string' ? f.path : null,
            size: typeof f.size === 'number' ? f.size : null,
            streamUrl: typeof f.streamUrl === 'string' ? f.streamUrl : null
        }
    }, [t])

    // ===== Mutations =====

    const addFolder = useCallback((name: string, parentId: string | null = null) => {
        const validation = validateFileName(name)
        if (!validation.valid) return null

        const newFolder: FileSystemItem = { id: generateId(), name: validation.name!, type: 'folder', parentId }
        setFileSystem(prev => [...prev, newFolder])
        return newFolder
    }, [setFileSystem])

    const addFile = useCallback((fileObj: FileInput, parentId: string | null = null) => {
        const newFile = internalCreateFile(fileObj, parentId)
        setFileSystem(prev => [...prev, newFile])
        return newFile
    }, [setFileSystem, internalCreateFile])

    const addFiles = useCallback((filesArray: FileInput[], parentId: string | null = null) => {
        const newFiles = filesArray.map(f => internalCreateFile(f, parentId))
        setFileSystem(prev => [...prev, ...newFiles])
        return newFiles
    }, [setFileSystem, internalCreateFile])


    const moveItem = useCallback((itemId: string, newParentId: string | null) => {
        setFileSystem(prev => {
            if (itemId === newParentId) return prev
            const item = prev.find(i => i.id === itemId)
            if (!item || (item.type === 'folder' && newParentId && isDescendant(newParentId, itemId, prev))) {
                return prev
            }
            return prev.map(i => i.id === itemId ? { ...i, parentId: newParentId } : i)
        })
        return true
    }, [setFileSystem, isDescendant])

    const deleteItem = useCallback((itemId: string) => {
        setFileSystem(prev => {
            const childMap = new Map<string, string[]>()
            prev.forEach(item => {
                if (item.parentId) {
                    if (!childMap.has(item.parentId)) childMap.set(item.parentId, [])
                    childMap.get(item.parentId)!.push(item.id)
                }
            })

            const idsToDelete = new Set<string>()
            const queue = [itemId]

            while (queue.length > 0) {
                const currentId = queue.shift()!
                idsToDelete.add(currentId)
                const children = childMap.get(currentId) || []
                children.forEach(childId => queue.push(childId))
            }

            return prev.filter(i => !idsToDelete.has(i.id))
        })
        return true
    }, [setFileSystem])

    const clearAll = useCallback(() => setFileSystem([]), [setFileSystem])

    // ===== Optimization: Child Lookup Map =====
    // We use a ref to store the previous map to enable stable array references
    const prevChildrenMapRef = useRef(new Map<string, FileSystemItem[]>())

    const childrenMap = useMemo(() => {
        const nextMap = new Map<string, FileSystemItem[]>()

        // 1. Build new map with fresh arrays
        fileSystem.forEach(item => {
            const pid = item.parentId || 'root'
            if (!nextMap.has(pid)) nextMap.set(pid, [])
            nextMap.get(pid)!.push(item)
        })

        // 2. Diff with previous map to preserve stable references for unchanged folders
        const prevMap = prevChildrenMapRef.current
        const finalMap = new Map<string, FileSystemItem[]>()

        // Iterate over all keys in the new map (and potential old keys if needed, but we only care about current data)
        for (const [key, newChildren] of nextMap.entries()) {
            const oldChildren = prevMap.get(key)

            // Check if arrays are identical (same length, same item references)
            let isSame = false
            if (oldChildren && oldChildren.length === newChildren.length) {
                isSame = true
                for (let i = 0; i < newChildren.length; i++) {
                    if (newChildren[i] !== oldChildren[i]) {
                        isSame = false
                        break
                    }
                }
            }

            // Reuse old array instance if identical
            finalMap.set(key, (isSame && oldChildren) ? oldChildren : newChildren)
        }

        prevChildrenMapRef.current = finalMap
        return finalMap
    }, [fileSystem])

    // ===== Queries =====

    const getChildren = useCallback((parentId: string | null = null) =>
        childrenMap.get(parentId || 'root') || [], [childrenMap])

    const getRootItems = useCallback(() =>
        childrenMap.get('root') || [], [childrenMap])

    const getItemPath = useCallback((itemId: string) => {
        const path: FileSystemItem[] = []
        let currentItem = findItem(itemId)
        while (currentItem) {
            path.unshift(currentItem)
            if (currentItem.parentId) {
                currentItem = findItem(currentItem.parentId)
            } else {
                currentItem = undefined
            }
        }
        return path
    }, [findItem])

    const contextValue = useMemo(() => ({
        fileSystem,
        addFolder,
        addFile,
        addFiles,
        moveItem,
        deleteItem,
        getChildren,
        getRootItems,
        getItemById: findItem,
        getItemPath,
        clearAll
    }), [fileSystem, addFolder, addFile, addFiles, moveItem, deleteItem, getChildren, getRootItems, findItem, getItemPath, clearAll])

    return <FileContext.Provider value={contextValue}>{children}</FileContext.Provider>
}

export function useFileSystem() {
    const context = useContext(FileContext)
    if (!context) throw new Error('useFileSystem must be used within FileProvider')
    return context
}

export default FileContext
