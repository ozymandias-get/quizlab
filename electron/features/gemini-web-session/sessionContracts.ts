import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionStatus
} from '@shared-core/types'
import type { ProbeOutcome } from './stateMachine'

export interface SessionMetadata extends GeminiWebSessionStatus {
  accountHash: string | null
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

export interface RefreshExecutionResult {
  success: boolean
  error?: string
  probe?: ProbeExecutionResult
}

export interface CookieExpiryCheckResult {
  hasRelevantCookies: boolean
  hasExpiredCookie: boolean
  shouldRefresh: boolean
  earliestExpiry: number | null
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
