import type { ChromeExtensionCookie } from '@shared-core/types'

export function toExternalBrowserCookie(cookie: ChromeExtensionCookie): {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'Unspecified'
  expires?: number
} {
  const sameSiteMap: Record<string, 'Strict' | 'Lax' | 'None' | 'Unspecified'> = {
    strict: 'Strict',
    lax: 'Lax',
    no_restriction: 'None'
  }
  const ss = cookie.sameSite
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: ss ? sameSiteMap[ss] : undefined,
    expires: cookie.expires
  }
}
