import { createHash } from 'crypto'

type GoogleAccountCookie = {
    domain?: string | null
    name: string
    value?: string | null
}

const GOOGLE_ACCOUNT_HASH_COOKIE_NAMES = ['__Secure-1PSID', 'SID', 'SAPISID'] as const

export function nowIso(): string {
    return new Date().toISOString()
}

export function isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
        process.kill(pid, 0)
        return true
    } catch (error: any) {
        return error?.code === 'EPERM'
    }
}

export function computeGoogleAccountHash(cookies: GoogleAccountCookie[]): string | null {
    for (const name of GOOGLE_ACCOUNT_HASH_COOKIE_NAMES) {
        const target = cookies.find((cookie) => cookie.name === name && cookie.domain?.includes('google.com'))
        if (target?.value) {
            return createHash('sha256').update(target.value).digest('hex').slice(0, 16)
        }
    }

    return null
}
