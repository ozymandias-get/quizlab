import { BrowserWindow, app, session as electronSession, type Session } from 'electron'
import { promises as fs, constants as fsConstants } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import type { FileHandle } from 'fs/promises'
import { ConfigManager } from '../../core/ConfigManager'
import { APP_CONFIG } from '../../app/constants'
import type {
    GeminiWebSessionActionResult,
    GeminiWebSessionConfig,
    GeminiWebSessionStatus
} from '@shared-core/types'
import { classifyAuthProbe, type DomProbeSnapshot } from './authHeuristics'
import { applyProbeTransition, createDefaultStatus, type ProbeOutcome } from './stateMachine'
import { runPlaywrightHeadlessRefresh, runPlaywrightLogin, type ExternalBrowserCookie } from './playwrightLogin'
import {
    DOM_SNAPSHOT_SCRIPT,
    EMPTY_DOM_SNAPSHOT,
    GOOGLE_AI_WEB_APP_URLS,
    GEMINI_HOME_URL,
    GOOGLE_SIGNIN_URL
} from './constants'
import {
    buildElectronCookiePayload,
    clearPersistentPartitionData,
    clearGoogleCookies
} from './sessionCookies'
import {
    DEFAULT_CONFIG,
    DEFAULT_USER_ENABLED,
    FEATURE_ENABLED,
    HEALTH_TIMEOUT_MS,
    isReasonCode,
    isSessionState,
    LOGIN_TIMEOUT_MS,
    PLAYWRIGHT_HEADLESS_REFRESH_COOLDOWN_MS,
    PLAYWRIGHT_HEADLESS_REFRESH_TIMEOUT_MS,
    PROFILE_PARTITION,
    SILENT_REFRESH_COOLDOWN_MS,
    SILENT_REFRESH_TIMEOUT_MS
} from './sessionConfig'
import { isProcessAlive, nowIso } from './sessionUtils'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/google-ai-web-apps'

interface SessionMetadata extends GeminiWebSessionStatus {
    accountHash: string | null;
}

interface ProbeExecutionResult {
    outcome: ProbeOutcome;
    accountHash: string | null;
    timedOut: boolean;
}

interface LockResult {
    ok: boolean;
    error?: string;
}

type DisabledActionResult = GeminiWebSessionActionResult & {
    success: false;
    error: string;
    status: GeminiWebSessionStatus;
}

function probeSeverity(kind: ProbeOutcome['kind']): number {
    if (kind === 'challenge') return 4
    if (kind === 'login_redirect') return 3
    if (kind === 'network') return 2
    if (kind === 'unknown') return 1
    return 0
}

function sanitizeEnabledAppIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [...GOOGLE_WEB_SESSION_REGISTRY_IDS]

    const validIds = new Set(GOOGLE_WEB_SESSION_REGISTRY_IDS)
    const seenIds = new Set<string>()
    const sanitized: string[] = []

    for (const item of value) {
        if (typeof item !== 'string') continue
        if (!validIds.has(item as typeof GOOGLE_WEB_SESSION_REGISTRY_IDS[number])) continue
        if (seenIds.has(item)) continue
        seenIds.add(item)
        sanitized.push(item)
    }

    return sanitized
}

export class GeminiWebSessionManager {
    private readonly profileDir: string
    // Dedicated helper browser profile used only for login/refresh flows.
    private readonly playwrightProfileDir: string
    private readonly configPath: string
    private readonly lockPath: string
    private readonly config: GeminiWebSessionConfig
    private readonly metadataManager: ConfigManager<SessionMetadata>

    private initialized = false
    private monitorTimer: NodeJS.Timeout | null = null
    private activeCheck: Promise<GeminiWebSessionStatus> | null = null
    private lockHandle: FileHandle | null = null
    private lockDepth = 0
    private lastSilentRefreshAttemptAt = 0
    private lastPlaywrightRefreshAttemptAt = 0

    constructor() {
        const userDataPath = app.getPath('userData')
        this.profileDir = path.join(userDataPath, 'gemini-web-profile')
        this.playwrightProfileDir = path.join(userDataPath, 'gemini-web-login-browser')
        this.configPath = path.join(userDataPath, 'gemini-web-session.json')
        this.lockPath = path.join(this.profileDir, '.profile.lock')
        this.config = {
            profileDir: this.profileDir,
            ...DEFAULT_CONFIG
        }
        this.metadataManager = new ConfigManager<SessionMetadata>(this.configPath)
    }

