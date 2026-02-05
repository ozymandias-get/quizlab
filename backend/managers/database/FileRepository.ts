import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export class FileRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    public add(params: {
        name: string,
        originalPath: string,
        size: number,
        folderId?: string | null,
        isImported?: boolean,
        storedPath?: string | null
    }): any {
        try {
            const id = randomUUID();
            const stmt = this.db.prepare(`
                INSERT INTO files (id, name, original_path, stored_path, folder_id, size, is_imported)
                VALUES (@id, @name, @originalPath, @storedPath, @folderId, @size, @isImported)
            `);

            stmt.run({
                id,
                name: params.name,
                originalPath: params.originalPath,
                storedPath: params.storedPath || null,
                folderId: params.folderId || null,
                size: params.size,
                isImported: params.isImported ? 1 : 0
            });

            return this.get(id);
        } catch (error) {
            console.error(`[FileRepository] Failed to add file reference for '${params.name}':`, error);
            throw new Error(`Failed to add file: ${params.name}`);
        }
    }

    public get(id: string): any {
        try {
            return this.db.prepare('SELECT * FROM files WHERE id = ?').get(id);
        } catch (error) {
            console.error(`[FileRepository] Failed to get file ${id}:`, error);
            throw new Error(`Failed to retrieve file: ${id}`);
        }
    }

    public getAll(): any[] {
        return this.db.prepare('SELECT * FROM files ORDER BY name ASC').all();
    }

    public delete(id: string): boolean {
        const result = this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
        return result.changes > 0;
    }

    public updateFolder(id: string, folderId: string | null): boolean {
        const stmt = this.db.prepare(`UPDATE files SET folder_id = ? WHERE id = ?`);
        const result = stmt.run(folderId, id);
        return result.changes > 0;
    }

    public getFilesInFolder(folderId: string | null): any[] {
        const query = folderId
            ? 'SELECT * FROM files WHERE folder_id = ? ORDER BY name ASC'
            : 'SELECT * FROM files WHERE folder_id IS NULL ORDER BY name ASC';
        const args = folderId ? [folderId] : [];
        return this.db.prepare(query).all(...args);
    }

    public search(query: string): any[] {
        const sqlQuery = `%${query}%`;
        return this.db.prepare('SELECT * FROM files WHERE name LIKE ?').all(sqlQuery) as any[];
    }
}
