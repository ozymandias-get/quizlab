import { app, session as electronSession, type Session } from 'electron'
import path from 'path'
import type { GeminiWebSessionConfig } from '@shared-core/types'
import { DEFAULT_CONFIG } from './sessionConfig'

export interface GeminiSessionPaths {
  profileDir: string
  playwrightProfileDir: string
  configPath: string
  lockPath: string
}

export function createGeminiSessionPaths(): GeminiSessionPaths {
  const userDataPath = app.getPath('userData')
  const profileDir = path.join(userDataPath, 'gemini-web-profile')
  const playwrightProfileDir = path.join(userDataPath, 'gemini-web-login-browser')
  const configPath = path.join(userDataPath, 'gemini-web-session.json')
  const lockPath = path.join(profileDir, '.profile.lock')
  return { profileDir, playwrightProfileDir, configPath, lockPath }
}

export function createGeminiSessionConfig(profileDir: string): GeminiWebSessionConfig {
  return {
    profileDir,
    ...DEFAULT_CONFIG
  }
}

export function resolvePersistentSession(partition: string): Session {
  return electronSession.fromPartition(partition)
}