    async initialize(): Promise<void> {
        if (this.initialized) return
        await this.ensureProfileDirectory()
        await this.ensureMetadata()
        this.initialized = true
        const metadata = await this.readMetadata()
        if (FEATURE_ENABLED && metadata.enabled) {
            this.scheduleMonitor()
            void this.performHealthCheck({ allowRetry: false }).catch(() => { })
        }
    }

    getConfig(): GeminiWebSessionConfig {
        return this.config
    }

    async getStatus(): Promise<GeminiWebSessionStatus> {
        await this.initialize()
        const metadata = await this.readMetadata()
        return this.toPublicStatus(metadata)
    }

    async setEnabled(enabled: boolean): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const current = await this.readMetadata()
        const nextEnabled = FEATURE_ENABLED ? !!enabled : false

        const status = await this.writeStatus(
            {
                ...current,
                enabled: nextEnabled,
                featureEnabled: FEATURE_ENABLED,
                lastCheckAt: nowIso()
            },
            current.accountHash
        )

        if (!nextEnabled && this.monitorTimer) {
            clearTimeout(this.monitorTimer)
            this.monitorTimer = null
        }
        if (nextEnabled) {
            this.scheduleMonitor()
            void this.performHealthCheck({ allowRetry: false }).catch(() => { })
        }

