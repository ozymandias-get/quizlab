import type { HealthCheckResult, SessionActionLike } from '@shared-core/types'

import { toStrictBoolean } from '../../core/ipcPayloadGuards.js'
import { FEATURE_ENABLED } from './sessionConfig.js'
import { logSuppressedError } from './sessionErrors.js'
import {
  sanitizeEnabledAppIds,
  type SessionMetadataRepository
} from './sessionMetadataRepository.js'
import type { SessionMonitor } from './sessionMonitor.js'
import { nowIso } from './sessionUtils.js'

export interface MetadataUpdateContext {
  metadataRepository: SessionMetadataRepository
  monitor: SessionMonitor
  initialize: () => Promise<void>
  scheduleMonitor: () => void
  performHealthCheck: () => Promise<HealthCheckResult>
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

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Serialized write timeout')),
        WRITE_TIMEOUT_MS
      )
      // A pending timer must not hold the event loop open once the lock is idle.
      timeoutHandle.unref?.()
    })

    const withTimeout = async (): Promise<T> => {
      try {
        return await Promise.race([fn(), timeoutPromise])
      } finally {
        // Without this the 30s timer stayed armed after every settled write,
        // pinning its closure (and rejecting into an already-settled race) for
        // the full timeout window on each setEnabled/setEnabledApps call.
        clearTimeout(timeoutHandle)
      }
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
        void performHealthCheck().catch((error) => {
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
