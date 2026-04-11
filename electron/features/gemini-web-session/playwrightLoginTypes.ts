import type { ExternalBrowserCookie } from './playwrightCookieMapping'
import type { ProbeOutcome } from './stateMachine'

export const UNKNOWN_OUTCOME: ProbeOutcome = { kind: 'unknown', healthy: false }

export interface PlaywrightLoginResult {
  success: boolean
  outcome: ProbeOutcome
  timedOut: boolean
  cookies: ExternalBrowserCookie[]
  accountHash: string | null
  error?: string
}

export interface LoginOptions {
  profileDir: string
  timeoutMs: number
}

export interface SessionFlowOptions extends LoginOptions {
  headless: boolean
  successStreakTarget: number
  initialUrl: string
}
