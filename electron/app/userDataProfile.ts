import { app } from 'electron'
import path from 'path'

const DEFAULT_STABLE_NAME = 'Quizlab Reader'
const DEFAULT_DEV_NAME = 'Quizlab Reader Dev'

let profileName: string | null = null

export function resolveUserDataProfile(): void {
  if (profileName !== null) return

  const envProfile = process.env.QUIZLAB_PROFILE?.trim()
  const envUserDataDir = process.env.QUIZLAB_USER_DATA_DIR?.trim()

  if (envUserDataDir) {
    const resolved = path.resolve(envUserDataDir)
    app.setPath('userData', resolved)
    profileName = envProfile || 'custom'
    return
  }

  const isDev = !app.isPackaged

  if (envProfile) {
    profileName = envProfile
  } else {
    profileName = isDev ? 'dev' : 'stable'
  }

  const appData = app.getPath('appData')

  if (profileName === 'stable') {
    app.setPath('userData', path.join(appData, DEFAULT_STABLE_NAME))
  } else if (profileName === 'dev') {
    app.setPath('userData', path.join(appData, DEFAULT_DEV_NAME))
  } else {
    app.setPath('userData', path.join(appData, `Quizlab Reader ${profileName}`))
  }
}

export function getProfileName(): string {
  if (!profileName) {
    throw new Error('userDataProfile not resolved yet. Call resolveUserDataProfile() first.')
  }
  return profileName
}

export function assertUserDataProfileInitialized(): void {
  if (!profileName) {
    throw new Error(
      '[UserDataProfile] App userData accessed before profile initialization. Call resolveUserDataProfile() first.'
    )
  }
  const userData = app.getPath('userData')
  const base = path.basename(userData)
  // Invariant: Quizlab userData must never be the default Electron profile
  if (base === 'Electron') {
    throw new Error(
      `[UserDataProfile] Invariant violation: userData is default Electron profile (${userData}). ` +
        'This would cause 2.5GB duplication under Roaming/Electron. Ensure resolveUserDataProfile() is called before any component initialization.'
    )
  }
  const allowed = new Set([DEFAULT_STABLE_NAME, DEFAULT_DEV_NAME])
  // Custom profiles (Quizlab Reader <name>) are allowed via QUIZLAB_PROFILE; also allow temp test dirs
  const isTempTest =
    userData.includes('quizlab-test') ||
    userData.includes('mock-userData') ||
    userData.startsWith('/tmp') ||
    userData.startsWith('/mock')
  if (!allowed.has(base) && !base.startsWith('Quizlab Reader ') && !isTempTest) {
    // Not strictly blocking, but warn — still throw in strict mode to prevent silent duplication
    // For production we throw to fail-fast rather than silently duplicating 2.5GB
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      throw new Error(`[UserDataProfile] Unexpected userData basename: ${base} (${userData})`)
    }
  }
}

export function isDefaultElectronProfile(): boolean {
  try {
    return path.basename(app.getPath('userData')) === 'Electron'
  } catch {
    return false
  }
}
