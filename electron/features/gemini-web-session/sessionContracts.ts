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
  probe?: ProbeExecutionResult
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
}
