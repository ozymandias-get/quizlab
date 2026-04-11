import { GOOGLE_AI_WEB_APP_URLS, GOOGLE_SIGNIN_URL } from './constants'
import type { BrowserContextLike } from './playwrightBrowserContext'

export const SESSION_COOKIE_SOURCE_URLS = Array.from(
  new Set([
    ...GOOGLE_AI_WEB_APP_URLS,
    GOOGLE_SIGNIN_URL,
    'https://www.google.com',
    'https://myaccount.google.com'
  ])
)

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

export async function collectSessionCookies(
  context: BrowserContextLike
): Promise<ExternalBrowserCookie[]> {
  const cookiesRaw = await context.cookies(SESSION_COOKIE_SOURCE_URLS)
  if (!Array.isArray(cookiesRaw)) return []
  return mapContextCookies(cookiesRaw)
}
