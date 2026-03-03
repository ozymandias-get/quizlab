import { app, webContents, type Session } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { ExternalBrowserCookie } from './playwrightLogin'

export const PROFILE_PARTITION = 'persist:gemini_web_profile'

export async function clearGoogleCookies(targetSession: Session): Promise<void> {
    const existingCookies = await targetSession.cookies.get({})

    for (const cookie of existingCookies) {
        if (!cookie.domain?.includes('google.com')) continue

        const host = cookie.domain.replace(/^\./, '')
        const cookiePath = cookie.path || '/'
        const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookiePath}`
        await targetSession.cookies.remove(url, cookie.name).catch(() => { })
    }
}

export async function importExternalCookies(targetSession: Session, cookies: ExternalBrowserCookie[]): Promise<void> {
    await clearGoogleCookies(targetSession)

    for (const cookie of cookies) {
        if (!cookie.domain || !cookie.name) continue
        if (!cookie.domain.includes('google.com')) continue

        const host = cookie.domain.replace(/^\./, '')
        const cookiePath = cookie.path || '/'
        const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookiePath}`

        const payload: Electron.CookiesSetDetails = {
            url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookiePath,
            secure: !!cookie.secure,
            httpOnly: !!cookie.httpOnly
        }

        if (typeof cookie.expires === 'number' && cookie.expires > 0) {
            payload.expirationDate = cookie.expires
        }

        if (cookie.sameSite === 'Lax') payload.sameSite = 'lax'
        if (cookie.sameSite === 'Strict') payload.sameSite = 'strict'
        if (cookie.sameSite === 'None') payload.sameSite = 'no_restriction'

        await targetSession.cookies.set(payload).catch(() => { })
    }

    try {
        targetSession.flushStorageData()
    } catch {
        // Ignore flush errors.
    }
}

export async function ensurePartitionStoragePath(targetSession: Session): Promise<void> {
    const sessionStoragePath = (targetSession as Session & { storagePath?: string }).storagePath
    const partitionName = PROFILE_PARTITION.replace(/^persist:/, '')
    const fallbackPartitionPath = path.join(app.getPath('userData'), 'Partitions', partitionName)

    if (typeof sessionStoragePath === 'string' && sessionStoragePath.trim()) {
        await fs.mkdir(sessionStoragePath, { recursive: true }).catch(() => { })
    }

    await fs.mkdir(fallbackPartitionPath, { recursive: true }).catch(() => { })
}

export async function detachPartitionWebContents(targetSession: Session): Promise<void> {
    const contents = webContents
        .getAllWebContents()
        .filter(item => !item.isDestroyed() && item.session === targetSession)

    await Promise.all(contents.map(item => item.loadURL('about:blank').catch(() => { })))
}

export async function clearPersistentPartitionData(targetSession: Session): Promise<void> {
    await detachPartitionWebContents(targetSession)

    await clearGoogleCookies(targetSession).catch(() => { })
    await targetSession.clearStorageData().catch(() => { })
    await targetSession.clearAuthCache().catch(() => { })
    await targetSession.clearCache().catch(() => { })

    try {
        targetSession.flushStorageData()
    } catch {
        // Ignore flush errors.
    }
    await ensurePartitionStoragePath(targetSession)
}
