import { promises as fs } from 'fs'
import path from 'path'

import { LOGIN_TIMEOUT_MS } from './sessionConfig.js'

export interface ProfileHealthResult {
  profileDirExists: boolean
  profileDirAccessible: boolean
  profileSizeBytes: number
  profileSizeWarning: boolean
  staleLockDetected: boolean
  overallHealthy: boolean
}

const PROFILE_SIZE_WARNING_BYTES = 100 * 1024 * 1024
const STALE_LOCK_THRESHOLD_MS =
  (LOGIN_TIMEOUT_MS > 0 ? LOGIN_TIMEOUT_MS : 7_200_000) + 30 * 60 * 1000

export class ProfileHealthChecker {
  private lastFullScanAt = 0
  private cachedProfileSizeBytes = 0
  private readonly FULL_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000

  constructor(
    private profileDir: string,
    private lockPath: string
  ) {}

  async checkProfileHealth(): Promise<ProfileHealthResult> {
    const [profileDirExists, profileDirAccessible, profileSizeBytes] = await this.checkDirectory(
      this.profileDir
    )
    const staleLockDetected = await this.checkStaleLock()

    const overallHealthy = profileDirExists && profileDirAccessible && !staleLockDetected

    return {
      profileDirExists,
      profileDirAccessible,
      profileSizeBytes,
      profileSizeWarning: profileSizeBytes > PROFILE_SIZE_WARNING_BYTES,
      staleLockDetected,
      overallHealthy
    }
  }

  private async checkDirectory(dirPath: string): Promise<[boolean, boolean, number]> {
    try {
      const stat = await fs.stat(dirPath)
      if (!stat.isDirectory()) return [false, false, 0]
      await fs.readdir(dirPath)
      const totalSize = await this.getDirectorySizeCached(dirPath)
      return [true, true, totalSize]
    } catch {
      return [false, false, 0]
    }
  }

  private async getDirectorySizeCached(dirPath: string): Promise<number> {
    const now = Date.now()
    if (now - this.lastFullScanAt < this.FULL_SCAN_INTERVAL_MS) {
      return this.cachedProfileSizeBytes
    }
    this.lastFullScanAt = now
    this.cachedProfileSizeBytes = await this.getDirectorySize(dirPath)
    return this.cachedProfileSizeBytes
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0
    try {
      // withFileTypes tells us the entry kind without a syscall, so directories
      // (the bulk of a Chromium profile) no longer need the per-entry stat that
      // the previous readdir()+stat()-per-entry version performed. Symlinks and
      // plain files still need one for their size / to keep following links.
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name)

        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          totalSize += await this.getDirectorySize(entryPath)
          continue
        }

        const stat = await fs.stat(entryPath)
        totalSize += stat.isDirectory() ? await this.getDirectorySize(entryPath) : stat.size
      }
    } catch {}
    return totalSize
  }

  private async checkStaleLock(): Promise<boolean> {
    try {
      const content = await fs.readFile(this.lockPath, 'utf-8')
      const lockData = JSON.parse(content) as {
        heartbeatAt?: string
        createdAt?: string
      }
      // profileLock writes `heartbeatAt` + `createdAt`. It never wrote
      // `acquiredAt`, so reading that key made this check return false for every
      // lock file the app produces and silently disabled the stale-lock
      // recovery branch downstream.
      const ageOf = (value: string | undefined): number | null => {
        if (typeof value !== 'string' || value.length === 0) return null
        const time = Date.parse(value)
        return Number.isFinite(time) ? Date.now() - time : null
      }

      const heartbeatAge = ageOf(lockData.heartbeatAt)
      if (heartbeatAge !== null) return heartbeatAge > STALE_LOCK_THRESHOLD_MS

      const createdAtAge = ageOf(lockData.createdAt)
      if (createdAtAge !== null) return createdAtAge > STALE_LOCK_THRESHOLD_MS
    } catch {}
    return false
  }
}