        return { success: true, status }
    }

    async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const current = await this.readMetadata()
        const status = await this.writeStatus(
            {
                ...current,
                enabledAppIds: sanitizeEnabledAppIds(enabledAppIds),
                lastCheckAt: nowIso()
            },
            current.accountHash
        )

        return { success: true, status }
    }

    async openLogin(): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const current = await this.readMetadata()
        const blocked = this.getDisabledActionResult(current)
        if (blocked) return blocked

        const lock = await this.acquireProfileLock()
        if (!lock.ok) {
            return {
                success: false,
                error: lock.error || 'already_in_use',
                status: await this.getStatus()
            }
        }

        try {
            const previous = await this.readMetadata()

            // Login in a dedicated external browser profile (Playwright + system Chrome/Chromium).
            const loginResult = await runPlaywrightLogin({
                profileDir: this.playwrightProfileDir,
                timeoutMs: LOGIN_TIMEOUT_MS
            })
            if (!loginResult.success) {
                const transitioned = applyProbeTransition({
                    previous,
                    outcome: loginResult.outcome,
                    timestamp: nowIso(),
                    maxConsecutiveFailures: this.config.maxConsecutiveFailures
                })

                const failureStatus = await this.writeStatus(
                    { ...transitioned, state: 'auth_required' },
                    previous.accountHash
                )

                return {
                    success: false,
                    error: loginResult.error || 'error_login_failed',
                    status: failureStatus
                }
            }

            const targetSession = this.resolvePersistentSession()
            await this.importExternalCookies(targetSession, loginResult.cookies)

            // Verify imported cookies with in-app probe.
            const probe = await this.runProbeAcrossApps({ interactive: false, timeoutMs: HEALTH_TIMEOUT_MS })
            const timestamp = nowIso()
            const transitioned = applyProbeTransition({
                previous,
                outcome: probe.outcome,
                timestamp,
                maxConsecutiveFailures: this.config.maxConsecutiveFailures
            })

            const status = await this.writeStatus(
                probe.outcome.healthy
                    ? { ...transitioned, state: 'authenticated' }
                    : { ...transitioned, state: 'auth_required' },
                probe.outcome.healthy ? (probe.accountHash || loginResult.accountHash) : previous.accountHash
            )

            if (probe.outcome.healthy) {
                return { success: true, status }
            }

            const error = probe.outcome.kind === 'challenge'
                ? 'error_challenge_required'
                : probe.outcome.kind === 'network'
                    ? 'error_network_login_failed'
                    : probe.timedOut
                        ? 'error_login_timeout'
                        : 'error_login_verification_failed'

            return { success: false, error, status }
        } catch (error: any) {
            const status = await this.getStatus()
            console.error('[GeminiWebSession] Login failed:', error?.message || String(error))
            return { success: false, error: 'error_login_failed', status }
        } finally {
            await this.releaseProfileLock()
        }
    }

    async checkNow(): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const current = await this.readMetadata()
        const blocked = this.getDisabledActionResult(current)
        if (blocked) return blocked
        const status = await this.performHealthCheck({ allowRetry: true })
        return { success: true, status }
    }

    async reauthenticate(): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const current = await this.readMetadata()
        const blocked = this.getDisabledActionResult(current)
        if (blocked) return blocked
        await this.writeStatus({ ...current, state: 'auth_required', reasonCode: 'login_redirect' }, current.accountHash)
        return this.openLogin()
    }

    async resetProfile(): Promise<GeminiWebSessionActionResult> {
        await this.initialize()
        const lock = await this.acquireProfileLock()
        if (!lock.ok) {
            return {
                success: false,
                error: lock.error || 'already_in_use',
                status: await this.getStatus()
            }
        }

        try {
            if (this.monitorTimer) {
                clearTimeout(this.monitorTimer)
                this.monitorTimer = null
            }
            if (this.activeCheck) {
                await this.activeCheck.catch(() => { })
            }

            const current = await this.readMetadata()
            await this.clearPersistentPartitionData()
            await this.clearPlaywrightProfileData()
            await this.ensureProfileDirectory()
            this.lastSilentRefreshAttemptAt = 0
            this.lastPlaywrightRefreshAttemptAt = 0
            const status = await this.writeStatus({
                ...createDefaultStatus(FEATURE_ENABLED, current.enabled),
                state: 'auth_required',
                reasonCode: 'reset_profile_required',
                lastCheckAt: nowIso(),
                enabledAppIds: current.enabledAppIds
            }, null)

            if (FEATURE_ENABLED && current.enabled) {
                this.scheduleMonitor()
            }

            return { success: true, status }
        } catch (error: any) {
            console.error('[GeminiWebSession] Reset profile failed:', error?.message || String(error))
            return {
                success: false,
                error: 'reset_failed',
                status: await this.getStatus()
            }
        } finally {
            await this.releaseProfileLock()
        }
    }

    async ensureAuthenticated(): Promise<{ ok: boolean; error?: string; status: GeminiWebSessionStatus }> {
        await this.initialize()
        const currentMetadata = await this.readMetadata()
        const current = this.toPublicStatus(currentMetadata)
        const blocked = this.getDisabledActionResult(currentMetadata)
        if (blocked) {
            return { ok: false, error: blocked.error, status: blocked.status }
        }

        if (current.state === 'authenticated') return { ok: true, status: current }
        if (current.state === 'reauth_required') {
            return { ok: false, error: 'reauth_required', status: current }
        }

        const result = await this.performHealthCheck({ allowRetry: true })
        if (result.state === 'authenticated') return { ok: true, status: result }
        if (result.state === 'reauth_required') {
            return { ok: false, error: 'reauth_required', status: result }
        }
        return { ok: false, error: 'session_unavailable', status: result }
    }

    async dispose(): Promise<void> {
        if (this.monitorTimer) {
            clearTimeout(this.monitorTimer)
            this.monitorTimer = null
        }

        if (this.activeCheck) {
            await this.activeCheck.catch(() => { })
            this.activeCheck = null
        }

        await this.releaseProfileLock()
    }

    private toPublicStatus(metadata: SessionMetadata): GeminiWebSessionStatus {
        return {
            state: metadata.state,
            lastHealthyAt: metadata.lastHealthyAt,
            lastCheckAt: metadata.lastCheckAt,
            consecutiveFailures: metadata.consecutiveFailures,
            reasonCode: metadata.reasonCode,
            featureEnabled: FEATURE_ENABLED,
            enabled: metadata.enabled,
            enabledAppIds: metadata.enabledAppIds
        }
    }

    private getDisabledActionResult(current: SessionMetadata): DisabledActionResult | null {
        if (!FEATURE_ENABLED) {
            return {
                success: false,
                error: 'feature_disabled',
                status: this.toPublicStatus(current)
            }
        }

        if (!current.enabled) {
            return {
                success: false,
                error: 'error_gws_disabled',
                status: this.toPublicStatus(current)
            }
        }

        return null
    }

    private async ensureProfileDirectory(): Promise<void> {
        await fs.mkdir(this.profileDir, { recursive: true, mode: 0o700 }).catch(() => { })
        await fs.mkdir(this.playwrightProfileDir, { recursive: true, mode: 0o700 }).catch(() => { })
        if (process.platform !== 'win32') {
            await fs.chmod(this.profileDir, 0o700).catch(() => { })
            await fs.chmod(this.playwrightProfileDir, 0o700).catch(() => { })
        }
    }

    private async ensureMetadata(): Promise<void> {
        const metadata = await this.readMetadata()
        await this.metadataManager.write(metadata)
    }

    private async readMetadata(): Promise<SessionMetadata> {
        const raw = await this.metadataManager.read()
        const fallback = createDefaultStatus(
            FEATURE_ENABLED,
            FEATURE_ENABLED ? DEFAULT_USER_ENABLED : false
        )
        return {
            accountHash: typeof raw.accountHash === 'string' ? raw.accountHash : null,
            state: typeof raw.state === 'string' && isSessionState(raw.state) ? raw.state : fallback.state,
            lastHealthyAt: typeof raw.lastHealthyAt === 'string' ? raw.lastHealthyAt : null,
            lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
            consecutiveFailures: Number.isFinite(raw.consecutiveFailures) ? Number(raw.consecutiveFailures) : 0,
            reasonCode: typeof raw.reasonCode === 'string' && isReasonCode(raw.reasonCode) ? raw.reasonCode : fallback.reasonCode,
            featureEnabled: FEATURE_ENABLED,
            enabled: typeof raw.enabled === 'boolean'
                ? (FEATURE_ENABLED ? raw.enabled : false)
                : fallback.enabled,
            enabledAppIds: sanitizeEnabledAppIds(raw.enabledAppIds)
        }
    }

    private async writeStatus(status: GeminiWebSessionStatus, accountHash: string | null): Promise<GeminiWebSessionStatus> {
        const nextMetadata: SessionMetadata = {
            ...status,
            accountHash
        }
        await this.metadataManager.write(nextMetadata)
        return this.toPublicStatus(nextMetadata)
    }

    private resolvePersistentSession(): Session {
        return electronSession.fromPartition(PROFILE_PARTITION)
    }

    private async clearPersistentPartitionData(): Promise<void> {
        const targetSession = this.resolvePersistentSession()
        await clearPersistentPartitionData(targetSession)
    }

    private async clearPlaywrightProfileData(): Promise<void> {
        await fs.rm(this.playwrightProfileDir, { recursive: true, force: true }).catch(() => { })
    }

    private async importExternalCookies(targetSession: Session, cookies: ExternalBrowserCookie[]): Promise<void> {
        await clearGoogleCookies(targetSession)
        for (const cookie of cookies) {
            const payload = buildElectronCookiePayload(cookie)
            if (!payload) continue
            await targetSession.cookies.set(payload).catch(() => {})
        }

        try {
            targetSession.flushStorageData()
        } catch {
            // Ignore flush errors.
        }
    }

    private async performHealthCheck(options: { allowRetry: boolean }): Promise<GeminiWebSessionStatus> {
        if (this.activeCheck) return this.activeCheck

        this.activeCheck = (async () => {
            const currentBeforeCheck = await this.readMetadata()
            if (!FEATURE_ENABLED || !currentBeforeCheck.enabled) {
                return this.toPublicStatus(currentBeforeCheck)
            }

            const lock = await this.acquireProfileLock()
            if (!lock.ok) {
                const current = await this.readMetadata()
                const degradedStatus: GeminiWebSessionStatus = {
                    state: 'degraded',
                    reasonCode: 'unknown',
                    lastCheckAt: nowIso(),
                    lastHealthyAt: current.lastHealthyAt,
                    consecutiveFailures: current.consecutiveFailures,
                    featureEnabled: FEATURE_ENABLED,
                    enabled: current.enabled,
                    enabledAppIds: current.enabledAppIds
                }
                return this.writeStatus(degradedStatus, current.accountHash)
            }

            try {
                const current = await this.readMetadata()
                let firstProbe = await this.runProbeAcrossApps({ interactive: false, timeoutMs: HEALTH_TIMEOUT_MS })
                let accountHash = firstProbe.outcome.healthy ? firstProbe.accountHash : current.accountHash

                // Recovery order:
                // 1. normal probe
                // 2. silent refresh
                // 3. headless Playwright refresh
                // 4. surface reauth-required state to the user if still unhealthy
                if (this.shouldAttemptSilentRefresh(firstProbe.outcome, options.allowRetry)) {
                    const refreshProbe = await this.runSilentRefreshProbe()
                    if (refreshProbe.outcome.healthy) {
                        const healedStatus = applyProbeTransition({
                            previous: current,
                            outcome: refreshProbe.outcome,
                            timestamp: nowIso(),
                            maxConsecutiveFailures: this.config.maxConsecutiveFailures
                        })
                        return this.writeStatus(healedStatus, refreshProbe.accountHash || accountHash)
                    }

                    firstProbe = refreshProbe
                }

                if (this.shouldAttemptPlaywrightHeadlessRefresh(firstProbe.outcome, options.allowRetry)) {
                    const playwrightProbe = await this.runPlaywrightHeadlessRefreshProbe(accountHash)
                    if (playwrightProbe) {
                        firstProbe = playwrightProbe
                        accountHash = firstProbe.outcome.healthy
                            ? (firstProbe.accountHash || accountHash)
                            : accountHash

                        if (firstProbe.outcome.healthy) {
                            const recoveredStatus = applyProbeTransition({
                                previous: current,
                                outcome: firstProbe.outcome,
                                timestamp: nowIso(),
                                maxConsecutiveFailures: this.config.maxConsecutiveFailures
                            })
                            return this.writeStatus(recoveredStatus, accountHash)
                        }
                    }
                }

                const status = applyProbeTransition({
                    previous: current,
                    outcome: firstProbe.outcome,
                    timestamp: nowIso(),
                    maxConsecutiveFailures: this.config.maxConsecutiveFailures
                })
                return this.writeStatus(status, accountHash)
            } finally {
                await this.releaseProfileLock()
            }
        })()

        try {
            return await this.activeCheck
        } finally {
            this.activeCheck = null
        }
    }

    private scheduleMonitor(): void {
        if (!FEATURE_ENABLED) return
        if (this.monitorTimer) clearTimeout(this.monitorTimer)
        const delayMs = this.getJitteredDelay(this.config.checkIntervalMs, this.config.jitterPct)
        this.monitorTimer = setTimeout(async () => {
            try {
                await this.performHealthCheck({ allowRetry: true })
            } catch (error: any) {
                console.error('[GeminiWebSession] Monitor check failed:', error?.message || String(error))
            } finally {
                this.scheduleMonitor()
            }
        }, delayMs)
        this.monitorTimer.unref?.()
    }

    private getJitteredDelay(baseDelay: number, jitterPct: number): number {
        const ratio = Math.max(0, Math.min(jitterPct, 95)) / 100
        const min = baseDelay * (1 - ratio)
        const max = baseDelay * (1 + ratio)
        return Math.floor(min + Math.random() * (max - min))
    }

    private shouldAttemptSilentRefresh(outcome: ProbeOutcome, allowRetry: boolean): boolean {
        if (!allowRetry) return false
        if (outcome.healthy) return false
        if (outcome.kind === 'network' || outcome.kind === 'challenge') return false
        if (outcome.kind !== 'login_redirect' && outcome.kind !== 'unknown') return false

        const now = Date.now()
        if (now - this.lastSilentRefreshAttemptAt < SILENT_REFRESH_COOLDOWN_MS) {
            return false
        }
        return true
    }

    private shouldAttemptPlaywrightHeadlessRefresh(outcome: ProbeOutcome, allowRetry: boolean): boolean {
        if (!allowRetry) return false
        if (outcome.healthy) return false
        if (outcome.kind === 'network' || outcome.kind === 'challenge') return false
        if (outcome.kind !== 'login_redirect' && outcome.kind !== 'unknown') return false

        const now = Date.now()
        if (now - this.lastPlaywrightRefreshAttemptAt < PLAYWRIGHT_HEADLESS_REFRESH_COOLDOWN_MS) {
            return false
        }
        return true
    }

    private async runSilentRefreshProbe(): Promise<ProbeExecutionResult> {
        this.lastSilentRefreshAttemptAt = Date.now()

        const signinProbe = await this.runProbe({
            interactive: false,
            timeoutMs: SILENT_REFRESH_TIMEOUT_MS,
            initialUrl: GOOGLE_SIGNIN_URL
        })
        if (signinProbe.outcome.healthy) return signinProbe

        return this.runProbeAcrossApps({
            interactive: false,
            timeoutMs: HEALTH_TIMEOUT_MS
        })
    }

    private async runPlaywrightHeadlessRefreshProbe(
        previousAccountHash: string | null
    ): Promise<ProbeExecutionResult | null> {
        this.lastPlaywrightRefreshAttemptAt = Date.now()

        const refreshResult = await runPlaywrightHeadlessRefresh({
            profileDir: this.playwrightProfileDir,
            timeoutMs: PLAYWRIGHT_HEADLESS_REFRESH_TIMEOUT_MS
        })

        if (!refreshResult.success) {
            return null
        }

        const targetSession = this.resolvePersistentSession()
        await this.importExternalCookies(targetSession, refreshResult.cookies)

        const verificationProbe = await this.runProbeAcrossApps({ interactive: false, timeoutMs: HEALTH_TIMEOUT_MS })
        return {
            ...verificationProbe,
            accountHash: verificationProbe.outcome.healthy
                ? (verificationProbe.accountHash || refreshResult.accountHash || previousAccountHash)
                : previousAccountHash
        }
    }

    private async runProbeAcrossApps(
        options: { interactive: boolean; timeoutMs: number; initialUrls?: string[] }
    ): Promise<ProbeExecutionResult> {
        const targetUrls = options.initialUrls && options.initialUrls.length > 0
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

            if (!bestFailure || probeSeverity(result.outcome.kind) > probeSeverity(bestFailure.outcome.kind)) {
                bestFailure = result
            }
        }

        return bestFailure || {
            outcome: { kind: 'unknown', healthy: false },
            accountHash: null,
            timedOut: false
        }
    }

    private async runProbe(options: { interactive: boolean; timeoutMs: number; initialUrl?: string }): Promise<ProbeExecutionResult> {
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
                } catch { }
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
                } catch {
                    // Ignore DOM probing errors; caller will classify as unknown.
                }

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
                void win.loadURL(url).catch(() => { })
                return { action: 'deny' }
            })

            const timeoutId = setTimeout(async () => {
                timeoutReached = true
                const result = await classifyCurrent()
                await safeResolve(result)
            }, options.timeoutMs)

            const intervalId = setInterval(async () => {
                if (done) return
                const result = await classifyCurrent()

                if (!options.interactive) {
                    if (result.outcome.healthy) {
                        nonInteractiveHealthyStreak += 1
                        nonInteractiveIssueStreak = 0
                    } else {
                        nonInteractiveIssueStreak += 1
                        nonInteractiveHealthyStreak = 0
                    }

                    if (nonInteractiveHealthyStreak >= 2 || nonInteractiveIssueStreak >= 2 || result.timedOut) {
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
            }, 1500)

            win.on('closed', async () => {
                if (done) return
                const result = await classifyCurrent()
                await safeResolve({
                    ...result,
                    timedOut: true
                })
            })

            void win.loadURL(initialUrl).catch(async (error: any) => {
                hasNetworkError = true
                console.error('[GeminiWebSession] Probe load failed:', error?.message || String(error))
                const result = await classifyCurrent()
                await safeResolve(result)
            })
        })
    }

    private async readAccountHash(profileSession: Session): Promise<string | null> {
        const cookieNames = ['__Secure-1PSID', 'SID', 'SAPISID']
        for (const name of cookieNames) {
            try {
                const cookies = await profileSession.cookies.get({ name })
                const target = cookies.find(cookie => cookie.domain?.includes('google.com'))
                if (target?.value) {
                    return createHash('sha256').update(target.value).digest('hex').slice(0, 16)
                }
            } catch {
                continue
            }
        }
        return null
    }

    private async acquireProfileLock(): Promise<LockResult> {
        if (this.lockHandle) {
            this.lockDepth += 1
            return { ok: true }
        }

        await this.ensureProfileDirectory()

        const tryAcquire = async (): Promise<LockResult> => {
            try {
                this.lockHandle = await fs.open(this.lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_RDWR)
                this.lockDepth = 1
                await this.lockHandle.writeFile(JSON.stringify({ pid: process.pid, createdAt: nowIso() }), 'utf8')
                return { ok: true }
            } catch (error: any) {
                if (error?.code !== 'EEXIST') {
                    return { ok: false, error: 'lock_error' }
                }
                return { ok: false, error: 'already_in_use' }
            }
        }

        const first = await tryAcquire()
        if (first.ok || first.error !== 'already_in_use') return first

        try {
            const lockRaw = await fs.readFile(this.lockPath, 'utf8')
            const parsed = JSON.parse(lockRaw) as { pid?: number }
            if (!parsed?.pid || !isProcessAlive(parsed.pid)) {
                await fs.rm(this.lockPath, { force: true })
                return tryAcquire()
            }
        } catch {
            await fs.rm(this.lockPath, { force: true }).catch(() => { })
            return tryAcquire()
        }

        return first
    }

    private async releaseProfileLock(): Promise<void> {
        if (!this.lockHandle) return

        this.lockDepth -= 1
        if (this.lockDepth > 0) return

        try {
            await this.lockHandle.close()
        } catch { }

        this.lockHandle = null
        this.lockDepth = 0
        await fs.rm(this.lockPath, { force: true }).catch(() => { })
    }
}

export const geminiWebSessionManager = new GeminiWebSessionManager()
