import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionStatus
} from '@shared-core/types'

import type { ProbeOutcome } from './stateMachine.js'

export interface SessionMetadata extends GeminiWebSessionStatus {
  accountHash: string | null
  lastSilentRefreshAttemptAt?: number
}

export interface ProbeExecutionResult {
  outcome: ProbeOutcome
  accountHash: string | null
  timedOut: boolean
}

export interface LockResult {
  ok: boolean
  error?: string
}

interface RefreshExecutionResult {
  success: boolean
  error?: string
}

export interface CookieExpiryCheckResult {
  hasRelevantCookies: boolean
  hasExpiredCookie: boolean
  shouldRefresh: boolean
  earliestExpiry: number | null
  relevantCookieCount?: number
  sessionCookieCount?: number
  proactiveRefreshDue?: boolean
}

export interface ReactiveRefreshSignal {
  reason: GeminiWebSessionRefreshReason
  url?: string
  statusCode?: number
}

export type RefreshEventEmitter = (event: GeminiWebSessionRefreshEvent) => void

export type DisabledActionResult = GeminiWebSessionActionResult & {
  success: false
  error: string
  status: GeminiWebSessionStatus
}

export interface SessionExportDataV1 {
  version: 1
  exportedAt: string
  storageState: unknown | null
  accountHash: string | null
  metadata: {
    state: GeminiWebSessionStatus['state']
    reasonCode: GeminiWebSessionStatus['reasonCode']
    lastHealthyAt: string | null
  }
}

export interface SessionExportDataV2 {
  version: 2
  exportedAt: string
  /** Base64-encoded safeStorage-encrypted blob of the original JSON. */
  encrypted: string
}

export type SessionExportData = SessionExportDataV1 | SessionExportDataV2

export interface SessionImportResult {
  success: boolean
  error?: string
  status?: GeminiWebSessionStatus
  /**
   * Set when the import succeeded but the source file deserves a caveat,
   * e.g. `imported_unencrypted_legacy_file` for a pre-encryption v1 export.
   * The UI should surface it instead of implying the file was encrypted.
   */
  warning?: string
  /**
   * User-facing explanation when the import was refused because the system
   * cannot protect the session material.
   */
  detail?: string
}

export interface SessionExportResult {
  success: boolean
  error?: string
  /**
   * User-facing explanation for a refusal. Present when the export was
   * declined because the system cannot protect the session material, so the
   * reason is never just a bare error code.
   */
  detail?: string
}
