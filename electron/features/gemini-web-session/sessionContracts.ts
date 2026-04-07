import type { GeminiWebSessionActionResult, GeminiWebSessionStatus } from '@shared-core/types'
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

export type DisabledActionResult = GeminiWebSessionActionResult & {
  success: false
  error: string
  status: GeminiWebSessionStatus
}
