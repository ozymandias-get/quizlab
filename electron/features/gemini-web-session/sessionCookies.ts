import { app, webContents, type Session } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/google-ai-web-apps'
import type { ExternalBrowserCookie } from './playwrightLogin'
import { PROFILE_PARTITION } from './sessionConfig'

const MANAGED_GOOGLE_COOKIE_HOSTS = Array.from(
  new Set([
    'google.com',
    'accounts.google.com',
    'myaccount.google.com',
    ...GOOGLE_AI_WEB_APPS.map((app) => app.hostname)
  ])
)

function normalizeCookieDomain(domain: string | null | undefined): string | null {
  if (typeof domain !== 'string') return null
  const normalized = domain.trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

function isGoogleCookieDomain(domain: string | null | undefined): boolean {
  const normalized = normalizeCookieDomain(domain)
  return normalized?.includes('google.com') ?? false
}

async function clearGoogleCookies(targetSession: Session): Promise<void> {
  const existingCookies = await targetSession.cookies.get({})

  for (const cookie of existingCookies) {
    if (!isGoogleCookieDomain(cookie.domain)) continue

    const host = normalizeCookieDomain(cookie.domain)?.replace(/^\./, '')
    if (!host) continue
    const cookiePath = cookie.path || '/'
    const candidateHosts = new Set<string>([
      host,
      ...MANAGED_GOOGLE_COOKIE_HOSTS.filter(
        (candidateHost) =>
          candidateHost === host ||
          candidateHost.endsWith(`.${host}`) ||
          host.endsWith(`.${candidateHost}`)
      )
    ])

    for (const candidateHost of candidateHosts) {
      const secureSchemes = cookie.secure ? ['https'] : ['https', 'http']
      for (const scheme of secureSchemes) {
        const url = `${scheme}://${candidateHost}${cookiePath}`
        await targetSession.cookies.remove(url, cookie.name).catch(() => {})
      }
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
    payload.expirationDate = cookie.expires
  }

  return payload
}

export async function importExternalCookies(
  targetSession: Session,
  cookies: ExternalBrowserCookie[]
): Promise<void> {
  await clearGoogleCookies(targetSession)

  for (const cookie of cookies) {
    const payload = buildElectronCookiePayload(cookie)
    if (!payload) continue
    await targetSession.cookies.set(payload).catch(() => {})
  }

  try {
    targetSession.flushStorageData()
  } catch {}
}

async function ensurePartitionStoragePath(targetSession: Session): Promise<void> {
  const sessionStoragePath = (targetSession as Session & { storagePath?: string }).storagePath
  const partitionName = PROFILE_PARTITION.replace(/^persist:/, '')
  const fallbackPartitionPath = path.join(app.getPath('userData'), 'Partitions', partitionName)

  if (typeof sessionStoragePath === 'string' && sessionStoragePath.trim()) {
    await fs.mkdir(sessionStoragePath, { recursive: true }).catch(() => {})
  }

  await fs.mkdir(fallbackPartitionPath, { recursive: true }).catch(() => {})
}

async function detachPartitionWebContents(targetSession: Session): Promise<void> {
  const contents = webContents
    .getAllWebContents()
    .filter((item) => !item.isDestroyed() && item.session === targetSession)

  await Promise.all(contents.map((item) => item.loadURL('about:blank').catch(() => {})))
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
