import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

import { SchemaManager } from './database/SchemaManager';
import { FolderRepository } from './database/FolderRepository';
import { FileRepository } from './database/FileRepository';
import { NoteRepository } from './database/NoteRepository';

export class DatabaseManager {
    private db: Database.Database;
    private static instance: DatabaseManager;

    private schemaManager: SchemaManager;
    private folderRepo: FolderRepository;
    private fileRepo: FileRepository;
    private noteRepo: NoteRepository;

    private constructor() {
        const userDataPath = app.getPath('userData');
        this.ensureLibraryExists(userDataPath);

        const dbPath = path.join(userDataPath, 'library.sqlite');

        console.log(`Initializing database at ${dbPath}`);
        this.db = new Database(dbPath);

        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('busy_timeout = 3000');

        // Initialize helpers
        this.schemaManager = new SchemaManager(this.db);
        this.folderRepo = new FolderRepository(this.db);
        this.fileRepo = new FileRepository(this.db);
        this.noteRepo = new NoteRepository(this.db);

        this.schemaManager.initSchema();
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public getDatabase(): Database.Database {
        return this.db;
    }

    public prepare(sql: string): Database.Statement {
        return this.db.prepare(sql);
    }

    public transaction<F extends (...args: any[]) => any>(fn: F): Database.Transaction<F> {
        return this.db.transaction(fn);
    }

    public getLibraryPath(): string {
        return path.join(app.getPath('userData'), 'Library');
    }

    private ensureLibraryExists(userDataPath: string) {
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        const libPath = path.join(userDataPath, 'Library');
        if (!fs.existsSync(libPath)) {
            fs.mkdirSync(libPath, { recursive: true });
        }
    }

    // ===== FOLDERS ======

    public createFolder(name: string, parentId: string | null = null): any {
        return this.folderRepo.create(name, parentId);
    }

    public getFolder(id: string): any {
        return this.folderRepo.get(id);
    }

    /**
     * Returns the full hierarchy of files and folders because the frontend
     * FileExplorer expects a nested tree structure (or easy to construct one).
     */
    public getFolderTree(): any[] {
        try {
            const folders = this.folderRepo.getAll();
            const files = this.fileRepo.getAll();

            const folderMap = new Map<string, any>();
            const rootItems: any[] = [];

            // 1. Initialize folder nodes
            folders.forEach((f: any) => {
                folderMap.set(f.id, {
                    id: f.id,
                    name: f.name,
                    type: 'folder',
                    parentId: f.parent_id,
                    createdAt: f.created_at,
                    children: []
                });
            });

            // 2. Process Files and assign to folders (or root)
            files.forEach((f: any) => {
                const fileItem = {
                    id: f.id,
                    name: f.name,
                    type: 'file',
                    parentId: f.folder_id,
                    // Logic: if stored_path exists (imported), use it? 
                    // Mostly frontend just needs an ID to request the stream, but path is useful for display info
                    path: f.stored_path || f.original_path,
                    isImported: !!f.is_imported, // CamelCase for existing logic
                    is_imported: !!f.is_imported, // Requested snake_case
                    original_path: f.original_path, // Requested
                    size: f.size,
                    createdAt: f.created_at
                };

                if (f.folder_id && folderMap.has(f.folder_id)) {
                    folderMap.get(f.folder_id).children.push(fileItem);
                } else {
                    rootItems.push(fileItem);
                }
            });

            // 3. Link Folders to their parents
            folders.forEach((f: any) => {
                const folderNode = folderMap.get(f.id);
                if (f.parent_id && folderMap.has(f.parent_id)) {
                    folderMap.get(f.parent_id).children.push(folderNode);
                } else {
                    rootItems.push(folderNode);
                }
            });

            return rootItems;
        } catch (error) {
            console.error('[DatabaseManager] Failed to retrieve folder tree:', error);
            throw new Error('Failed to retrieve file system tree.');
        }
    }

    public getAllFolders(): any[] {
        return this.folderRepo.getAll();
    }

    public searchLibrary(query: string): any[] {
        try {
            const folders = this.folderRepo.search(query);
            const files = this.fileRepo.search(query);

            return [
                ...folders.map(f => ({ ...f, type: 'folder' })),
                ...files.map(f => ({ ...f, type: 'file' }))
            ];
        } catch (error) {
            console.error(`[DatabaseManager] Search failed for '${query}':`, error);
            return [];
        }
    }

    // ===== FILES ======

    /**
     * Adds a file record. 
     * For "Transient Preview": Call with basic details (isImported=0 default).
     */
    public addFileReference(params: {
        name: string,
        originalPath: string,
        size: number,
        folderId?: string | null,
        isImported?: boolean,
        storedPath?: string | null
    }): any {
        return this.fileRepo.add(params);
    }

    public getFileById(id: string): any {
        return this.fileRepo.get(id);
    }

    public deleteItem(id: string): boolean {
        // Try deleting as file
        if (this.fileRepo.delete(id)) return true;

        // Try deleting as folder
        return this.folderRepo.delete(id);
    }

    public getPhysicalPathsRecursive(id: string): string[] {
        const paths: string[] = [];

        // Check if it's a file
        const file = this.getFileById(id);
        if (file) {
            if (file.is_imported && file.stored_path) {
                paths.push(file.stored_path);
            }
            return paths;
        }

        // Check if it's a folder
        const folder = this.getFolder(id);
        if (folder) {
            const getPaths = (fId: string) => {
                const files = this.fileRepo.getFilesInFolder(fId);
                const folders = this.folderRepo.getSubfolders(fId);

                for (const f of files) {
                    if (f.is_imported && f.stored_path) {
                        paths.push(f.stored_path);
                    }
                }
                for (const sub of folders) {
                    getPaths(sub.id);
                }
            };
            getPaths(id);
        }

        return paths;
    }

    public getFolderContents(folderId: string | null): { files: any[], folders: any[] } {
        try {
            const folders = this.folderRepo.getSubfolders(folderId);
            const files = this.fileRepo.getFilesInFolder(folderId);
            return { folders, files };
        } catch (error) {
            console.error(`[DatabaseManager] Failed to get contents for folder ${folderId || 'root'}:`, error);
            throw new Error('Failed to retrieve folder contents.');
        }
    }

    public moveItem(id: string, newParentId: string | null): boolean {
        try {
            if (id === newParentId) return false;

            // 1. If it's a folder, prevent circular move
            const isFolder = this.folderRepo.exists(id);
            if (isFolder && newParentId) {
                if (this.isSubfolderOf(newParentId, id)) {
                    throw new Error('Cannot move a folder into its own subfolder');
                }
            }

            // 2. Try to move as File
            if (this.fileRepo.updateFolder(id, newParentId)) return true;

            // 3. Try to move as Folder
            return this.folderRepo.updateParent(id, newParentId);

        } catch (error) {
            console.error(`[DatabaseManager] Failed to move item ${id} to ${newParentId}:`, error);
            throw error;
        }
    }

    public getItemPath(id: string): any[] {
        const breadcrumbs: any[] = [];
        let currentId: string | null = id;

        // Try as file first
        const file = this.getFileById(id);
        if (file) {
            breadcrumbs.unshift({ id: file.id, name: file.name, type: 'file' });
            currentId = file.folder_id;
        } else {
            // Try as folder
            const folder = this.getFolder(id);
            if (folder) {
                breadcrumbs.unshift({ id: folder.id, name: folder.name, type: 'folder' });
                currentId = folder.parent_id;
            } else {
                return [];
            }
        }

        // Traverse up
        while (currentId) {
            const folder = this.getFolder(currentId);
            if (!folder) break;
            breadcrumbs.unshift({ id: folder.id, name: folder.name, type: 'folder' });
            currentId = folder.parent_id;
        }

        return breadcrumbs;
    }

    private isSubfolderOf(childId: string, parentId: string): boolean {
        let currentId: string | null = childId;
        while (currentId) {
            const parent = this.folderRepo.getParentId(currentId);
            if (!parent) break;
            if (parent === parentId) return true;
            currentId = parent;
        }
        return false;
    }

    // ===== NOTES ======

    public getNotes(fileId: string): any[] {
        return this.noteRepo.getByFileId(fileId);
    }

    public saveNote(params: {
        id?: string,
        fileId: string,
        content: string,
        pageNumber?: number,
        color?: string
    }): any {
        return this.noteRepo.save(params);
    }

    public deleteNote(id: string): boolean {
        return this.noteRepo.delete(id);
    }

    public close() {
        this.db.close();
    }
}
