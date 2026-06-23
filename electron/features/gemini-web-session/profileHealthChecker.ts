import { promises as fs } from 'fs'
import path from 'path'

import { LOGIN_TIMEOUT_MS } from './sessionConfig'

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
      const entries = await fs.readdir(dirPath)
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry)
        const stat = await fs.stat(entryPath)
        if (stat.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath)
        } else {
          totalSize += stat.size
        }
      }
    } catch {}
    return totalSize
  }

  private async checkStaleLock(): Promise<boolean> {
    try {
      const content = await fs.readFile(this.lockPath, 'utf-8')
      const lockData = JSON.parse(content)
      if (typeof lockData.acquiredAt === 'string') {
        const lockAge = Date.now() - new Date(lockData.acquiredAt).getTime()
        return lockAge > STALE_LOCK_THRESHOLD_MS
      }
    } catch {}
    return false
  }
}
