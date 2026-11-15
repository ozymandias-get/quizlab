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

/**
 * Claims a user data folder for one environment, or reports its real owner.
 *
 * A missing or unreadable marker is claimed by the running environment: refusing
 * to start on a file this feature itself could not read would break the bridge
 * for a reason the user cannot act on. A readable marker of the other
 * environment is a hard stop, because the data in the folder is not ours.
 */
export async function claimBridgeEnvironment(
  environment: QuizlabEnvironment,
  userDataPath: string = app.getPath('userData')
): Promise<BridgeEnvironmentClaim> {
  const markerPath = path.join(userDataPath, BRIDGE_ENVIRONMENT_FILE)

  let raw: string | null = null
  try {
    raw = await fs.readFile(markerPath, 'utf-8')
  } catch {
    raw = null
  }

  if (raw !== null) {
    const owner = parseOwner(raw)
    if (owner && owner !== environment) return { ok: false, owner }
    if (owner === environment) return { ok: true }
  }

  try {
    await fs.mkdir(userDataPath, { recursive: true })
    await fs.writeFile(markerPath, JSON.stringify({ environment }, null, 2), 'utf-8')
  } catch (error) {
    // The guard is best effort: a folder that cannot be written to will fail the
    // bridge later anyway, and the next start checks the marker again.
    Logger.warn('[NativeMessaging] The bridge environment marker could not be written:', error)
  }
  return { ok: true }
}
