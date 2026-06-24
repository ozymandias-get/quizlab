import { promises as fs } from 'fs'

import { Logger } from '../../core/logger.js'

export class SessionSnapshotRepository {
  constructor(private snapshotPath: string) {}

  async readStorageStateSnapshot(): Promise<unknown | null> {
    try {
      const raw = await fs.readFile(this.snapshotPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async writeStorageStateSnapshot(storageState: unknown | null): Promise<void> {
    if (!storageState) return
    try {
      await fs.writeFile(this.snapshotPath, JSON.stringify(storageState, null, 2), { mode: 0o600 })
    } catch (error) {
      Logger.error(
        '[SessionSnapshot] Failed to write storage state snapshot:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  async clearSnapshot(): Promise<void> {
    try {
      await fs.unlink(this.snapshotPath)
    } catch {
      // Missing file is not an error
    }
  }
}
