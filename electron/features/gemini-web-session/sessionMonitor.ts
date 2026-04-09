import type { Session } from 'electron'
import type { CookieExpiryCheckResult } from './sessionContracts'

function getCookieExpiresAtMs(cookie: Electron.Cookie): number | null {
  const expirationDate =
    typeof cookie.expirationDate === 'number' && Number.isFinite(cookie.expirationDate)
      ? cookie.expirationDate
      : null

  if (!expirationDate || expirationDate <= 0) return null
  return Math.floor(expirationDate * 1000)
}

function isRelevantGoogleCookie(cookie: Electron.Cookie): boolean {
  return !!cookie.domain?.includes('google.com') && !!cookie.name
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
    refreshThresholdMs: number
  ): Promise<CookieExpiryCheckResult> {
    const cookies = await targetSession.cookies.get({}).catch(() => [])
    const relevantCookies = cookies.filter(isRelevantGoogleCookie)
    if (relevantCookies.length === 0) {
      return {
        hasRelevantCookies: false,
        hasExpiredCookie: false,
        shouldRefresh: true,
        earliestExpiry: null
      }
    }

    const now = Date.now()
    const finiteExpiries = relevantCookies
      .map(getCookieExpiresAtMs)
      .filter((value): value is number => typeof value === 'number')

    if (finiteExpiries.length === 0) {
      return {
        hasRelevantCookies: true,
        hasExpiredCookie: false,
        shouldRefresh: false,
        earliestExpiry: null
      }
    }

    const earliestExpiry = Math.min(...finiteExpiries)
    const hasExpiredCookie = earliestExpiry <= now
    const shouldRefresh = hasExpiredCookie || earliestExpiry - now <= refreshThresholdMs

    return {
      hasRelevantCookies: true,
      hasExpiredCookie,
      shouldRefresh,
      earliestExpiry
    }
  }

  private getJitteredDelay(baseDelay: number, jitterPct: number): number {
    const ratio = Math.max(0, Math.min(jitterPct, 95)) / 100
    const min = baseDelay * (1 - ratio)
    const max = baseDelay * (1 + ratio)
    return Math.floor(min + Math.random() * (max - min))
  }
}
