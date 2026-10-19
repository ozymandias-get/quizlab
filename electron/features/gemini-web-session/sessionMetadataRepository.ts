import type { GeminiWebSessionStatus } from '@shared-core/types'

import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/googleAiWebApps.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import {
  DEFAULT_USER_ENABLED,
  FEATURE_ENABLED,
  isReasonCode,
  isSessionState
} from './sessionConfig.js'
import type { DisabledActionResult, SessionMetadata } from './sessionContracts.js'
import { createDefaultStatus } from './stateMachine.js'

const VALID_WEB_SESSION_APP_IDS = new Set<string>(GOOGLE_WEB_SESSION_REGISTRY_IDS)

export function sanitizeEnabledAppIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

  const seenIds = new Set<string>()
  const sanitized: string[] = []

  for (const id of value) {
    if (typeof id !== 'string') continue
    if (!VALID_WEB_SESSION_APP_IDS.has(id)) continue
    if (seenIds.has(id)) continue
    seenIds.add(id)
    sanitized.push(id)
  }

  return sanitized
}

/**
 * Brings a raw metadata record into the shape the rest of the feature expects.
 *
 * Every value that reaches a caller goes through here, so the guarantee that
 * `state` is a real session state, `reasonCode` a real reason code and
 * `enabledAppIds` a list of known app ids belongs to the repository rather
 * than to whoever happens to hand the repository a record.
 */
function normalizeMetadata(raw: SessionMetadata): SessionMetadata {
  const fallback = createDefaultStatus(
    FEATURE_ENABLED,
    FEATURE_ENABLED ? DEFAULT_USER_ENABLED : false
  )
  return {
    accountHash: typeof raw.accountHash === 'string' ? raw.accountHash : null,
    state: typeof raw.state === 'string' && isSessionState(raw.state) ? raw.state : fallback.state,
    lastHealthyAt: typeof raw.lastHealthyAt === 'string' ? raw.lastHealthyAt : null,
    lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
    consecutiveFailures: Number.isFinite(raw.consecutiveFailures)
      ? Number(raw.consecutiveFailures)
      : 0,
    lastSilentRefreshAttemptAt: Number.isFinite(raw.lastSilentRefreshAttemptAt)
      ? Number(raw.lastSilentRefreshAttemptAt)
      : 0,
    reasonCode:
      typeof raw.reasonCode === 'string' && isReasonCode(raw.reasonCode)
        ? raw.reasonCode
        : fallback.reasonCode,
    featureEnabled: FEATURE_ENABLED,
    enabled:
      typeof raw.enabled === 'boolean' ? (FEATURE_ENABLED ? raw.enabled : false) : fallback.enabled,
    enabledAppIds: sanitizeEnabledAppIds(raw.enabledAppIds)
  }
}

export class SessionMetadataRepository {
  private readonly metadataManager: ConfigManager<SessionMetadata>
  private lastRawRef: SessionMetadata | null = null
  private lastNormalized: SessionMetadata | null = null

  constructor(configPath: string) {
    this.metadataManager = new ConfigManager<SessionMetadata>(configPath)
  }

  async ensureMetadata(): Promise<void> {
    const metadata = await this.readMetadata()
    await this.metadataManager.write(metadata)
    this.lastRawRef = metadata
    this.lastNormalized = metadata
  }

  async readMetadata(): Promise<SessionMetadata> {
    const raw = await this.metadataManager.read()
    if (this.lastRawRef === raw && this.lastNormalized !== null) {
      return {
        ...this.lastNormalized,
        enabledAppIds: [...this.lastNormalized.enabledAppIds]
      }
    }
    const normalized = normalizeMetadata(raw)
    this.lastRawRef = raw
    this.lastNormalized = normalized
    return {
      ...normalized,
      enabledAppIds: [...normalized.enabledAppIds]
    }
  }

  async writeStatus(
    status: GeminiWebSessionStatus,
    accountHash: string | null,
    cooldowns?: { lastSilentRefreshAttemptAt?: number }
  ): Promise<GeminiWebSessionStatus> {
    const current =
      cooldowns?.lastSilentRefreshAttemptAt !== undefined ? null : await this.readMetadata()
    const nextMetadata: SessionMetadata = {
      ...status,
      accountHash,
      lastSilentRefreshAttemptAt:
        cooldowns?.lastSilentRefreshAttemptAt ?? current?.lastSilentRefreshAttemptAt ?? 0
    }
    // The cache may only ever hold normalized metadata: `readMetadata`
    // short-circuits on the raw reference, so seeding the cache with the
    // caller's record would hand that record back un-normalized.
    const normalized = normalizeMetadata(nextMetadata)
    await this.metadataManager.write(nextMetadata)
    this.lastRawRef = nextMetadata
    this.lastNormalized = normalized
    return this.toPublicStatus(normalized)
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
