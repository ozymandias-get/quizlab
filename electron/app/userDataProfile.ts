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
