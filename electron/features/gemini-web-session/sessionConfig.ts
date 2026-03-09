import type {
    GeminiWebSessionConfig,
    GeminiWebSessionState,
    GeminiWebSessionReasonCode
} from '@shared-core/types'

export const PROFILE_PARTITION = 'persist:gemini_web_profile'
export const HEALTH_TIMEOUT_MS = 30_000

function parseEnvNumber(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name]?.trim()
    if (!raw) return fallback
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(Math.floor(parsed), min), max)
}

export const SILENT_REFRESH_TIMEOUT_MS = parseEnvNumber('GEMINI_WEB_SILENT_REFRESH_TIMEOUT_MS', 25_000, 10_000, 120_000)
export const SILENT_REFRESH_COOLDOWN_MS = parseEnvNumber('GEMINI_WEB_SILENT_REFRESH_COOLDOWN_MS', 10 * 60 * 1000, 60_000, 60 * 60 * 1000)
export const PLAYWRIGHT_HEADLESS_REFRESH_TIMEOUT_MS = parseEnvNumber('GEMINI_WEB_HEADLESS_REFRESH_TIMEOUT_MS', 45_000, 10_000, 180_000)
export const PLAYWRIGHT_HEADLESS_REFRESH_COOLDOWN_MS = parseEnvNumber('GEMINI_WEB_HEADLESS_REFRESH_COOLDOWN_MS', 15 * 60 * 1000, 60_000, 2 * 60 * 60 * 1000)

export const LOGIN_TIMEOUT_MS = (() => {
    const rawEnv = process.env.GEMINI_WEB_LOGIN_TIMEOUT_MS?.trim()
    if (!rawEnv) return 7_200_000 // 120 min default
    const raw = Number(rawEnv)
    if (!Number.isFinite(raw)) return 7_200_000
    if (raw === 0) return 0
    return Math.min(Math.max(Math.floor(raw), 300_000), 43_200_000)
})()

const rawFeatureFlag = process.env.GEMINI_WEB_SESSION_ENABLED?.trim().toLowerCase()
export const FEATURE_ENABLED = rawFeatureFlag ? !['0', 'false', 'off', 'no'].includes(rawFeatureFlag) : true

const rawDefaultEnabled = process.env.GEMINI_WEB_SESSION_DEFAULT_ENABLED?.trim().toLowerCase()
export const DEFAULT_USER_ENABLED = rawDefaultEnabled ? !['0', 'false', 'off', 'no'].includes(rawDefaultEnabled) : true

export const DEFAULT_CONFIG: Omit<GeminiWebSessionConfig, 'profileDir'> = {
    checkIntervalMs: parseEnvNumber('GEMINI_WEB_CHECK_INTERVAL_MS', 5 * 60 * 1000, 60_000, 60 * 60 * 1000),
    jitterPct: parseEnvNumber('GEMINI_WEB_CHECK_JITTER_PCT', 10, 0, 50),
    retryDelayMs: parseEnvNumber('GEMINI_WEB_RETRY_DELAY_MS', 30 * 1000, 10_000, 10 * 60 * 1000),
    maxConsecutiveFailures: parseEnvNumber('GEMINI_WEB_MAX_CONSECUTIVE_FAILURES', 2, 1, 5)
}

const SESSION_STATES: GeminiWebSessionState[] = [
    'uninitialized', 'auth_required', 'authenticated', 'degraded', 'reauth_required'
]

const REASON_CODES: GeminiWebSessionReasonCode[] = [
    'none', 'login_redirect', 'challenge', 'network', 'unknown', 'reset_profile_required'
]

export function isSessionState(value: string): value is GeminiWebSessionState {
    return SESSION_STATES.includes(value as GeminiWebSessionState)
}

export function isReasonCode(value: string): value is GeminiWebSessionReasonCode {
    return REASON_CODES.includes(value as GeminiWebSessionReasonCode)
}
