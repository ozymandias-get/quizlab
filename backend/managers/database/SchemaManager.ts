import Database from 'better-sqlite3';

export class SchemaManager {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    public initSchema() {
        // Define migrations in sequence. Index + 1 = Version Number.
        const migrations: (() => void)[] = [
            // v1: Initial Schema
            () => {
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS folders (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        parent_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS files (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        original_path TEXT NOT NULL,
                        stored_path TEXT,
                        folder_id TEXT,
                        size INTEGER,
                        is_imported BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_folder_parent ON folders(parent_id);
                    CREATE INDEX IF NOT EXISTS idx_file_folder ON files(folder_id);
                `);
            },
            // v2: Added Notes Table
            () => {
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS notes (
                        id TEXT PRIMARY KEY,
                        file_id TEXT NOT NULL,
                        content TEXT NOT NULL,
                        page_number INTEGER,
                        color TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_notes_file ON notes(file_id);

                    -- Trigger to update updated_at (checks for manual update suppression)
                    CREATE TRIGGER IF NOT EXISTS trg_notes_updated_at 
                    AFTER UPDATE ON notes
                    FOR EACH ROW
                    WHEN NEW.updated_at = OLD.updated_at
                    BEGIN
                        UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END;
                `);
            },
            // v3: Performance Index for notes
            () => {
                this.db.exec(`
                    CREATE INDEX IF NOT EXISTS idx_notes_page ON notes(page_number);
                `);
            }
        ];

        let currentVersion = this.db.pragma('user_version', { simple: true }) as number;
        const targetVersion = migrations.length;

        if (currentVersion < targetVersion) {
            console.log(`[SchemaManager] Upgrading database from v${currentVersion} to v${targetVersion}...`);

            for (let i = currentVersion; i < targetVersion; i++) {
                const stepVersion = i + 1;
                try {
                    this.db.transaction(() => {
                        migrations[i]();
                        this.db.pragma(`user_version = ${stepVersion}`);
                    })();
                    console.log(`[SchemaManager] Successfully migrated to v${stepVersion}`);
                } catch (error) {
                    console.error(`[SchemaManager] Migration to v${stepVersion} failed:`, error);
                    throw error; // Stop initialization on migration failure
                }
            }
        } else {
            console.log(`[SchemaManager] Database is up to date (v${currentVersion})`);
        }
    }
}
