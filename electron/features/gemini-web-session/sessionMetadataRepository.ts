import { ConfigManager } from '../../core/ConfigManager'
import type { GeminiWebSessionStatus } from '@shared-core/types'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/google-ai-web-apps'
import { DEFAULT_USER_ENABLED, FEATURE_ENABLED, isReasonCode, isSessionState } from './sessionConfig'
import { createDefaultStatus } from './stateMachine'
import type { DisabledActionResult, SessionMetadata } from './sessionContracts'

export function sanitizeEnabledAppIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

  const validIds = new Set(GOOGLE_WEB_SESSION_REGISTRY_IDS)
  const seenIds = new Set<string>()
  const sanitized: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    if (!validIds.has(item as (typeof GOOGLE_WEB_SESSION_REGISTRY_IDS)[number])) continue
    if (seenIds.has(item)) continue
    seenIds.add(item)
    sanitized.push(item)
  }

  return sanitized
}

export class SessionMetadataRepository {
  private readonly metadataManager: ConfigManager<SessionMetadata>

  constructor(configPath: string) {
    this.metadataManager = new ConfigManager<SessionMetadata>(configPath)
  }

  async ensureMetadata(): Promise<void> {
    const metadata = await this.readMetadata()
    await this.metadataManager.write(metadata)
  }

  async readMetadata(): Promise<SessionMetadata> {
    const raw = await this.metadataManager.read()
    const fallback = createDefaultStatus(
      FEATURE_ENABLED,
      FEATURE_ENABLED ? DEFAULT_USER_ENABLED : false
    )
    return {
      accountHash: typeof raw.accountHash === 'string' ? raw.accountHash : null,
      state:
        typeof raw.state === 'string' && isSessionState(raw.state) ? raw.state : fallback.state,
      lastHealthyAt: typeof raw.lastHealthyAt === 'string' ? raw.lastHealthyAt : null,
      lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
      consecutiveFailures: Number.isFinite(raw.consecutiveFailures) ? Number(raw.consecutiveFailures) : 0,
      reasonCode:
        typeof raw.reasonCode === 'string' && isReasonCode(raw.reasonCode)
          ? raw.reasonCode
          : fallback.reasonCode,
      featureEnabled: FEATURE_ENABLED,
      enabled:
        typeof raw.enabled === 'boolean'
          ? FEATURE_ENABLED
            ? raw.enabled
            : false
          : fallback.enabled,
      enabledAppIds: sanitizeEnabledAppIds(raw.enabledAppIds)
    }
  }

  async writeStatus(
    status: GeminiWebSessionStatus,
    accountHash: string | null
  ): Promise<GeminiWebSessionStatus> {
    const nextMetadata: SessionMetadata = {
      ...status,
      accountHash
    }
    await this.metadataManager.write(nextMetadata)
    return this.toPublicStatus(nextMetadata)
  }

  toPublicStatus(metadata: SessionMetadata): GeminiWebSessionStatus {
    return {
      state: metadata.state,
      lastHealthyAt: metadata.lastHealthyAt,
      lastCheckAt: metadata.lastCheckAt,
      consecutiveFailures: metadata.consecutiveFailures,
      reasonCode: metadata.reasonCode,
      featureEnabled: FEATURE_ENABLED,
      enabled: metadata.enabled,
      enabledAppIds: metadata.enabledAppIds
    }
  }

  getDisabledActionResult(current: SessionMetadata): DisabledActionResult | null {
    if (!FEATURE_ENABLED) {
      return {
        success: false,
        error: 'feature_disabled',
        status: this.toPublicStatus(current)
      }
    }

    if (!current.enabled) {
      return {
        success: false,
        error: 'error_gws_disabled',
        status: this.toPublicStatus(current)
      }
    }

    return null
  }
}
