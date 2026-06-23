import type { HealthCheckResult, SessionActionLike } from '@shared-core/types'

import { toStrictBoolean } from '../../core/ipcPayloadGuards'
import { FEATURE_ENABLED } from './sessionConfig'
import { logSuppressedError } from './sessionErrors'
import { sanitizeEnabledAppIds, type SessionMetadataRepository } from './sessionMetadataRepository'
import type { SessionMonitor } from './sessionMonitor'
import { nowIso } from './sessionUtils'

export interface MetadataUpdateContext {
  metadataRepository: SessionMetadataRepository
  monitor: SessionMonitor
  initialize: () => Promise<void>
  scheduleMonitor: () => void
  performHealthCheck: (options: { allowRetry: boolean }) => Promise<HealthCheckResult>
}

export class MetadataUpdatePolicy {
  constructor(private context: MetadataUpdateContext) {}

  /**
   * Serializes write operations to prevent the read-modify-write race:
   *
   *   Thread A reads metadata → Thread B reads metadata (stale copy) →
   *   Thread A writes → Thread B writes (overwrites A's changes)
   *
   * Each enqueued operation acquires the lock, performs its read+write,
   * then releases.  Rapid calls are serialized so each sees the previous
   * write's result.
   */
  private writeLock: Promise<void> = Promise.resolve()

  private async serializedWrite<T>(fn: () => Promise<T>): Promise<T> {
    const WRITE_TIMEOUT_MS = 30_000

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Serialized write timeout')), WRITE_TIMEOUT_MS)
    )

    const withTimeout = async (): Promise<T> => {
      const result = await Promise.race([fn(), timeoutPromise])
      return result
    }

    const next = this.writeLock.then(withTimeout, withTimeout)
    this.writeLock = next.then(
      () => {},
      () => {}
    )
    return next
  }

  async setEnabled(enabled: unknown): Promise<SessionActionLike> {
    const { initialize, metadataRepository, monitor, scheduleMonitor, performHealthCheck } =
      this.context
    await initialize()
    const result = await this.serializedWrite(async () => {
      const current = await metadataRepository.readMetadata()
      const nextEnabled = FEATURE_ENABLED ? toStrictBoolean(enabled) : false
      const status = await metadataRepository.writeStatus(
        {
          ...current,
          enabled: nextEnabled,
          featureEnabled: FEATURE_ENABLED,
          lastCheckAt: nowIso()
        },
        current.accountHash
      )
      if (!nextEnabled) {
        monitor.stop()
      }
      if (nextEnabled) {
        scheduleMonitor()
        void performHealthCheck({ allowRetry: false }).catch((error) => {
          logSuppressedError('setEnabled health check failed', error)
        })
      }
      return { success: true, status }
    })
    return result
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<SessionActionLike> {
    const { initialize, metadataRepository } = this.context
    await initialize()
    const result = await this.serializedWrite(async () => {
      const current = await metadataRepository.readMetadata()
      const status = await metadataRepository.writeStatus(
        {
          ...current,
          enabledAppIds: sanitizeEnabledAppIds(enabledAppIds),
          lastCheckAt: nowIso()
        },
        current.accountHash
      )
      return { success: true, status }
    })
    return result
  }
}
