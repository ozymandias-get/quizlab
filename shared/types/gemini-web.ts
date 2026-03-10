/**
 * Gemini Web Session Types
 */

export type GeminiWebSessionState =
  | 'uninitialized'
  | 'auth_required'
  | 'authenticated'
  | 'degraded'
  | 'reauth_required'

export type GeminiWebSessionReasonCode =
  | 'none'
  | 'login_redirect'
  | 'challenge'
  | 'network'
  | 'unknown'
  | 'reset_profile_required'

export interface GeminiWebSessionStatus {
  state: GeminiWebSessionState
  lastHealthyAt: string | null
  lastCheckAt: string | null
  consecutiveFailures: number
  reasonCode: GeminiWebSessionReasonCode
  featureEnabled: boolean
  enabled: boolean
  enabledAppIds: string[]
}

export interface GeminiWebSessionConfig {
  profileDir: string
  checkIntervalMs: number
  jitterPct: number
  retryDelayMs: number
  maxConsecutiveFailures: number
}

export type GeminiWebSessionActionResult = {
  success: boolean
  error?: string
  status?: GeminiWebSessionStatus
}
