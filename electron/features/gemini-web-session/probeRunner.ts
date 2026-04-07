import { BrowserWindow, type Session } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { classifyAuthProbe, type DomProbeSnapshot } from './authHeuristics'
import {
  DOM_SNAPSHOT_SCRIPT,
  EMPTY_DOM_SNAPSHOT,
  GEMINI_HOME_URL,
  GOOGLE_AI_WEB_APP_URLS
} from './constants'
import { computeGoogleAccountHash } from './sessionUtils'
import { toErrorMessage } from './sessionErrors'
import type { ProbeExecutionResult } from './sessionContracts'

const GOOGLE_ACCOUNT_HASH_COOKIE_NAMES = ['__Secure-1PSID', 'SID', 'SAPISID'] as const

function logSuppressedError(context: string, error: unknown): void {
  console.warn(`[GeminiWebSession] ${context}:`, toErrorMessage(error, 'unknown_error'))
}

function probeSeverity(kind: ProbeExecutionResult['outcome']['kind']): number {
  if (kind === 'challenge') return 4
  if (kind === 'login_redirect') return 3
  if (kind === 'network') return 2
  if (kind === 'unknown') return 1
  return 0
}

export class ProbeRunner {
  private readonly ensureProfileDirectory: () => Promise<void>
  private readonly resolvePersistentSession: () => Session

  constructor(options: {
    ensureProfileDirectory: () => Promise<void>
    resolvePersistentSession: () => Session
  }) {
    this.ensureProfileDirectory = options.ensureProfileDirectory
    this.resolvePersistentSession = options.resolvePersistentSession
  }

  async runProbeAcrossApps(options: {
    interactive: boolean
    timeoutMs: number
    initialUrls?: string[]
  }): Promise<ProbeExecutionResult> {
    const targetUrls =
      options.initialUrls && options.initialUrls.length > 0
        ? options.initialUrls
        : GOOGLE_AI_WEB_APP_URLS

    let bestFailure: ProbeExecutionResult | null = null

    for (const initialUrl of targetUrls) {
      const result = await this.runProbe({
        interactive: options.interactive,
        timeoutMs: options.timeoutMs,
        initialUrl
      })

      if (result.outcome.healthy) {
        return result
      }

      if (
        !bestFailure ||
        probeSeverity(result.outcome.kind) > probeSeverity(bestFailure.outcome.kind)
      ) {
        bestFailure = result
      }
    }

    return (
      bestFailure || {
        outcome: { kind: 'unknown', healthy: false },
        accountHash: null,
        timedOut: false
      }
    )
  }

  async runProbe(options: {
    interactive: boolean
    timeoutMs: number
    initialUrl?: string
  }): Promise<ProbeExecutionResult> {
    await this.ensureProfileDirectory()
    const persistentSession = this.resolvePersistentSession()
    const initialUrl = options.initialUrl || GEMINI_HOME_URL

    return new Promise<ProbeExecutionResult>((resolve) => {
      let done = false
      let timeoutReached = false
      let currentUrl = initialUrl
      let hasNetworkError = false
      let interactiveHealthyStreak = 0
      let nonInteractiveHealthyStreak = 0
      let nonInteractiveIssueStreak = 0
      let pollInFlight = false

      const win = new BrowserWindow({
        width: 1200,
        height: 900,
        show: options.interactive,
        autoHideMenuBar: true,
        webPreferences: {
          session: persistentSession,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          spellcheck: false
        }
      })

      win.webContents.setUserAgent(APP_CONFIG.CHROME_USER_AGENT)

      const safeResolve = async (result: ProbeExecutionResult) => {
        if (done) return
        done = true
        clearTimeout(timeoutId)
        clearInterval(intervalId)
        try {
          if (!win.isDestroyed()) win.close()
        } catch {}
        resolve(result)
      }

      const captureSnapshot = async (): Promise<DomProbeSnapshot> => {
        try {
          const snapshot = await win.webContents.executeJavaScript(DOM_SNAPSHOT_SCRIPT, true)
          if (snapshot && typeof snapshot === 'object') {
            const cast = snapshot as Partial<DomProbeSnapshot>
            return {
              hasLoginForm: !!cast.hasLoginForm,
              hasComposer: !!cast.hasComposer,
              hasChallengeText: !!cast.hasChallengeText,
              hasSignInText: !!cast.hasSignInText
            }
          }
        } catch {}

        return EMPTY_DOM_SNAPSHOT
      }

      const classifyCurrent = async (): Promise<ProbeExecutionResult> => {
        const snapshot = await captureSnapshot()
        const outcome = classifyAuthProbe(currentUrl, snapshot, hasNetworkError)
        const accountHash = outcome.healthy ? await this.readAccountHash(persistentSession) : null
        return {
          outcome,
          accountHash,
          timedOut: timeoutReached
        }
      }

      const onNavigate = (_event: Electron.Event, url: string) => {
        currentUrl = url
      }

      const onDidFailLoad = (_event: Electron.Event, errorCode: number) => {
        if (errorCode !== -3) {
          hasNetworkError = true
        }
      }

      win.webContents.on('did-navigate', onNavigate)
      win.webContents.on('did-redirect-navigation', onNavigate)
      win.webContents.on('did-fail-load', onDidFailLoad)

      win.webContents.setWindowOpenHandler(({ url }) => {
        currentUrl = url
        void win.loadURL(url).catch((error) => {
          logSuppressedError('loadURL failed in probe window', error)
        })
        return { action: 'deny' }
      })

      const timeoutId = setTimeout(async () => {
        timeoutReached = true
        const result = await classifyCurrent()
        await safeResolve(result)
      }, options.timeoutMs)

      const intervalId = setInterval(async () => {
        if (done) return
        if (pollInFlight) return
        pollInFlight = true
        const result = await classifyCurrent()

        try {
          if (!options.interactive) {
            if (result.outcome.healthy) {
              nonInteractiveHealthyStreak += 1
              nonInteractiveIssueStreak = 0
            } else {
              nonInteractiveIssueStreak += 1
              nonInteractiveHealthyStreak = 0
            }

            if (
              nonInteractiveHealthyStreak >= 2 ||
              nonInteractiveIssueStreak >= 2 ||
              result.timedOut
            ) {
              await safeResolve(result)
            }
            return
          }

          if (result.outcome.healthy) {
            interactiveHealthyStreak += 1
            if (interactiveHealthyStreak >= 3) {
              await safeResolve(result)
            }
          } else {
            interactiveHealthyStreak = 0
          }
        } finally {
          pollInFlight = false
        }
      }, 1500)

      win.on('closed', async () => {
        if (done) return
        const result = await classifyCurrent()
        await safeResolve({
          ...result,
          timedOut: true
        })
      })

      void win.loadURL(initialUrl).catch(async (error: unknown) => {
        hasNetworkError = true
        console.error(
          '[GeminiWebSession] Probe load failed:',
          toErrorMessage(error, 'unknown_error')
        )
        const result = await classifyCurrent()
        await safeResolve(result)
      })
    })
  }

  async readAccountHash(profileSession: Session): Promise<string | null> {
    const candidateCookies: Array<{ domain?: string | null; name: string; value?: string | null }> =
      []

    for (const name of GOOGLE_ACCOUNT_HASH_COOKIE_NAMES) {
      try {
        const cookies = await profileSession.cookies.get({ name })
        candidateCookies.push(...cookies)
      } catch {
        continue
      }
    }

    return computeGoogleAccountHash(candidateCookies)
  }
}
