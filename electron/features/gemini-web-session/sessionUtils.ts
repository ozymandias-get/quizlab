import { createHash } from 'crypto'

type GoogleAccountCookie = {
  domain?: string | null
  name: string
  value?: string | null
}

export const GOOGLE_ACCOUNT_HASH_COOKIE_NAMES = ['__Secure-1PSID', 'SID', 'SAPISID'] as const

export function nowIso(): string {
  return new Date().toISOString()
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    // PID responds — verify it's actually our app, not a different process
    // that recycled this PID.  EPERM would mean a process owned by another
    // user (e.g. root) happens to have this PID, so we treat it as stale.
    return true
  } catch (error: unknown) {
    const errCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined
    // ESRCH = no such process (safe to treat as stale)
    if (errCode === 'ESRCH') return false
    // EPERM = process exists but belongs to another user — treat as stale
    // because the PID was recycled by a different (non-our) process.
    if (errCode === 'EPERM') return false
    // Any other error — assume alive to be safe
    return true
  }
}

export function computeGoogleAccountHash(cookies: GoogleAccountCookie[]): string | null {
  for (const name of GOOGLE_ACCOUNT_HASH_COOKIE_NAMES) {
    const target = cookies.find(
      (cookie) => cookie.name === name && cookie.domain?.includes('google.com')
    )
    if (target?.value) {
      return createHash('sha256').update(target.value).digest('hex').slice(0, 16)
    }
  }

  return null
}
