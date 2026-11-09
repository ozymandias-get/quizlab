/**
 * Durable quarantine markers.
 *
 * The site-session config file is the normal place for the quarantine flag. A
 * disk problem that makes that one write fail can also make a switch write
 * fail, so the marker lives in its own file: a corrupt or locked config does
 * not take the last durable guard with it. The marker is read on the packet
 * path, so a restart that could not update the config still refuses writes for
 * the site.
 *
 * This is still a best-effort guard: a completely unwritable disk cannot record
 * anything. The bridge falls back to wiping the unverified session when even
 * this write fails, and keeps the in-process set for the current run.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

import { Logger } from '../../core/logger.js'

const MARKER_DIRECTORY = 'site-session-quarantine'

function markerDirectory(): string {
  return path.join(app.getPath('userData'), MARKER_DIRECTORY)
}

/** A file name that cannot escape the marker directory. */
function markerFile(siteId: string): string {
  return path.join(markerDirectory(), `${Buffer.from(siteId, 'utf8').toString('hex')}.json`)
}

/** Records that a site must not be imported until the user recovers it. */
export async function writeQuarantineMarker(siteId: string, reason: string): Promise<boolean> {
  try {
    const directory = markerDirectory()
    await fs.mkdir(directory, { recursive: true })
    const target = markerFile(siteId)
    const temporary = `${target}.tmp`
    await fs.writeFile(
      temporary,
      JSON.stringify({ siteId, reason, createdAt: new Date().toISOString() }),
      'utf8'
    )
    await fs.rename(temporary, target)
    return true
  } catch (error) {
    Logger.warn(
      `[SiteSessionQuarantine] The marker of "${siteId}" could not be written: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

/**
 * The durable quarantine state of a site.
 *
 * `unknown` is deliberately separate from `absent`: a file that cannot be
 * read because of a permission or I/O error is not proof that no quarantine
 * exists. The caller treats it as quarantined (fail closed).
 */
export type QuarantineMarkerState = 'present' | 'absent' | 'unknown'

/** Reads whether a durable quarantine marker exists for the site. */
export async function readQuarantineMarker(siteId: string): Promise<QuarantineMarkerState> {
  try {
    await fs.access(markerFile(siteId))
    return 'present'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent'
    Logger.warn(
      `[SiteSessionQuarantine] The marker of "${siteId}" could not be read: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
    return 'unknown'
  }
}

/** Removes the marker after the user cleared or re-enabled the site. */
export async function clearQuarantineMarker(siteId: string): Promise<void> {
  try {
    await fs.rm(markerFile(siteId), { force: true })
  } catch (error) {
    Logger.warn(
      `[SiteSessionQuarantine] The marker of "${siteId}" could not be removed: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
  }
}
