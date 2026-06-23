import type { Session } from 'electron'

import type { CookieExpiryCheckResult } from './sessionContracts'

const GOOGLE_AUTH_COOKIE_NAMES = new Set([
  'SID',
  'HSID',
  'SSID',
  'APISID',
  'SAPISID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Secure-1PSIDTS',
  '__Secure-3PSIDTS',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC',
  'LSID',
  '__Host-GAPS'
])

function getCookieExpiresAtMs(cookie: Electron.Cookie): number | null {
  const expirationDate =
    typeof cookie.expirationDate === 'number' && Number.isFinite(cookie.expirationDate)
      ? cookie.expirationDate
      : null

  if (!expirationDate || expirationDate <= 0) return null
  return Math.floor(expirationDate * 1000)
}

function isRelevantGoogleCookie(cookie: Electron.Cookie): boolean {
  if (!cookie.name || !cookie.domain) return false
  if (!GOOGLE_AUTH_COOKIE_NAMES.has(cookie.name)) return false
  const domain = cookie.domain.toLowerCase()
  return (
    domain === 'google.com' ||
    domain.endsWith('.google.com') ||
    domain === 'gemini.google.com' ||
    domain.endsWith('.gemini.google.com') ||
    domain === 'aistudio.google.com' ||
    domain.endsWith('.aistudio.google.com')
  )
}

export class SessionMonitor {
  private timer: NodeJS.Timeout | null = null

  schedule(baseDelayMs: number, jitterPct: number, callback: () => Promise<void> | void): void {
    this.stop()
    const delayMs = this.getJitteredDelay(baseDelayMs, jitterPct)
    this.timer = setTimeout(async () => {
      await callback()
    }, delayMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }

  async inspectCookieExpiry(
    targetSession: Session,
    refreshThresholdMs: number,
    advanceMs?: number
  ): Promise<CookieExpiryCheckResult> {
    const cookies = await targetSession.cookies.get({}).catch(() => [])
    const relevantCookies = cookies.filter(isRelevantGoogleCookie)
    if (relevantCookies.length === 0) {
      return {
        hasRelevantCookies: false,
        hasExpiredCookie: false,
        shouldRefresh: true,
        earliestExpiry: null,
        relevantCookieCount: 0,
        sessionCookieCount: 0,
        proactiveRefreshDue: false
      }
    }

    const now = Date.now()
    const finiteExpiries = relevantCookies
      .map(getCookieExpiresAtMs)
      .filter((v): v is number => typeof v === 'number')

    if (finiteExpiries.length === 0) {
      return {
        hasRelevantCookies: true,
        hasExpiredCookie: false,
        shouldRefresh: false,
        earliestExpiry: null,
        relevantCookieCount: relevantCookies.length,
        sessionCookieCount: relevantCookies.length,
        proactiveRefreshDue: false
      }
    }

    const earliestExpiry = Math.min(...finiteExpiries)
    const hasExpiredCookie = earliestExpiry <= now
    const shouldRefresh = hasExpiredCookie || earliestExpiry - now <= refreshThresholdMs
    const advance = advanceMs ?? 0
    const proactiveRefreshDue =
      !shouldRefresh && advance > 0 && earliestExpiry - now <= refreshThresholdMs + advance

    return {
      hasRelevantCookies: true,
      hasExpiredCookie,
      shouldRefresh,
      earliestExpiry,
      relevantCookieCount: relevantCookies.length,
      sessionCookieCount: finiteExpiries.length,
      proactiveRefreshDue
    }
  }

  private getJitteredDelay(baseDelay: number, jitterPct: number): number {
    const ratio = Math.max(0, Math.min(jitterPct, 95)) / 100
    const min = baseDelay * (1 - ratio)
    const max = baseDelay * (1 + ratio)
    return Math.floor(min + Math.random() * (max - min))
  }
}
