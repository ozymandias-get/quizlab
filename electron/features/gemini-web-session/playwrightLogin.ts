import path from 'path'
import { existsSync } from 'fs'
import {
  classifyAuthProbe,
  isGoogleLoginRedirectUrl,
  type DomProbeSnapshot
} from './authHeuristics'
import type { ProbeOutcome } from './stateMachine'
import { computeGoogleAccountHash } from './sessionUtils'
import {
  DOM_SNAPSHOT_SCRIPT,
  EMPTY_DOM_SNAPSHOT,
  GOOGLE_AI_WEB_APP_URLS,
  GOOGLE_SIGNIN_URL
} from './constants'
import { PLAYWRIGHT_NETWORKIDLE_TIMEOUT_MS } from './sessionConfig'

const UNKNOWN_OUTCOME: ProbeOutcome = { kind: 'unknown', healthy: false }
const SESSION_COOKIE_SOURCE_URLS = Array.from(
  new Set([
    ...GOOGLE_AI_WEB_APP_URLS,
    GOOGLE_SIGNIN_URL,
    'https://www.google.com',
    'https://myaccount.google.com'
  ])
)
const POST_LOGIN_HYDRATION_SETTLE_MS = 1_200
const POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS = 15_000
const GOOGLE_ACCOUNTS_HOST = 'accounts.google.com'
const HEADLESS_REFRESH_INITIAL_URL = GOOGLE_AI_WEB_APP_URLS[0] || GOOGLE_SIGNIN_URL

type ExternalSameSite = 'Strict' | 'Lax' | 'None' | undefined

/** Minimal Playwright cookie shape from `BrowserContext#cookies` (structural typing). */
interface CookieLike {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: unknown
  expires?: number
}

/** Methods used from Playwright `Page` in this module only. */
interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  url(): string
  evaluate(script: string): Promise<unknown>
  waitForLoadState(state: string, options?: { timeout: number }): Promise<unknown>
  isClosed(): boolean
}

/** Methods used from Playwright `BrowserContext` in this module only. */
interface BrowserContextLike {
  cookies(urls: readonly string[]): Promise<unknown>
  pages(): PageLike[]
  newPage(): Promise<PageLike>
  setDefaultTimeout(timeout: number): void
  setDefaultNavigationTimeout(timeout: number): void
  close(): Promise<unknown>
}

export interface ExternalBrowserCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: ExternalSameSite
  expires?: number
}

interface PlaywrightLoginResult {
  success: boolean
  outcome: ProbeOutcome
  timedOut: boolean
  cookies: ExternalBrowserCookie[]
  accountHash: string | null
  error?: string
}

interface LoginOptions {
  profileDir: string
  timeoutMs: number
}

interface SessionFlowOptions extends LoginOptions {
  headless: boolean
  successStreakTarget: number
  initialUrl: string
}

function buildFailureResult(
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

function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function resolveSystemBrowserPath(): string | null {
  const candidates: string[] = []

  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA || ''

    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    )
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    )
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }

  return null
}

function mapProbeError(outcome: ProbeOutcome, timedOut: boolean): string {
  if (timedOut) return 'error_login_timeout'
  if (outcome.kind === 'challenge') return 'error_challenge_required'
  if (outcome.kind === 'network') return 'error_network_login_failed'
  if (outcome.kind === 'login_redirect') return 'error_login_verification_failed'
  return 'error_login_failed'
}

function mapHeadlessRefreshFailure(
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

function isCookieLike(raw: unknown): raw is CookieLike {
  if (typeof raw !== 'object' || raw === null) return false
  const c = raw as Record<string, unknown>
  return typeof c.name === 'string' && typeof c.value === 'string' && typeof c.domain === 'string'
}

function normalizeSameSite(value: unknown): ExternalSameSite {
  if (value === 'Strict' || value === 'Lax' || value === 'None') return value
  return undefined
}

function mapContextCookies(cookiesRaw: unknown[]): ExternalBrowserCookie[] {
  const out: ExternalBrowserCookie[] = []
  for (const raw of cookiesRaw) {
    if (!isCookieLike(raw)) continue
    out.push({
      name: raw.name,
      value: raw.value,
      domain: raw.domain,
      path: typeof raw.path === 'string' ? raw.path : '/',
      secure: !!raw.secure,
      httpOnly: !!raw.httpOnly,
      sameSite: normalizeSameSite(raw.sameSite),
      expires: typeof raw.expires === 'number' ? raw.expires : undefined
    })
  }
  return out
}

function asDomProbeSnapshot(value: unknown): DomProbeSnapshot {
  return (value ?? EMPTY_DOM_SNAPSHOT) as DomProbeSnapshot
}

async function collectSessionCookies(
  context: BrowserContextLike
): Promise<ExternalBrowserCookie[]> {
  const cookiesRaw = await context.cookies(SESSION_COOKIE_SOURCE_URLS)
  if (!Array.isArray(cookiesRaw)) return []
  return mapContextCookies(cookiesRaw)
}

async function hydrateGoogleAiAppSession(
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

async function ensureActivePage(context: BrowserContextLike): Promise<PageLike | null> {
  const pages = context.pages().filter((page) => !page.isClosed())
  if (pages.length > 0) {
    return pages[pages.length - 1]
  }
  return context.newPage().catch(() => null)
}

export async function runPlaywrightLogin({
  profileDir,
  timeoutMs
}: LoginOptions): Promise<PlaywrightLoginResult> {
  return runPlaywrightSessionFlow({
    profileDir,
    timeoutMs,
    headless: false,
    successStreakTarget: 3,
    initialUrl: GOOGLE_SIGNIN_URL
  })
}

export async function runPlaywrightHeadlessRefresh({
  profileDir,
  timeoutMs
}: LoginOptions): Promise<PlaywrightLoginResult> {
  return runPlaywrightSessionFlow({
    profileDir,
    timeoutMs,
    headless: true,
    successStreakTarget: 2,
    initialUrl: HEADLESS_REFRESH_INITIAL_URL
  })
}

async function runPlaywrightSessionFlow({
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
        const hydrated = await hydrateGoogleAiAppSession(
          activePage,
          browserContext,
          startedAt,
          timeoutMs,
          headless
        )
        const hydratedCookies =
          hydrated.cookies.length > 0 ? hydrated.cookies : hydrated.exhaustedBudget ? cookies : []
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
          outcome: hydrated.outcome.healthy
            ? hydrated.outcome
            : { kind: 'authenticated', healthy: true },
          cookies: hydratedCookies,
          accountHash
        }
      }

      if (lastOutcome.healthy) {
        streak += 1
        if (streak >= successStreakTarget) {
          const hydrated = await hydrateGoogleAiAppSession(
            activePage,
            browserContext,
            startedAt,
            timeoutMs,
            headless
          )
          const hydratedCookies =
            hydrated.cookies.length > 0 ? hydrated.cookies : hydrated.exhaustedBudget ? cookies : []
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
            outcome: hydrated.outcome.healthy ? hydrated.outcome : lastOutcome,
            cookies: hydratedCookies,
            accountHash
          }
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
