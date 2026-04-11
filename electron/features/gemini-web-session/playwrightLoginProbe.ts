import type { DomProbeSnapshot } from './authHeuristics'
import type { ExternalBrowserCookie } from './playwrightCookieMapping'
import type { PlaywrightLoginResult } from './playwrightLoginTypes'
import { UNKNOWN_OUTCOME } from './playwrightLoginTypes'
import type { ProbeOutcome } from './stateMachine'
import { computeGoogleAccountHash } from './sessionUtils'
import { EMPTY_DOM_SNAPSHOT } from './constants'

export const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com'

export function buildFailureResult(
  error: string,
  outcome: ProbeOutcome = UNKNOWN_OUTCOME,
  timedOut: boolean = false
): PlaywrightLoginResult {
  return {
    success: false,
    timedOut,
    outcome,
    cookies: [],
    accountHash: null,
    error
  }
}

export function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function mapProbeError(outcome: ProbeOutcome, timedOut: boolean): string {
  if (timedOut) return 'error_login_timeout'
  if (outcome.kind === 'challenge') return 'error_challenge_required'
  if (outcome.kind === 'network') return 'error_network_login_failed'
  if (outcome.kind === 'login_redirect') return 'error_login_verification_failed'
  return 'error_login_failed'
}

export function mapHeadlessRefreshFailure(
  snapshot: { hasLoginForm: boolean; hasChallengeText: boolean },
  outcome: ProbeOutcome,
  timedOut: boolean
): string {
  if (snapshot.hasLoginForm || snapshot.hasChallengeText || outcome.kind === 'challenge') {
    return 'error_refresh_failed_requires_login'
  }
  return mapProbeError(outcome, timedOut)
}

export function hasCompletedGoogleLogin(
  currentUrl: string,
  snapshot: { hasLoginForm: boolean; hasSignInText: boolean; hasChallengeText: boolean },
  cookies: ExternalBrowserCookie[],
  outcome: ProbeOutcome,
  hasExitedAccountsHost: boolean
): boolean {
  const hostname = getHostname(currentUrl)
  if (!hostname) return false
  if (snapshot.hasLoginForm || snapshot.hasChallengeText) return false

  const hasSessionCookies = computeGoogleAccountHash(cookies) !== null
  if (!hasSessionCookies) return false

  if (hasExitedAccountsHost && hostname !== GOOGLE_ACCOUNTS_HOST) return true
  return outcome.healthy && hostname !== GOOGLE_ACCOUNTS_HOST && !snapshot.hasSignInText
}

export function asDomProbeSnapshot(value: unknown): DomProbeSnapshot {
  return (value ?? EMPTY_DOM_SNAPSHOT) as DomProbeSnapshot
}
