import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export class NoteRepository {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    public getByFileId(fileId: string): any[] {
        try {
            return this.db.prepare('SELECT * FROM notes WHERE file_id = ? ORDER BY page_number ASC, created_at ASC').all(fileId);
        } catch (error) {
            console.error(`[NoteRepository] Failed to get notes for file ${fileId}:`, error);
            return [];
        }
    }

    public save(params: {
        id?: string,
        fileId: string,
        content: string,
        pageNumber?: number,
        color?: string
    }): any {
        try {
            const id = params.id || randomUUID();
            const stmt = this.db.prepare(`
                INSERT INTO notes (id, file_id, content, page_number, color)
                VALUES (@id, @fileId, @content, @pageNumber, @color)
                ON CONFLICT(id) DO UPDATE SET
                    content = EXCLUDED.content,
                    page_number = EXCLUDED.page_number,
                    color = EXCLUDED.color
            `);

            stmt.run({
                id,
                fileId: params.fileId,
                content: params.content,
                pageNumber: params.pageNumber || null,
                color: params.color || null
            });

            return this.get(id);
        } catch (error) {
            console.error('[NoteRepository] Failed to save note:', error);
            throw error;
        }
    }

    public get(id: string): any {
        return this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    }

    public delete(id: string): boolean {
        try {
            const result = this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
            return result.changes > 0;
        } catch (error) {
            console.error(`[NoteRepository] Failed to delete note ${id}:`, error);
            return false;
        }
    }
}
