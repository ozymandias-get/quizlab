import { constants as fsConstants, promises as fs } from 'fs'
import type { FileHandle } from 'fs/promises'

import type { LockResult } from './sessionContracts.js'
import { logSuppressedError } from './sessionErrors.js'
import { isProcessAlive, nowIso } from './sessionUtils.js'

/** Grace window before reclaiming an unreadable/partial lock file. */
const LOCK_WRITE_GRACE_MS = 50

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type LockRead = { status: 'ok'; raw: string } | { status: 'missing' } | { status: 'error' }

export class ProfileLock {
  private readonly lockPath: string
  private readonly ensureProfileDirectory: () => Promise<void>
  private lockHandle: FileHandle | null = null
  private lockDepth = 0

  constructor(options: { lockPath: string; ensureProfileDirectory: () => Promise<void> }) {
    this.lockPath = options.lockPath
    this.ensureProfileDirectory = options.ensureProfileDirectory
  }

  async acquire(): Promise<LockResult> {
    if (this.lockHandle) {
      this.lockDepth += 1
      return { ok: true }
    }

    await this.ensureProfileDirectory()

    const tryAcquire = async (): Promise<LockResult> => {
      try {
        this.lockHandle = await fs.open(
          this.lockPath,
          fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_RDWR
        )
        this.lockDepth = 1
        try {
          await this.lockHandle.writeFile(
            JSON.stringify({ pid: process.pid, createdAt: nowIso() }),
            'utf8'
          )
        } catch {
          // Open succeeded but the lock content was never written — the file on
          // disk is a partial lock that must not be left behind (stale lock).
          await this.lockHandle.close().catch(() => {})
          this.lockHandle = null
          this.lockDepth = 0
          await fs.rm(this.lockPath, { force: true }).catch((rmError) => {
            logSuppressedError('failed to remove partial lock file', rmError)
          })
          return { ok: false, error: 'lock_error' }
        }
        return { ok: true }
      } catch (error: unknown) {
        if (!(error && typeof error === 'object' && 'code' in error) || error.code !== 'EEXIST') {
          return { ok: false, error: 'lock_error' }
        }
        return { ok: false, error: 'already_in_use' }
      }
    }

    /**
     * Atomically quarantines a stale lock before reclaiming it. `rename` to a
     * unique path succeeds for only one contender, so a racing process can
     * never `rm` a lock that a peer just (re)created — the split-brain that
     * previously left the profile permanently "locked".
     */
    const reclaimStale = async (): Promise<LockResult> => {
      const quarantinePath = `${this.lockPath}.stale-${process.pid}-${Date.now()}`
      try {
        await fs.rename(this.lockPath, quarantinePath)
      } catch {
        // Source vanished or rename failed — someone else took over the stale
        // lock. Fall through to a fresh acquire.
        return tryAcquire()
      }
      await fs.rm(quarantinePath, { force: true }).catch((error) => {
        logSuppressedError('failed to remove quarantined lock file', error)
      })
      return tryAcquire()
    }

    const first = await tryAcquire()
    if (first.ok || first.error !== 'already_in_use') return first

    const readLock = async (): Promise<LockRead> => {
      try {
        return { status: 'ok', raw: await fs.readFile(this.lockPath, 'utf8') }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          return { status: 'missing' }
        }
        return { status: 'error' }
      }
    }

    let read = await readLock()
    if (read.status === 'missing') return tryAcquire()

    // Empty/partial lock files are usually a peer mid-write (the O_EXCL file
    // exists before `writeFile` lands). Wait once and re-read instead of
    // blindly deleting what could be a live lock being created.
    if (read.status === 'error' || (read.status === 'ok' && !this.isWellFormedLock(read.raw))) {
      await sleep(LOCK_WRITE_GRACE_MS)
      read = await readLock()
    }

    if (read.status === 'missing') return tryAcquire()

    // Well-formed and owned by a live process → genuinely in use.
    if (read.status === 'ok' && this.isWellFormedLock(read.raw) && !this.isStaleLock(read.raw)) {
      return first
    }

    // Provably stale (dead pid) or a leftover partial file → reclaim it.
    if (read.status === 'ok') return reclaimStale()

    // Still unreadable after the grace window → be conservative; a live lock
    // may simply be unreadable for us. Report it as in use.
    return first
  }

  private isWellFormedLock(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw) as { pid?: number }
      return typeof parsed?.pid === 'number' && Number.isInteger(parsed.pid) && parsed.pid > 0
    } catch {
      return false
    }
  }

  private isStaleLock(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw) as { pid?: number }
      return !parsed?.pid || !isProcessAlive(parsed.pid)
    } catch {
      return false
    }
  }

  async release(): Promise<void> {
    if (!this.lockHandle) return

    this.lockDepth -= 1
    if (this.lockDepth > 0) return

    try {
      await this.lockHandle.close()
    } catch {}

    this.lockHandle = null
    this.lockDepth = 0
    await fs.rm(this.lockPath, { force: true }).catch((error) => {
      logSuppressedError('failed to remove lock file on release', error)
    })
  }
}
