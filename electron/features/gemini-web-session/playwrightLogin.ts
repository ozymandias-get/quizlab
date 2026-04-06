import path from 'path'
import { existsSync } from 'fs'
import { classifyAuthProbe } from './authHeuristics'
import type { ProbeOutcome } from './stateMachine'
import { computeGoogleAccountHash } from './sessionUtils'
import {
  DOM_SNAPSHOT_SCRIPT,
  EMPTY_DOM_SNAPSHOT,
  GOOGLE_AI_WEB_APP_URLS,
  GOOGLE_SIGNIN_URL
} from './constants'

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
const POST_LOGIN_HOSTS = new Set(['accounts.google.com', 'myaccount.google.com', 'www.google.com'])

type ExternalSameSite = 'Strict' | 'Lax' | 'None' | undefined

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
  if (outcome.kind === 'login_redirect') return 'error_login_not_completed'
  return 'error_login_failed'
}

export function hasCompletedGoogleLogin(
  currentUrl: string,
  snapshot: { hasLoginForm: boolean; hasSignInText: boolean; hasChallengeText: boolean },
  cookies: ExternalBrowserCookie[]
): boolean {
  const hostname = getHostname(currentUrl)
  if (!hostname || !POST_LOGIN_HOSTS.has(hostname)) return false
  if (snapshot.hasLoginForm || snapshot.hasChallengeText) return false

  const hasSessionCookies = computeGoogleAccountHash(cookies) !== null
  if (!hasSessionCookies) return false

  if (hostname !== 'accounts.google.com') return true

  return !snapshot.hasSignInText
}

function mapContextCookies(cookiesRaw: any[]): ExternalBrowserCookie[] {
  return cookiesRaw.map((cookie: any) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: cookie.sameSite,
    expires: typeof cookie.expires === 'number' ? cookie.expires : undefined
  }))
}

async function collectSessionCookies(context: any): Promise<ExternalBrowserCookie[]> {
  const cookiesRaw = await context.cookies(SESSION_COOKIE_SOURCE_URLS)
  return mapContextCookies(cookiesRaw)
}

async function hydrateGoogleAiAppSession(
  page: any,
  context: any,
  startedAt: number,
  timeoutMs: number
): Promise<{ cookies: ExternalBrowserCookie[]; outcome: ProbeOutcome }> {
  let lastCookies = await collectSessionCookies(context).catch(() => [])
  let lastOutcome: ProbeOutcome = UNKNOWN_OUTCOME

  for (const targetUrl of GOOGLE_AI_WEB_APP_URLS) {
    const remainingMs =
      timeoutMs > 0 ? timeoutMs - (Date.now() - startedAt) : POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS
    if (timeoutMs > 0 && remainingMs <= 0) break

    const navTimeoutMs = Math.max(1_000, Math.min(remainingMs, POST_LOGIN_HYDRATION_NAV_TIMEOUT_MS))

    await page
      .goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: navTimeoutMs
      })
      .catch(() => {})

    await new Promise((resolve) => setTimeout(resolve, POST_LOGIN_HYDRATION_SETTLE_MS))

    const currentUrl = page.url()
    const snapshot = await page.evaluate(DOM_SNAPSHOT_SCRIPT).catch(() => EMPTY_DOM_SNAPSHOT)
    lastOutcome = classifyAuthProbe(currentUrl, snapshot, false)
    lastCookies = await collectSessionCookies(context).catch(() => lastCookies)

    if (lastOutcome.healthy) {
      return {
        cookies: lastCookies,
        outcome: lastOutcome
      }
    }
  }

  return {
    cookies: lastCookies,
    outcome: lastOutcome
  }
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
    initialUrl: GOOGLE_SIGNIN_URL
  })
}

async function runPlaywrightSessionFlow({
  profileDir,
  timeoutMs,
  headless,
  successStreakTarget,
  initialUrl
}: SessionFlowOptions): Promise<PlaywrightLoginResult> {
  let context: any = null

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
    context = await chromium.launchPersistentContext(profileDir, {
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
    })

    context.setDefaultTimeout(0)
    context.setDefaultNavigationTimeout(0)

    const page = context.pages()[0] || (await context.newPage())
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' })

    const startedAt = Date.now()
    let streak = 0
    let lastOutcome: ProbeOutcome = UNKNOWN_OUTCOME

    while (true) {
      const elapsed = Date.now() - startedAt
      if (timeoutMs > 0 && elapsed >= timeoutMs) {
        return buildFailureResult(mapProbeError(lastOutcome, true), lastOutcome, true)
      }

      const pages = context.pages().filter((p: any) => !p.isClosed())
      if (pages.length === 0) {
        const fallbackPage = await context.newPage().catch(() => null)
        if (!fallbackPage) {
          return buildFailureResult(headless ? 'error_login_failed' : 'error_login_cancelled')
        }
        pages.push(fallbackPage)
      }

      const activePage = pages[pages.length - 1]
      const currentUrl = activePage.url()
      const snapshot = await activePage
        .evaluate(DOM_SNAPSHOT_SCRIPT)
        .catch(() => EMPTY_DOM_SNAPSHOT)
      lastOutcome = classifyAuthProbe(currentUrl, snapshot, false)

      const cookies = await collectSessionCookies(context)

      if (hasCompletedGoogleLogin(currentUrl, snapshot, cookies)) {
        const hydrated = await hydrateGoogleAiAppSession(activePage, context, startedAt, timeoutMs)
        const hydratedCookies = hydrated.cookies.length > 0 ? hydrated.cookies : cookies
        return {
          success: true,
          timedOut: false,
          outcome: hydrated.outcome.healthy
            ? hydrated.outcome
            : { kind: 'authenticated', healthy: true },
          cookies: hydratedCookies,
          accountHash: computeGoogleAccountHash(hydratedCookies)
        }
      }

      if (lastOutcome.healthy) {
        streak += 1
        if (streak >= successStreakTarget) {
          return {
            success: true,
            timedOut: false,
            outcome: lastOutcome,
            cookies,
            accountHash: computeGoogleAccountHash(cookies)
          }
        }
      } else {
        streak = 0
      }

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  } catch (error) {
    return buildFailureResult(
      (error instanceof Error ? error.message : String(error)).includes(
        'Target page, context or browser has been closed'
      )
        ? 'error_login_cancelled'
        : 'error_login_failed'
    )
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}
