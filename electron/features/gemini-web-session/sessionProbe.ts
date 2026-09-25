import { BrowserWindow, type Session, type WebContents, webContents } from 'electron'

import {
  GOOGLE_AI_WEB_APPS,
  PRIMARY_GOOGLE_AI_WEB_APP
} from '../../../shared/constants/googleAiWebApps.js'
import { HEALTH_TIMEOUT_MS } from './sessionConfig.js'
import type { ProbeExecutionResult } from './sessionContracts.js'
import { computeGoogleAccountHash } from './sessionUtils.js'

const AUTH_COOKIE_NAMES = new Set([
  'SID',
  'HSID',
  'SSID',
  'LSID',
  'APISID',
  'SAPISID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Secure-1PSIDTS',
  '__Secure-3PSIDTS',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC',
  '__Host-GAPS'
])
const APP_HOSTS = new Set(GOOGLE_AI_WEB_APPS.map((app) => app.hostname))
const CHALLENGE_HOSTS = new Set(['challenge.google.com', 'sorry.google.com'])
const LOGIN_HOSTS = new Set(['accounts.google.com'])
const LOGIN_PATH_PATTERN =
  /^\/(servicelogin|v3\/signin(?:\/|$)|checkcookie(?:\/|$)|interactivelogin(?:\/|$)|o\/oauth2(?:\/|$))/i

function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isLoginUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return (
      LOGIN_HOSTS.has(parsed.hostname.toLowerCase()) && LOGIN_PATH_PATTERN.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

function isAllowedProbeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    return (
      hostname === 'google.com' ||
      hostname === 'accounts.google.com' ||
      APP_HOSTS.has(hostname) ||
      hostname.endsWith('.google.com')
    )
  } catch {
    return false
  }
}

function isProbeContent(contents: WebContents): boolean {
  try {
    return isAllowedProbeUrl(contents.getURL())
  } catch {
    return false
  }
}

function isGoogleCookieDomain(domain: string | null | undefined): boolean {
  if (!domain) return false
  const normalized = domain.toLowerCase()
  return normalized === 'google.com' || normalized.endsWith('.google.com')
}

function isExpiredCookie(cookie: Electron.Cookie): boolean {
  return (
    typeof cookie.expirationDate === 'number' &&
    cookie.expirationDate > 0 &&
    cookie.expirationDate <= Date.now() / 1000
  )
}

async function readCookies(targetSession: Session): Promise<Electron.Cookie[]> {
  try {
    return await targetSession.cookies.get({})
  } catch {
    return []
  }
}

function classifyProbe(
  url: string,
  cookies: Electron.Cookie[],
  networkError: boolean,
  timedOut: boolean
): ProbeExecutionResult {
  if (networkError) {
    return { outcome: { kind: 'network', healthy: false }, accountHash: null, timedOut }
  }

  const hostname = getHostname(url)
  if (CHALLENGE_HOSTS.has(hostname)) {
    return { outcome: { kind: 'challenge', healthy: false }, accountHash: null, timedOut }
  }

  if (isLoginUrl(url)) {
    return { outcome: { kind: 'login_redirect', healthy: false }, accountHash: null, timedOut }
  }

  const authCookies = cookies.filter(
    (cookie) =>
      AUTH_COOKIE_NAMES.has(cookie.name) &&
      isGoogleCookieDomain(cookie.domain) &&
      !isExpiredCookie(cookie)
  )
  if (authCookies.length === 0) {
    return { outcome: { kind: 'login_redirect', healthy: false }, accountHash: null, timedOut }
  }

  if (APP_HOSTS.has(hostname) || hostname === 'google.com' || hostname.endsWith('.google.com')) {
    return {
      outcome: { kind: 'authenticated', healthy: true },
      accountHash: computeGoogleAccountHash(authCookies),
      timedOut
    }
  }

  return { outcome: { kind: 'unknown', healthy: false }, accountHash: null, timedOut }
}

interface LoadWaitResult {
  loaded: boolean
  timedOut: boolean
}

function waitForReload(contents: WebContents, signal?: AbortSignal): Promise<LoadWaitResult> {
  return new Promise((resolve) => {
    let settled = false
    let timeoutReached = false
    let timer: ReturnType<typeof setTimeout>

    const cleanup = () => {
      clearTimeout(timer)
      contents.removeListener('did-finish-load', onLoaded)
      contents.removeListener('did-stop-loading', onLoaded)
      contents.removeListener('did-fail-load', onFailed)
      signal?.removeEventListener('abort', onAborted)
    }
    const finish = (loaded: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ loaded, timedOut: timeoutReached })
    }
    const onLoaded = () => finish(true)
    const onFailed = () => finish(false)
    const onAborted = () => finish(false)
    const onTimeout = () => {
      timeoutReached = true
      finish(false)
    }

    contents.on('did-finish-load', onLoaded)
    contents.on('did-stop-loading', onLoaded)
    contents.on('did-fail-load', onFailed)
    signal?.addEventListener('abort', onAborted, { once: true })
    timer = setTimeout(onTimeout, HEALTH_TIMEOUT_MS)
    timer.unref?.()

    try {
      contents.reload()
    } catch {
      finish(false)
    }
  })
}

function waitForLoad(promise: Promise<unknown>, signal?: AbortSignal): Promise<LoadWaitResult> {
  return new Promise((resolve) => {
    let settled = false
    let timeoutReached = false
    let timer: ReturnType<typeof setTimeout>

    const finish = (loaded: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAborted)
      resolve({ loaded, timedOut: timeoutReached })
    }
    const onAborted = () => finish(false)
    const onTimeout = () => {
      timeoutReached = true
      finish(false)
    }

    signal?.addEventListener('abort', onAborted, { once: true })
    timer = setTimeout(onTimeout, HEALTH_TIMEOUT_MS)
    timer.unref?.()
    promise.then(
      () => finish(true),
      () => finish(false)
    )
  })
}

export async function probePersistentSession(
  targetSession: Session,
  signal?: AbortSignal
): Promise<ProbeExecutionResult> {
  const existingContents =
    typeof webContents.getAllWebContents === 'function'
      ? webContents
          .getAllWebContents()
          .filter(
            (contents) =>
              !contents.isDestroyed() &&
              contents.session === targetSession &&
              isProbeContent(contents)
          )
      : []

  let finalUrl = PRIMARY_GOOGLE_AI_WEB_APP.url
  let timedOut = false
  let networkError = false

  if (existingContents.length > 0) {
    const results = await Promise.all(
      existingContents.map((contents) => waitForReload(contents, signal))
    )
    timedOut = results.some((result) => result.timedOut)
    networkError = results.length > 0 && results.every((result) => !result.loaded)
    try {
      finalUrl = existingContents[0].getURL() || finalUrl
    } catch {}
  } else {
    const probeWindow = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        session: targetSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        backgroundThrottling: false
      }
    })

    try {
      probeWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      probeWindow.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedProbeUrl(url)) event.preventDefault()
      })
      const loadResult = await waitForLoad(probeWindow.loadURL(finalUrl), signal)
      timedOut = loadResult.timedOut && !signal?.aborted
      networkError = !loadResult.loaded && !signal?.aborted
      try {
        finalUrl = probeWindow.webContents.getURL() || finalUrl
      } catch {}
    } catch {
      networkError = !signal?.aborted
    } finally {
      if (!probeWindow.isDestroyed()) probeWindow.destroy()
    }
  }

  const cookies = await readCookies(targetSession)
  return classifyProbe(finalUrl, cookies, networkError, timedOut)
}
