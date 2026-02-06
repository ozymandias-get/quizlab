import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { APP_CONFIG } from '../../main/constants'
import { DatabaseManager } from '../../core/DatabaseManager'

export function registerLibraryHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const db = DatabaseManager.getInstance()

    ipcMain.handle(IPC_CHANNELS.DB_GET_FILE_SYSTEM, (event) => {
        return db.getFolderTree()
    })

    ipcMain.handle(IPC_CHANNELS.DB_CREATE_FOLDER, (event, name: string, parentId: string | null) => {
        return db.createFolder(name, parentId)
    })

    ipcMain.handle(IPC_CHANNELS.DB_MOVE_ITEM, (event, id: string, newParentId: string | null) => {
        return db.moveItem(id, newParentId)
    })

    ipcMain.handle(IPC_CHANNELS.DB_SEARCH_LIBRARY, (event, query: string) => {
        return db.searchLibrary(query)
    })

    ipcMain.handle(IPC_CHANNELS.DB_DELETE_ITEM, async (event, id: string) => {
        try {
            // 1. Get all physical paths to delete before removing from DB
            const pathsToUnlink = db.getPhysicalPathsRecursive(id)

            // 2. Delete from DB (cascading handles children in DB)
            const deleted = db.deleteItem(id)

            if (deleted) {
                // 3. Clean up disk files asynchronously
                for (const filePath of pathsToUnlink) {
                    try {
                        await fs.unlink(filePath)
                    } catch (err) {
                        console.warn(`[Library] Failed to delete physical file: ${filePath}`, err)
                    }
                }
                return true
            }
            return false
        } catch (error) {
            console.error('[IPC] Delete item failed:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.FILE_IMPORT, async (event, sourcePath: string, folderId: string | null = null) => {
        try {
            const stats = await fs.stat(sourcePath)
            if (!stats.isFile()) throw new Error('error_not_valid_file')

            const libPath = db.getLibraryPath()
            const ext = path.extname(sourcePath)
            const name = path.basename(sourcePath, ext)
            const safeFileName = `${name}_${Date.now()}${ext}`
            const targetPath = path.join(libPath, safeFileName)

            await fs.copyFile(sourcePath, targetPath)

            const finalFile = db.addFileReference({
                name: path.basename(sourcePath),
                originalPath: sourcePath,
                size: stats.size,
                folderId: folderId,
                isImported: true,
                storedPath: targetPath
            })

            return { success: true, file: finalFile }
        } catch (error) {
            console.error('[IPC] File import failed:', error)
            const message = error instanceof Error ? error.message : String(error)
            return { success: false, error: message }
        }
    })

    ipcMain.handle(IPC_CHANNELS.LIBRARY_GET_FOLDER_PATH, (event, id: string) => {
        return db.getItemPath(id)
    })

    // --- NOTES ---
    ipcMain.handle(IPC_CHANNELS.DB_GET_NOTES, (event, fileId: string) => {
        return db.getNotes(fileId)
    })

    ipcMain.handle(IPC_CHANNELS.DB_SAVE_NOTE, (event, params: any) => {
        return db.saveNote(params)
    })

    ipcMain.handle(IPC_CHANNELS.DB_DELETE_NOTE, (event, id: string) => {
        return db.deleteNote(id)
    })
}
