import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export class FolderRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    public create(name: string, parentId: string | null = null): any {
        try {
            const id = randomUUID();
            const stmt = this.db.prepare(`
                INSERT INTO folders (id, name, parent_id)
                VALUES (?, ?, ?)
            `);
            stmt.run(id, name, parentId);

            return {
                id,
                name,
                type: 'folder',
                parentId,
                children: [],
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[FolderRepository] Failed to create folder '${name}':`, error);
            throw new Error(`Failed to create folder: ${name}`);
        }
    }

    public get(id: string): any {
        try {
            return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
        } catch (error) {
            console.error(`[FolderRepository] Failed to get folder ${id}:`, error);
            throw new Error(`Failed to get folder: ${id}`);
        }
    }

    public getAll(): any[] {
        try {
            return this.db.prepare('SELECT * FROM folders ORDER BY name ASC').all();
        } catch (error) {
            console.error('[FolderRepository] Failed to get all folders:', error);
            throw new Error('Failed to retrieve all folders');
        }
    }

    public delete(id: string): boolean {
        const result = this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
        return result.changes > 0;
    }

    public updateParent(id: string, newParentId: string | null): boolean {
        const stmt = this.db.prepare(`UPDATE folders SET parent_id = ? WHERE id = ?`);
        const result = stmt.run(newParentId, id);
        return result.changes > 0;
    }

    public exists(id: string): boolean {
        const result = this.db.prepare('SELECT 1 FROM folders WHERE id = ?').get(id);
        return !!result;
    }

    public getParentId(id: string): string | null {
        const folder: any = this.db.prepare('SELECT parent_id FROM folders WHERE id = ?').get(id);
        return folder ? folder.parent_id : null;
    }

    public getSubfolders(parentId: string | null): any[] {
        const query = parentId
            ? 'SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC'
            : 'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC';
        const args = parentId ? [parentId] : [];
        return this.db.prepare(query).all(...args);
    }

    public search(query: string): any[] {
        const sqlQuery = `%${query}%`;
        return this.db.prepare('SELECT * FROM folders WHERE name LIKE ?').all(sqlQuery) as any[];
    }
}
