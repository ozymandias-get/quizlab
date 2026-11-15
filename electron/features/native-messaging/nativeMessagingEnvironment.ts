import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import type { QuizlabEnvironment } from '../../../shared/constants/extensionRelease.js'
import { Logger } from '../../core/logger.js'

/**
 * Which of the two Quizlab applications is running.
 *
 * The packaged app and the `npm run dev` app are the same build system with two
 * different life cycles: an installed EXE is production, a checkout started by
 * the dev script is development. The value is not a user setting: it follows the
 * process the user started, so both apps can run at once without anyone having
 * to pick a side.
 */
export function resolveBridgeEnvironment(): QuizlabEnvironment {
  return app.isPackaged ? 'prod' : 'dev'
}

/**
 * The file that records which environment owns a user data folder.
 *
 * The default folders of the two apps are different (`Quizlab Reader` and
 * `Quizlab Reader Dev`), so this file only ever matters when the user points
 * both builds at one folder with `QUIZLAB_PROFILE` or `QUIZLAB_USER_DATA_DIR`.
 * In that case the pairing secret, the Chrome profile selection and the installed
 * extension folder would be shared, which is exactly the mixing this feature
 * exists to prevent. The first build that opens the folder claims it; the other
 * one refuses to start the bridge instead of silently pairing against data that
 * belongs to the other environment.
 */
export const BRIDGE_ENVIRONMENT_FILE = 'bridge-environment.json'

export interface BridgeEnvironmentClaim {
  /** Whether the running environment may use the folder. */
  ok: boolean
  /** The environment that claimed the folder, when it was another one. */
  owner?: QuizlabEnvironment
}

function parseOwner(raw: string): QuizlabEnvironment | null {
  try {
    const parsed = JSON.parse(raw) as { environment?: unknown }
    if (parsed?.environment === 'dev' || parsed?.environment === 'prod') {
      return parsed.environment
    }
    return null
  } catch {
    return null
  }
}

function markerContent(environment: QuizlabEnvironment): string {
  return JSON.stringify({ environment }, null, 2)
}

function temporaryMarkerPath(markerPath: string): string {
  return `${markerPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
}

type MarkerRead =
  | { kind: 'ok'; owner: QuizlabEnvironment | null }
  | { kind: 'missing' }
  | { kind: 'error'; error: unknown }

async function readMarker(markerPath: string): Promise<MarkerRead> {
  try {
    const raw = await fs.readFile(markerPath, 'utf-8')
    return { kind: 'ok', owner: parseOwner(raw) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' }
    return { kind: 'error', error }
  }
}

/**
 * Writes the marker through a temporary file and renames it into place.
 *
 * This is the fallback for a volume that cannot create a hard link. The
 * content is complete before the rename, so even this path cannot leave a
 * half-written marker behind.
 */
async function replaceMarker(
  environment: QuizlabEnvironment,
  markerPath: string
): Promise<BridgeEnvironmentClaim> {
  const temporary = temporaryMarkerPath(markerPath)
  try {
    await fs.writeFile(temporary, markerContent(environment), { encoding: 'utf-8', mode: 0o600 })
    await fs.rename(temporary, markerPath)
    return { ok: true }
  } catch (error) {
    Logger.warn('[NativeMessaging] The bridge environment marker could not be written:', error)
    return { ok: false }
  } finally {
    await fs.unlink(temporary).catch(() => {})
  }
}

/**
 * Creates the marker only if no other process created it first.
 *
 * `writeFile` plus `link` is the portable version of "create exclusively":
 * the temp file already holds the full content, and the link is a single
 * atomic directory operation. Two environments that start at the same moment
 * therefore cannot both observe a missing marker and both write themselves as
 * the owner; the loser sees `EEXIST` and reads the winner's marker.
 */
async function createMarkerExclusively(
  environment: QuizlabEnvironment,
  userDataPath: string,
  markerPath: string
): Promise<BridgeEnvironmentClaim> {
  const temporary = temporaryMarkerPath(markerPath)
  try {
    await fs.mkdir(userDataPath, { recursive: true })
    await fs.writeFile(temporary, markerContent(environment), { encoding: 'utf-8', mode: 0o600 })
    try {
      await fs.link(temporary, markerPath)
      return { ok: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        const existing = await readMarker(markerPath)
        if (existing.kind === 'ok' && existing.owner) {
          return existing.owner === environment
            ? { ok: true }
            : { ok: false, owner: existing.owner }
        }
        // A file that exists but cannot be read as an owner is not a claim we
        // can safely share. Fail closed instead of overwriting another
        // environment's marker in the middle of its start.
        return { ok: false }
      }
      // Some filesystems do not support hard links. The atomic rename still
      // produces a complete marker, so fall back to it rather than disabling
      // the bridge on those volumes.
      return replaceMarker(environment, markerPath)
    }
  } catch (error) {
    Logger.warn('[NativeMessaging] The bridge environment marker could not be written:', error)
    return { ok: false }
  } finally {
    await fs.unlink(temporary).catch(() => {})
  }
}

/**
 * Claims a user data folder for one environment, or reports its real owner.
 *
 * A missing marker is claimed atomically. A marker that cannot be read, or
 * exists but does not name an owner, fails closed: treating it as "free" could
 * hand this environment's data to the other build. A readable marker of the
 * other environment is a hard stop too.
 */
export async function claimBridgeEnvironment(
  environment: QuizlabEnvironment,
  userDataPath: string = app.getPath('userData')
): Promise<BridgeEnvironmentClaim> {
  const markerPath = path.join(userDataPath, BRIDGE_ENVIRONMENT_FILE)
  const existing = await readMarker(markerPath)

  if (existing.kind === 'ok') {
    if (existing.owner && existing.owner !== environment)
      return { ok: false, owner: existing.owner }
    if (existing.owner === environment) return { ok: true }
    // The file exists but does not name an owner. Claiming it could hand a
    // folder that belongs to the other build to this one if the file is the
    // remains of a torn write, so fail closed. Atomic writes above mean the
    // app itself no longer produces this state.
    Logger.warn(
      `[NativeMessaging] The bridge environment marker is not readable as an owner; ` +
        `refusing to claim ${markerPath}.`
    )
    return { ok: false }
  }

  if (existing.kind === 'error') {
    // A marker we cannot read is not proof that the folder is free. Continuing
    // could hand the other environment's secret and profile selection to this
    // build; the bridge reports an error instead.
    Logger.warn(
      '[NativeMessaging] The bridge environment marker could not be read; refusing the folder:',
      existing.error
    )
    return { ok: false }
  }

  return createMarkerExclusively(environment, userDataPath, markerPath)
}
