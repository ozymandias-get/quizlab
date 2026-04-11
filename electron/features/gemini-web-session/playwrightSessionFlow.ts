import { classifyAuthProbe, isGoogleLoginRedirectUrl } from './authHeuristics'
import {
  DOM_SNAPSHOT_SCRIPT,
  EMPTY_DOM_SNAPSHOT,
  GOOGLE_AI_WEB_APP_URLS,
  GOOGLE_SIGNIN_URL
} from './constants'
import {
  ensureActivePage,
  resolveSystemBrowserPath,
  type BrowserContextLike
} from './playwrightBrowserContext'
import { collectSessionCookies } from './playwrightCookieMapping'
import {
  asDomProbeSnapshot,
  buildFailureResult,
  getHostname,
  GOOGLE_ACCOUNTS_HOST,
  hasCompletedGoogleLogin,
  mapHeadlessRefreshFailure,
  mapProbeError
} from './playwrightLoginProbe'
import type { PlaywrightLoginResult, SessionFlowOptions } from './playwrightLoginTypes'
import { UNKNOWN_OUTCOME } from './playwrightLoginTypes'
import { hydrateGoogleAiAppSession } from './playwrightSessionHydration'
import type { ProbeOutcome } from './stateMachine'
import { computeGoogleAccountHash } from './sessionUtils'

const HEADLESS_REFRESH_INITIAL_URL = GOOGLE_AI_WEB_APP_URLS[0] || GOOGLE_SIGNIN_URL

async function completeAuthenticatedSession(options: {
  activePage: Awaited<ReturnType<typeof ensureActivePage>>
  browserContext: BrowserContextLike
  startedAt: number
  timeoutMs: number
  headless: boolean
  snapshot: { hasLoginForm: boolean; hasChallengeText: boolean }
  fallbackCookies: Awaited<ReturnType<typeof collectSessionCookies>>
  fallbackOutcome: ProbeOutcome
}): Promise<PlaywrightLoginResult> {
  const {
    activePage,
    browserContext,
    startedAt,
    timeoutMs,
    headless,
    snapshot,
    fallbackCookies,
    fallbackOutcome
  } = options

  if (!activePage) {
    return buildFailureResult(headless ? 'error_login_failed' : 'error_login_cancelled')
  }

  const hydrated = await hydrateGoogleAiAppSession(
    activePage,
    browserContext,
    startedAt,
    timeoutMs,
    headless
  )
  const hydratedCookies =
    hydrated.cookies.length > 0 ? hydrated.cookies : hydrated.exhaustedBudget ? fallbackCookies : []
  const accountHash = computeGoogleAccountHash(hydratedCookies)
  if (!accountHash) {
    return buildFailureResult(
      headless
        ? mapHeadlessRefreshFailure(snapshot, hydrated.outcome, hydrated.exhaustedBudget)
        : mapProbeError(hydrated.outcome, hydrated.exhaustedBudget),
      hydrated.outcome,
      hydrated.exhaustedBudget
    )
  }

  return {
    success: true,
    timedOut: false,
    outcome: hydrated.outcome.healthy ? hydrated.outcome : fallbackOutcome,
    cookies: hydratedCookies,
    accountHash
  }
}

export async function runPlaywrightSessionFlow({
  profileDir,
  timeoutMs,
  headless,
  successStreakTarget,
  initialUrl
}: SessionFlowOptions): Promise<PlaywrightLoginResult> {
  let context: BrowserContextLike | null = null

  try {
    const executablePath = resolveSystemBrowserPath()
    if (!executablePath) {
      return buildFailureResult('error_browser_not_found')
    }

    const moduleRef = await import('playwright-core').catch(() => null)
    if (!moduleRef?.chromium) {
      return buildFailureResult('error_playwright_unavailable')
    }

    const { chromium } = moduleRef
    const browserContext = (await chromium.launchPersistentContext(profileDir, {
      executablePath,
      headless,
      viewport: { width: 1280, height: 880 },
      ignoreHTTPSErrors: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ]
    })) as BrowserContextLike

    context = browserContext

    browserContext.setDefaultTimeout(0)
    browserContext.setDefaultNavigationTimeout(0)

    const page =
      (browserContext.pages()[0] && !browserContext.pages()[0].isClosed()
        ? browserContext.pages()[0]
        : null) || (await browserContext.newPage().catch(() => null))
    if (!page) {
      return buildFailureResult(headless ? 'error_login_failed' : 'error_login_cancelled')
    }
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' })

    const startedAt = Date.now()
    let streak = 0
    let lastOutcome: ProbeOutcome = UNKNOWN_OUTCOME
    let sawAccountsHost = getHostname(initialUrl) === GOOGLE_ACCOUNTS_HOST

    while (true) {
      const elapsed = Date.now() - startedAt
      if (timeoutMs > 0 && elapsed >= timeoutMs) {
        return buildFailureResult(mapProbeError(lastOutcome, true), lastOutcome, true)
      }

      const activePage = await ensureActivePage(browserContext)
      if (!activePage) {
        return buildFailureResult(headless ? 'error_login_failed' : 'error_login_cancelled')
      }
      const currentUrl = activePage.url()
      const currentHostname = getHostname(currentUrl)
      if (currentHostname === GOOGLE_ACCOUNTS_HOST) {
        sawAccountsHost = true
      }
      const snapshot = asDomProbeSnapshot(
        await activePage.evaluate(DOM_SNAPSHOT_SCRIPT).catch(() => EMPTY_DOM_SNAPSHOT)
      )
      lastOutcome = classifyAuthProbe(currentUrl, snapshot, false)
      if (headless && (snapshot.hasLoginForm || snapshot.hasChallengeText)) {
        return buildFailureResult(
          mapHeadlessRefreshFailure(snapshot, lastOutcome, false),
          lastOutcome,
          false
        )
      }
      if (lastOutcome.kind === 'challenge') {
        return buildFailureResult(
          headless
            ? mapHeadlessRefreshFailure(snapshot, lastOutcome, false)
            : mapProbeError(lastOutcome, false),
          lastOutcome,
          false
        )
      }

      const cookies = await collectSessionCookies(browserContext)
      const hasExitedAccountsHost = sawAccountsHost && currentHostname !== GOOGLE_ACCOUNTS_HOST

      if (
        hasCompletedGoogleLogin(currentUrl, snapshot, cookies, lastOutcome, hasExitedAccountsHost)
      ) {
        return completeAuthenticatedSession({
          activePage,
          browserContext,
          startedAt,
          timeoutMs,
          headless,
          snapshot,
          fallbackCookies: cookies,
          fallbackOutcome: { kind: 'authenticated', healthy: true }
        })
      }

      if (lastOutcome.healthy) {
        streak += 1
        if (streak >= successStreakTarget) {
          return completeAuthenticatedSession({
            activePage,
            browserContext,
            startedAt,
            timeoutMs,
            headless,
            snapshot,
            fallbackCookies: cookies,
            fallbackOutcome: lastOutcome
          })
        }
      } else {
        streak = 0
      }

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return buildFailureResult(
      errorMessage.includes('Target page, context or browser has been closed')
        ? 'error_login_cancelled'
        : headless && isGoogleLoginRedirectUrl(errorMessage)
          ? 'error_refresh_failed_requires_login'
          : 'error_login_failed'
    )
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}

export { HEADLESS_REFRESH_INITIAL_URL }
