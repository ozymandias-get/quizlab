import { promises as fs, existsSync } from 'fs';
import path from 'path';

/**
 * Generic JSON configuration manager for persistence
 */
export class ConfigManager<T extends Record<string, any>> {
    private filePath: string;
    private cache: T | null = null;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    private async ensureFile(): Promise<void> {
        if (!existsSync(this.filePath)) {
            const dir = path.dirname(this.filePath);
            if (!existsSync(dir)) {
                await fs.mkdir(dir, { recursive: true });
            }
            await fs.writeFile(this.filePath, JSON.stringify({}, null, 2), 'utf8');
        }
    }

    private readPromise: Promise<T> | null = null;

    public async read(force: boolean = false): Promise<T> {
        if (this.cache && !force) return this.cache;

        // Prevent concurrent reads
        if (this.readPromise && !force) return this.readPromise;

        this.readPromise = (async () => {
            try {
                await this.ensureFile();
                const data = await fs.readFile(this.filePath, 'utf8');
                this.cache = JSON.parse(data || '{}') as T;
                return this.cache;
            } catch (error) {
                console.error(`[ConfigManager] Failed to read ${this.filePath}:`, error);
                return (this.cache || {}) as T;
            } finally {
                this.readPromise = null;
            }
        })();

        return this.readPromise;
    }

    public async write(data: T): Promise<boolean> {
        try {
            await this.ensureFile();
            const content = JSON.stringify(data, null, 2);
            // Atomic write: Write to temp file then rename
            const tempPath = `${this.filePath}.tmp`;
            await fs.writeFile(tempPath, content, 'utf8');
            await fs.rename(tempPath, this.filePath);

            this.cache = data;
            return true;
        } catch (error) {
            console.error(`[ConfigManager] Failed to write ${this.filePath}:`, error);
            return false;
        }
    }

    public async update(updater: (current: T) => T | Promise<T>): Promise<boolean> {
        const current = await this.read();
        const updated = await updater(current);
        return this.write(updated);
    }

    public async getItem<K extends keyof T>(key: K): Promise<T[K] | undefined> {
        const data = await this.read();
        return data[key];
    }

    public async setItem<K extends keyof T>(key: K, value: T[K]): Promise<boolean> {
        return this.update((current) => ({
            ...current,
            [key]: value
        }));
    }

    public async deleteItem(key: string): Promise<boolean> {
        return this.update((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
    }

    public async clear(): Promise<boolean> {
        return this.write({} as T);
    }
}
