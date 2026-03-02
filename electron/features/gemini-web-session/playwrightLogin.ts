import path from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { classifyAuthProbe } from './authHeuristics'
import type { ProbeOutcome } from './stateMachine'
import {
    DOM_SNAPSHOT_SCRIPT,
    EMPTY_DOM_SNAPSHOT,
    GEMINI_HOME_URL,
    GOOGLE_SIGNIN_URL
} from './constants'

const UNKNOWN_OUTCOME: ProbeOutcome = { kind: 'unknown', healthy: false }

type ExternalSameSite = 'Strict' | 'Lax' | 'None' | undefined

export interface ExternalBrowserCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite?: ExternalSameSite;
    expires?: number;
}

export interface PlaywrightLoginResult {
    success: boolean;
    outcome: ProbeOutcome;
    timedOut: boolean;
    cookies: ExternalBrowserCookie[];
    accountHash: string | null;
    error?: string;
}

interface LoginOptions {
    profileDir: string;
    timeoutMs: number;
}

interface SessionFlowOptions extends LoginOptions {
    headless: boolean;
    successStreakTarget: number;
    initialUrl: string;
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

function computeAccountHash(cookies: ExternalBrowserCookie[]): string | null {
    const prioritized = ['__Secure-1PSID', 'SID', 'SAPISID']
    for (const name of prioritized) {
        const target = cookies.find(cookie => cookie.name === name && cookie.domain.includes('google.com'))
        if (target?.value) {
            return createHash('sha256').update(target.value).digest('hex').slice(0, 16)
        }
    }
    return null
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

        const page = context.pages()[0] || await context.newPage()
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
            const snapshot = await activePage.evaluate(DOM_SNAPSHOT_SCRIPT).catch(() => EMPTY_DOM_SNAPSHOT)
            lastOutcome = classifyAuthProbe(currentUrl, snapshot, false)

            // Start on Google login page, then move to Gemini after login completes.
            // If we're still on accounts host but sign-in controls are gone, nudge to Gemini.
            if (
                getHostname(currentUrl) === 'accounts.google.com' &&
                !snapshot.hasLoginForm &&
                !snapshot.hasSignInText &&
                !snapshot.hasChallengeText
            ) {
                await activePage.goto(GEMINI_HOME_URL, { waitUntil: 'domcontentloaded' }).catch(() => { })
            }

            if (lastOutcome.healthy) {
                streak += 1
                if (streak >= successStreakTarget) {
                    const cookiesRaw = await context.cookies([
                        'https://gemini.google.com',
                        'https://accounts.google.com',
                        'https://www.google.com'
                    ])

                    const cookies: ExternalBrowserCookie[] = cookiesRaw.map((cookie: any) => ({
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path || '/',
                        secure: !!cookie.secure,
                        httpOnly: !!cookie.httpOnly,
                        sameSite: cookie.sameSite,
                        expires: typeof cookie.expires === 'number' ? cookie.expires : undefined
                    }))

                    return {
                        success: true,
                        timedOut: false,
                        outcome: lastOutcome,
                        cookies,
                        accountHash: computeAccountHash(cookies)
                    }
                }
            } else {
                streak = 0
            }

            await new Promise(resolve => setTimeout(resolve, 1500))
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return buildFailureResult(
            message.includes('Target page, context or browser has been closed')
                ? 'error_login_cancelled'
                : 'error_login_failed'
        )
    } finally {
        if (context) {
            await context.close().catch(() => { })
        }
    }
}
