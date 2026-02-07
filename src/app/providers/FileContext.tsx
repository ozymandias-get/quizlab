import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef } from 'react'
// import { useLanguage } from './LanguageContext'
import { validateFileName } from '@src/utils/fileUtils'

export interface FileSystemItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    parentId: string | null;
    path?: string | null;
    size?: number | null;
    streamUrl?: string | null; // Ephemeral
    error?: boolean;
    createdAt?: string;
    isImported?: boolean;
    is_imported?: boolean;
    original_path?: string;
    children?: FileSystemItem[]; // If returned nested from backend
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
    addFolder: (name: string, parentId?: string | null) => Promise<FileSystemItem | null>;
    addFile: (fileObj: FileInput, parentId?: string | null) => void;
    addFiles: (files: FileInput[], parentId?: string | null) => void;
    importFile: (sourcePath: string) => Promise<boolean>;
    deleteItem: (itemId: string) => Promise<boolean>;
    refreshFileSystem: () => Promise<void>;
    getChildren: (parentId?: string | null) => FileSystemItem[];
    getRootItems: () => FileSystemItem[];
    getItemById: (id: string) => FileSystemItem | undefined;
    getItemPath: (itemId: string) => FileSystemItem[];
    moveItem: (itemId: string, newParentId: string | null) => Promise<boolean>;
    clearAll: () => Promise<boolean>;
}

const FileContext = createContext<FileContextType | null>(null)

/**
 * FileProvider - Manages the file system state via Backend IPC
 */
export function FileProvider({ children }: { children: React.ReactNode }) {
    const [fileSystem, setFileSystem] = React.useState<FileSystemItem[]>([])
    // const { t } = useLanguage()

    // We use a simple refresh trigger to reload data
    const refreshFileSystem = useCallback(async () => {
        try {
            const items = await window.electronAPI.library.getFileSystem();

            // Backend returns a nested tree structure (folders have 'children' array).
            // To maintain compatibility with the frontend's existing "flat list with ID references" logic (mostly used by childrenMap),
            // we should flatten this tree into a single array of items.

            const flatList: FileSystemItem[] = [];

            const traverse = (nodes: any[]) => {
                for (const node of nodes) {
                    const item: FileSystemItem = {
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        parentId: node.parentId, // Backend should return this, if not we track it during traversal or rely on node prop
                        path: node.path,
                        size: node.size,
                        isImported: node.isImported,
                        createdAt: node.createdAt
                        // streamUrl: handled separately or on demand
                    };
                    flatList.push(item);

                    if (node.children && node.children.length > 0) {
                        traverse(node.children);
                    }
                }
            };

            if (Array.isArray(items)) {
                traverse(items);
            }

            setFileSystem(flatList);
        } catch (error) {
            console.error("Failed to load file system:", error);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        refreshFileSystem();
    }, [refreshFileSystem]);

    // ===== Helpers =====

    const findItem = useCallback((id: string) => fileSystem.find(i => i.id === id), [fileSystem])

    // ===== Mutations =====

    const addFolder = useCallback(async (name: string, parentId: string | null = null) => {
        const validation = validateFileName(name)
        if (!validation.valid) return null;

        try {
            const newFolder = await window.electronAPI.library.createFolder(validation.name!, parentId);
            await refreshFileSystem();
            return newFolder;
        } catch (e) {
            console.error("Add folder failed", e);
            return null;
        }
    }, [refreshFileSystem])

    const addFile = useCallback((fileObj: FileInput, parentId: string | null = null) => {
        // Transient add for drag & drop preview
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tempItem: FileSystemItem = {
            id: tempId,
            name: fileObj.name,
            type: 'file',
            parentId: parentId || null,
            path: fileObj.path || null,
            size: fileObj.size,
            streamUrl: fileObj.streamUrl,
            error: false,
            createdAt: new Date().toISOString(),
            isImported: false, // Not yet imported
            // isTransient: true // Optional, if we want to style it differently
        };

        setFileSystem(prev => [...prev, tempItem]);
    }, []);

    const addFiles = useCallback((files: FileInput[], parentId: string | null = null) => {
        // Bulk add for drag & drop
        const newItems: FileSystemItem[] = files.map(fileObj => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: fileObj.name,
            type: 'file', // Explicitly cast to 'file'
            parentId: parentId || null,
            path: fileObj.path || null,
            size: fileObj.size,
            streamUrl: fileObj.streamUrl,
            error: false,
            createdAt: new Date().toISOString(),
            isImported: false
        }));

        setFileSystem(prev => [...prev, ...newItems]);
    }, []);

    const importFile = useCallback(async (sourcePath: string) => {
        try {
            const result = await window.electronAPI.library.importFile(sourcePath);
            if (result.success) {
                await refreshFileSystem();
                return true;
            }
            return false;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    }, [refreshFileSystem]);


    const deleteItem = useCallback(async (itemId: string) => {
        // Handle transient/temp items locally
        if (itemId.startsWith('temp_')) {
            setFileSystem(prev => prev.filter(i => i.id !== itemId));
            return true;
        }

        try {
            // Backend now auto-detects type, so we only pass ID
            const success = await window.electronAPI.library.deleteItem(itemId);
            if (success) {
                await refreshFileSystem();
                return true;
            }
            return false;
        } catch (e) {
            console.error("Delete failed", e);
            return false;
        }
    }, [refreshFileSystem])

    const moveItem = useCallback(async (itemId: string, newParentId: string | null) => {
        if (itemId.startsWith('temp_')) return false; // Cannot move temps

        try {
            const success = await window.electronAPI.library.moveItem(itemId, newParentId);
            if (success) {
                await refreshFileSystem();
                return true;
            }
            return false;
        } catch (e) {
            console.error("Move failed", e);
            return false;
        }
    }, [refreshFileSystem]);


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

        // 2. Diff with previous map
        const prevMap = prevChildrenMapRef.current
        const finalMap = new Map<string, FileSystemItem[]>()

        for (const [key, newChildren] of nextMap.entries()) {
            const oldChildren = prevMap.get(key)
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

    const clearAll = useCallback(async (): Promise<boolean> => {
        const persistentItems = fileSystem.filter(item => !item.id.startsWith('temp_'))

        if (persistentItems.length > 0) {
            const persistentIds = new Set(persistentItems.map(item => item.id))
            const rootPersistentItems = persistentItems.filter(item =>
                !item.parentId || !persistentIds.has(item.parentId)
            )

            const results = await Promise.allSettled(
                rootPersistentItems.map(item => window.electronAPI.library.deleteItem(item.id))
            )

            const hasFailure = results.some(result =>
                result.status === 'rejected' || (result.status === 'fulfilled' && result.value !== true)
            )
            await refreshFileSystem()
            return !hasFailure
        }

        setFileSystem([])
        return true
    }, [fileSystem, refreshFileSystem])

    const contextValue = useMemo(() => ({
        fileSystem,
        addFolder,
        addFile,
        addFiles,
        deleteItem,
        importFile,
        refreshFileSystem,
        getChildren,
        getRootItems,
        getItemById: findItem,
        getItemPath,
        moveItem,
        clearAll
    }), [fileSystem, addFolder, addFile, addFiles, deleteItem, importFile, refreshFileSystem, getChildren, getRootItems, findItem, getItemPath, moveItem, clearAll])

    return <FileContext.Provider value={contextValue}>{children}</FileContext.Provider>
}

export function useFileSystem() {
    const context = useContext(FileContext)
    if (!context) throw new Error('useFileSystem must be used within FileProvider')
    return context
}



