import { toStrictBoolean } from '../../core/ipcPayloadGuards'
import { nowIso } from './sessionUtils'
import { FEATURE_ENABLED } from './sessionConfig'
import { sanitizeEnabledAppIds, type SessionMetadataRepository } from './sessionMetadataRepository'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import type { SessionMonitor } from './sessionMonitor'

export interface MetadataUpdateContext {
  metadataRepository: SessionMetadataRepository
  monitor: SessionMonitor
  initialize: () => Promise<void>
  scheduleMonitor: () => void
  performHealthCheck: (options: { allowRetry: boolean }) => Promise<any>
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

function logSuppressedError(context: string, error: unknown): void {
  console.warn(`[GeminiWebSession] ${context}:`, toErrorMessage(error, 'unknown_error'))
}

export class MetadataUpdatePolicy {
  constructor(private context: MetadataUpdateContext) {}

  async setEnabled(enabled: unknown): Promise<GeminiWebSessionActionResult> {
    const { initialize, metadataRepository, monitor, scheduleMonitor, performHealthCheck } =
      this.context
    await initialize()
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
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
    const { initialize, metadataRepository } = this.context
    await initialize()
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
  }
}
