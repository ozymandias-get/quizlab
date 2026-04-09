import type { ProbeOutcome, ProbeKind } from './stateMachine'
import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/google-ai-web-apps'

const CHALLENGE_HOSTS = new Set(['challenge.google.com', 'sorry.google.com'])

const LOGIN_HOSTS = new Set(['accounts.google.com'])
const LOGIN_PATH_REGEX =
  /^\/(servicelogin|v3\/signin(?:\/|$)|checkcookie(?:\/|$)|interactivelogin(?:\/|$))/i

const APP_HOSTS = new Set(GOOGLE_AI_WEB_APPS.map((app) => app.hostname))
const APP_BY_HOST = new Map(GOOGLE_AI_WEB_APPS.map((app) => [app.hostname, app]))

export interface DomProbeSnapshot {
  hasLoginForm: boolean
  hasComposer: boolean
  hasChallengeText: boolean
  hasSignInText: boolean
}

function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function getPathname(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.toLowerCase()
  } catch {
    return ''
  }
}

function buildOutcome(kind: ProbeKind): ProbeOutcome {
  return { kind, healthy: kind === 'authenticated' }
}

export function isGoogleLoginRedirectUrl(rawUrl: string): boolean {
  const hostname = getHostname(rawUrl)
  const pathname = getPathname(rawUrl)
  return !!hostname && LOGIN_HOSTS.has(hostname) && LOGIN_PATH_REGEX.test(pathname)
}

export function classifyAuthProbe(
  rawUrl: string,
  snapshot: DomProbeSnapshot,
  hasNetworkError: boolean
): ProbeOutcome {
  if (hasNetworkError) return buildOutcome('network')

  const hostname = getHostname(rawUrl)
  const pathname = getPathname(rawUrl)

  if (hostname && CHALLENGE_HOSTS.has(hostname)) {
    return buildOutcome('challenge')
  }

  if (isGoogleLoginRedirectUrl(rawUrl)) {
    if (snapshot.hasChallengeText && !snapshot.hasLoginForm && !snapshot.hasSignInText) {
      return buildOutcome('challenge')
    }
    return buildOutcome('login_redirect')
  }

  if (snapshot.hasChallengeText) return buildOutcome('challenge')

  const matchedApp = APP_BY_HOST.get(hostname)
  const inGoogleAiWebApp = APP_HOSTS.has(hostname)

  if (inGoogleAiWebApp && (snapshot.hasLoginForm || snapshot.hasSignInText)) {
    return buildOutcome('login_redirect')
  }

  if (
    matchedApp &&
    matchedApp.healthPathPrefixes.some((prefix) => pathname.startsWith(prefix)) &&
    snapshot.hasComposer &&
    !snapshot.hasLoginForm &&
    !snapshot.hasSignInText
  ) {
    return buildOutcome('authenticated')
  }

  if (snapshot.hasLoginForm || snapshot.hasSignInText) {
    return buildOutcome('login_redirect')
  }

  return buildOutcome('unknown')
}
