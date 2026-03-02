import type { ProbeOutcome, ProbeKind } from './stateMachine'

const CHALLENGE_HOSTS = new Set([
    'challenge.google.com',
    'sorry.google.com'
])

const LOGIN_HOSTS = new Set([
    'accounts.google.com'
])

export interface DomProbeSnapshot {
    hasLoginForm: boolean;
    hasComposer: boolean;
    hasChallengeText: boolean;
    hasSignInText: boolean;
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

export function classifyAuthProbe(rawUrl: string, snapshot: DomProbeSnapshot, hasNetworkError: boolean): ProbeOutcome {
    if (hasNetworkError) return buildOutcome('network')

    const hostname = getHostname(rawUrl)
    const pathname = getPathname(rawUrl)

    if (hostname && CHALLENGE_HOSTS.has(hostname)) {
        return buildOutcome('challenge')
    }

    // Google Accounts pages are part of normal sign-in flow (including /signin/challenge/pwd).
    // Escalate as verification challenge only with strong challenge text and no sign-in affordance.
    if (hostname && LOGIN_HOSTS.has(hostname)) {
        if (snapshot.hasChallengeText && !snapshot.hasLoginForm && !snapshot.hasSignInText) {
            return buildOutcome('challenge')
        }
        return buildOutcome('login_redirect')
    }

    if (snapshot.hasChallengeText) return buildOutcome('challenge')

    const inGeminiHost = hostname.endsWith('gemini.google.com') || hostname === 'gemini.google.com'

    // If Gemini host still contains sign-in affordances, treat as unauthenticated.
    if (inGeminiHost && (snapshot.hasLoginForm || snapshot.hasSignInText)) {
        return buildOutcome('login_redirect')
    }

    // Strict success condition to avoid false-healthy detections that close login too early.
    if (
        inGeminiHost &&
        pathname.startsWith('/app') &&
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

export function sanitizeUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl)
        parsed.search = ''
        parsed.hash = ''
        return parsed.toString()
    } catch {
        return rawUrl
    }
}
