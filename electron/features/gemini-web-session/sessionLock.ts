import { promises as fs, constants as fsConstants } from 'fs'
import type { FileHandle } from 'fs/promises'
import { isProcessAlive, nowIso } from './sessionUtils'

export interface LockResult {
    ok: boolean;
    error?: string;
}

export class ProfileLock {
    private lockHandle: FileHandle | null = null
    private lockDepth = 0

    constructor(
        private readonly lockPath: string,
        private readonly ensureDirectory: () => Promise<void>
    ) { }

    async acquire(): Promise<LockResult> {
        if (this.lockHandle) {
            this.lockDepth += 1
            return { ok: true }
        }

        await this.ensureDirectory()

        const tryAcquire = async (): Promise<LockResult> => {
            try {
                this.lockHandle = await fs.open(this.lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_RDWR)
                this.lockDepth = 1
                await this.lockHandle.writeFile(JSON.stringify({ pid: process.pid, createdAt: nowIso() }), 'utf8')
                return { ok: true }
            } catch (error: any) {
                if (error?.code !== 'EEXIST') {
                    return { ok: false, error: 'lock_error' }
                }
                return { ok: false, error: 'already_in_use' }
            }
        }

        const first = await tryAcquire()
        if (first.ok || first.error !== 'already_in_use') return first

        try {
            const lockRaw = await fs.readFile(this.lockPath, 'utf8')
            const parsed = JSON.parse(lockRaw) as { pid?: number }
            if (!parsed?.pid || !isProcessAlive(parsed.pid)) {
                await fs.rm(this.lockPath, { force: true })
                return tryAcquire()
            }
        } catch {
            await fs.rm(this.lockPath, { force: true }).catch(() => { })
            return tryAcquire()
        }

        return first
    }

    async release(): Promise<void> {
        if (!this.lockHandle) return

        this.lockDepth -= 1
        if (this.lockDepth > 0) return

        try {
            await this.lockHandle.close()
        } catch { }

        this.lockHandle = null
        this.lockDepth = 0
        await fs.rm(this.lockPath, { force: true }).catch(() => { })
    }
}
