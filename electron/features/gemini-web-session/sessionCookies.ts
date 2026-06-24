import { app, type Session, webContents } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/google-ai-web-apps.js'
import { Logger } from '../../core/logger.js'
import { PROFILE_PARTITION } from './sessionConfig.js'

interface ExternalBrowserCookie {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'Unspecified'
  expires?: number
}

const MANAGED_GOOGLE_COOKIE_HOSTS = new Set([
  'google.com',
  'accounts.google.com',
  'myaccount.google.com',
  'googleapis.com',
  ...GOOGLE_AI_WEB_APPS.map((app) => app.hostname)
])

const ALLOWED_GOOGLE_HOSTS = new Set([
  ...MANAGED_GOOGLE_COOKIE_HOSTS,
  'mail.google.com',
  'drive.google.com'
])

function normalizeCookieDomain(domain: string | null | undefined): string | null {
  if (typeof domain !== 'string') return null
  const normalized = domain.trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

function isGoogleCookieDomain(domain: string | null | undefined): boolean {
  const normalized = normalizeCookieDomain(domain)
  if (!normalized) return false
  return normalized === 'google.com' || normalized.endsWith('.google.com')
}

async function clearGoogleCookies(targetSession: Session): Promise<void> {
  const existingCookies = await targetSession.cookies.get({})

  for (const cookie of existingCookies) {
    if (!isGoogleCookieDomain(cookie.domain)) continue

    const host = normalizeCookieDomain(cookie.domain)?.replace(/^\./, '')
    if (!host) continue

    // Only clear cookies for known Google hosts — exact match only
    // to prevent accidental deletion of non-Google domains like "my-google.com"
    if (!ALLOWED_GOOGLE_HOSTS.has(host)) continue

    const cookiePath = cookie.path || '/'
    const secureSchemes = cookie.secure ? ['https'] : ['https', 'http']
    for (const scheme of secureSchemes) {
      const url = `${scheme}://${host}${cookiePath}`
      await targetSession.cookies.remove(url, cookie.name).catch(() => {})
    }
  }
}

function normalizeSameSite(
  sameSite: ExternalBrowserCookie['sameSite']
): Electron.CookiesSetDetails['sameSite'] {
  if (sameSite === 'Lax') return 'lax'
  if (sameSite === 'Strict') return 'strict'
  if (sameSite === 'None') return 'no_restriction'
  return 'unspecified'
}

function buildElectronCookiePayload(
  cookie: ExternalBrowserCookie
): Electron.CookiesSetDetails | null {
  const domain = normalizeCookieDomain(cookie.domain)
  const name = typeof cookie.name === 'string' ? cookie.name.trim() : ''
  if (!domain || !name || !isGoogleCookieDomain(domain)) return null

  const host = domain.replace(/^\./, '')
  if (!host) return null
  const cookiePath = cookie.path || '/'
  const payload: Electron.CookiesSetDetails = {
    url: `${cookie.secure ? 'https' : 'http'}://${host}${cookiePath}`,
    name,
    value: cookie.value,
    path: cookiePath,
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: normalizeSameSite(cookie.sameSite)
  }

  // Electron normalizes explicit domains with a leading dot, which turns
  // host-only cookies into domain cookies. Preserve host-only cookies by
  // omitting `domain` unless the source cookie was already scoped broadly.
  if (domain.startsWith('.')) {
    payload.domain = domain
  }

  if (Number.isFinite(cookie.expires) && typeof cookie.expires === 'number' && cookie.expires > 0) {
    // Normalize seconds vs milliseconds: Unix timestamps in seconds
    // are ~1.5B-2B (year 2020-2035). Millisecond timestamps would be
    // ~1.5T-2T. If the value is > 1e12 (year 5138+), it's likely ms.
    const expires =
      cookie.expires > 1e12 ? Math.floor(cookie.expires / 1000) : Math.floor(cookie.expires)
    payload.expirationDate = expires
  }

  return payload
}

const CRITICAL_COOKIE_NAMES = new Set([
  'SID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Secure-1PSIDTS',
  '__Secure-3PSIDTS',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC'
])

export async function importExternalCookies(
  targetSession: Session,
  cookies: ExternalBrowserCookie[]
): Promise<void> {
  const incomingByName = new Map<string, ExternalBrowserCookie>()
  const failedCriticalCookies: string[] = []

  for (const cookie of cookies) {
    const payload = buildElectronCookiePayload(cookie)
    if (!payload) continue
    incomingByName.set(`${cookie.name}::${cookie.domain}::${cookie.path}`, cookie)
    await targetSession.cookies.set(payload).catch((error: unknown) => {
      if (CRITICAL_COOKIE_NAMES.has(cookie.name)) {
        failedCriticalCookies.push(cookie.name)
      }
      Logger.warn(
        `[SessionCookies] Failed to set cookie "${cookie.name}" for ${cookie.domain}:`,
        error instanceof Error ? error.message : String(error)
      )
    })
  }

  if (failedCriticalCookies.length > 0) {
    Logger.warn(
      `[SessionCookies] ${failedCriticalCookies.length} critical cookie(s) failed to import: ${failedCriticalCookies.join(', ')}`
    )
  }

  const existingCookies = await targetSession.cookies.get({}).catch(() => [])
  for (const existing of existingCookies) {
    if (!isGoogleCookieDomain(existing.domain)) continue
    const key = `${existing.name}::${existing.domain}::${existing.path || '/'}`
    if (incomingByName.has(key)) continue

    const host = normalizeCookieDomain(existing.domain)?.replace(/^\./, '')
    if (!host) continue
    const cookiePath = existing.path || '/'
    const secureSchemes = existing.secure ? ['https'] : ['https', 'http']
    for (const scheme of secureSchemes) {
      const url = `${scheme}://${host}${cookiePath}`
      await targetSession.cookies.remove(url, existing.name).catch(() => {})
    }
  }

  try {
    targetSession.flushStorageData()
  } catch {}
}

/**
 * Partition'ın diskteki storage yolunu döndürür.
 *
 * Electron `persist:` partition'ları için storage yolu deterministiktir:
 *   <userData>/Partitions/<partitionName>
 *
 * Session.storagePath (Electron 28+ resmi API) ile doğrulama yapılır,
 * fakat asıl yol her zaman manuel hesaplanır — bu, Electron sürümleri
 * arasında tutarlılığı garanti eder.
 *
 * https://electronjs.org/docs/api/session#sessionstoragepath
 */
function resolvePartitionStoragePath(partitionName: string): string {
  return path.join(app.getPath('userData'), 'Partitions', partitionName)
}

async function ensurePartitionStoragePath(targetSession: Session): Promise<void> {
  const partitionName = PROFILE_PARTITION.replace(/^persist:/, '')
  const resolvedPath = resolvePartitionStoragePath(partitionName)

  // Session.storagePath ile doğrulama (public API, Electron 28+)
  if (
    targetSession.storagePath &&
    targetSession.storagePath !== resolvedPath &&
    process.env.NODE_ENV === 'development'
  ) {
    Logger.warn(
      `[SessionCookies] Session.storagePath mismatch: ` +
        `expected="${resolvedPath}", actual="${targetSession.storagePath}". ` +
        `Using resolved path.`
    )
  }

  await fs.mkdir(resolvedPath, { recursive: true })
}

async function detachPartitionWebContents(targetSession: Session): Promise<void> {
  const contents = webContents
    .getAllWebContents()
    .filter((wc) => !wc.isDestroyed() && wc.session === targetSession)

  await Promise.all(contents.map((wc) => wc.loadURL('about:blank').catch(() => {})))
}

export async function clearPersistentPartitionData(targetSession: Session): Promise<void> {
  await detachPartitionWebContents(targetSession)

  await clearGoogleCookies(targetSession).catch(() => {})
  await targetSession.clearStorageData().catch(() => {})
  await targetSession.clearAuthCache().catch(() => {})
  await targetSession.clearCache().catch(() => {})

  try {
    targetSession.flushStorageData()
  } catch {}
  await ensurePartitionStoragePath(targetSession)
}
