import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'

import type { Session } from 'electron'

import { Logger } from '../../core/logger.js'
import type { ProfileLock } from './profileLock.js'
import { toErrorMessage } from './sessionErrors.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository.js'
import { nowIso } from './sessionUtils.js'

export interface LoginFlowContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  config: GeminiWebSessionConfig
  resolvePersistentSession: () => Session
  initialize: () => Promise<void>
  getStatus: () => Promise<GeminiWebSessionStatus>
  snapshotRepository: SessionSnapshotRepository | null
  getAbortSignal: () => AbortSignal
}

export class LoginFlowPolicy {
  constructor(private context: LoginFlowContext) {}

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    const {
      initialize,
      metadataRepository,
      profileLock,
      resolvePersistentSession,
      getStatus,
      snapshotRepository
    } = this.context
    await initialize()
    const current = await metadataRepository.readMetadata()
    const blocked = metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked

    const lock = await profileLock.acquire()
    if (!lock.ok) {
      return {
        success: false,
        error: lock.error || 'already_in_use',
        status: await getStatus()
      }
    }

    try {
      const targetSession = resolvePersistentSession()
      const cookies = await targetSession.cookies.get({}).catch(() => [])

      if (cookies.length > 0) {
        const freshSnapshot = { cookies, origins: [] }
        await snapshotRepository?.writeStorageStateSnapshot(freshSnapshot).catch(() => {})
        const metadata = await metadataRepository.readMetadata()
        const status = await metadataRepository.writeStatus(
          { ...metadata, state: 'authenticated' },
          metadata.accountHash
        )
        return { success: true, status }
      }

      const metadata = await metadataRepository.readMetadata()
      const status = await metadataRepository.writeStatus(
        { ...metadata, state: 'auth_required' },
        metadata.accountHash
      )
      return { success: false, error: 'error_login_verification_failed', status }
    } catch (error: unknown) {
      const status = await getStatus()
      Logger.error('[GeminiWebSession] Login failed:', toErrorMessage(error, 'unknown_error'))
      return { success: false, error: 'error_login_failed', status }
    } finally {
      await profileLock.release()
    }
  }

  async reauthenticate(): Promise<GeminiWebSessionActionResult> {
    const { initialize, metadataRepository } = this.context
    await initialize()
    const current = await metadataRepository.readMetadata()
    const blocked = metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked
    await metadataRepository.writeStatus(
      { ...current, state: 'auth_required', reasonCode: 'login_redirect' },
      current.accountHash
    )
    return this.openLogin()
  }
}
