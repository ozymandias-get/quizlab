import { classifyAuthProbe } from './authHeuristics'
import { DOM_SNAPSHOT_SCRIPT, EMPTY_DOM_SNAPSHOT, GOOGLE_AI_WEB_APP_URLS } from './constants'
import type { BrowserContextLike, PageLike } from './playwrightBrowserContext'
import type { ExternalBrowserCookie } from './playwrightCookieMapping'
import { collectSessionCookies } from './playwrightCookieMapping'
import { asDomProbeSnapshot } from './playwrightLoginProbe'
import { UNKNOWN_OUTCOME } from './playwrightLoginTypes'
import type { ProbeOutcome } from './stateMachine'
import { PLAYWRIGHT_NETWORKIDLE_TIMEOUT_MS } from './sessionConfig'

const POST_LOGIN_HYDRATION_SETTLE_MS = 1_200
const POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS = 15_000

export async function hydrateGoogleAiAppSession(
  page: PageLike,
  context: BrowserContextLike,
  startedAt: number,
  timeoutMs: number,
  headless: boolean
): Promise<{ cookies: ExternalBrowserCookie[]; outcome: ProbeOutcome; exhaustedBudget: boolean }> {
  let lastCookies = await collectSessionCookies(context).catch(() => [])
  let lastOutcome: ProbeOutcome = UNKNOWN_OUTCOME
  let exhaustedBudget = false

  for (const targetUrl of GOOGLE_AI_WEB_APP_URLS) {
    const remainingMs =
      timeoutMs > 0 ? timeoutMs - (Date.now() - startedAt) : POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS
    if (timeoutMs > 0 && remainingMs <= 0) {
      exhaustedBudget = true
      break
    }

    const navTimeoutMs = Math.max(1_000, Math.min(remainingMs, POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS))

    await page
      .goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: navTimeoutMs
      })
      .catch(() => {})

    if (headless) {
      await page
        .waitForLoadState('networkidle', {
          timeout: Math.min(navTimeoutMs, PLAYWRIGHT_NETWORKIDLE_TIMEOUT_MS)
        })
        .catch(() => {})
    }

    await new Promise((resolve) => setTimeout(resolve, POST_LOGIN_HYDRATION_SETTLE_MS))

    const currentUrl = page.url()
    const snapshot = asDomProbeSnapshot(
      await page.evaluate(DOM_SNAPSHOT_SCRIPT).catch(() => EMPTY_DOM_SNAPSHOT)
    )
    lastOutcome = classifyAuthProbe(currentUrl, snapshot, false)
    lastCookies = await collectSessionCookies(context).catch(() => lastCookies)

    if (lastOutcome.healthy) {
      return {
        cookies: lastCookies,
        outcome: lastOutcome,
        exhaustedBudget
      }
    }
  }

  return {
    cookies: lastCookies,
    outcome: lastOutcome,
    exhaustedBudget
  }
}
