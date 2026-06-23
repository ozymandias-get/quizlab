import type { GeminiWebSessionConfig } from '@shared-core/types'

import { app, type Session, session as electronSession } from 'electron'
import path from 'path'

import { DEFAULT_CONFIG } from './sessionConfig'

export interface GeminiSessionPaths {
  profileDir: string
  configPath: string
  lockPath: string
  storageStateSnapshotPath: string
}

export function createGeminiSessionPaths(): GeminiSessionPaths {
  const userDataPath = app.getPath('userData')
  const profileDir = path.join(userDataPath, 'gemini-web-profile')
  const configPath = path.join(userDataPath, 'gemini-web-session.json')
  const lockPath = path.join(profileDir, '.profile.lock')
  const storageStateSnapshotPath = path.join(profileDir, 'storage-state-snapshot.json')
  return { profileDir, configPath, lockPath, storageStateSnapshotPath }
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
