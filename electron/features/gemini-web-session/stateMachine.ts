import type {
  GeminiWebSessionReasonCode,
  GeminiWebSessionState,
  GeminiWebSessionStatus
} from '@shared-core/types'

export type ProbeKind = 'authenticated' | 'login_redirect' | 'challenge' | 'network' | 'unknown'

export interface ProbeOutcome {
  kind: ProbeKind
  healthy: boolean
}

interface TransitionInput {
  previous: GeminiWebSessionStatus
  outcome: ProbeOutcome
  timestamp: string
  maxConsecutiveFailures: number
}

export function createDefaultStatus(
  featureEnabled: boolean,
  enabled: boolean = featureEnabled
): GeminiWebSessionStatus {
  return {
    state: 'uninitialized',
    lastHealthyAt: null,
    lastCheckAt: null,
    consecutiveFailures: 0,
    reasonCode: 'none',
    featureEnabled,
    enabled,
    enabledAppIds: []
  }
}

function reasonFromProbeKind(kind: ProbeKind): GeminiWebSessionReasonCode {
  if (kind === 'authenticated') return 'none'
  if (kind === 'login_redirect') return 'login_redirect'
  if (kind === 'challenge') return 'challenge'
  if (kind === 'network') return 'network'
  return 'unknown'
}

function stateForFailure(
  kind: ProbeKind,
  failureCount: number,
  maxConsecutiveFailures: number
): GeminiWebSessionState {
  // Challenge-like responses should block immediately.
  if (kind === 'challenge') return 'reauth_required'

  // Network failures are treated as degraded (retry path), not forced reauth.
  if (kind === 'network') return 'degraded'

  if (failureCount >= maxConsecutiveFailures) return 'reauth_required'
  return 'degraded'
}

export function applyProbeTransition({
  previous,
  outcome,
  timestamp,
  maxConsecutiveFailures
}: TransitionInput): GeminiWebSessionStatus {
  const nextFailures = outcome.healthy ? 0 : previous.consecutiveFailures + 1

  if (outcome.healthy) {
    return {
      ...previous,
      state: 'authenticated',
      lastHealthyAt: timestamp,
      lastCheckAt: timestamp,
      consecutiveFailures: 0,
      reasonCode: 'none'
    }
  }

  return {
    ...previous,
    state: stateForFailure(outcome.kind, nextFailures, maxConsecutiveFailures),
    lastCheckAt: timestamp,
    consecutiveFailures: nextFailures,
    reasonCode: reasonFromProbeKind(outcome.kind)
  }
}
