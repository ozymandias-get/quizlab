import { app, ipcMain, shell, net } from 'electron'
import { APP_CONFIG } from '../main/constants'
import fetch from 'cross-fetch'

// Local state
type LatestRelease = {
    version: string;
    body: string;
    htmlUrl?: string;
    releaseName?: string;
}

type LatestReleaseResult = LatestRelease | { error: string }

let updateInfo: LatestRelease | null = null
let isChecking = false
let lastCheckTime = 0
const CHECK_DEBOUNCE_MS = 5000

/**
 * Semver comparison helper
 */
function isNewer(remote: string, current: string): boolean {
    if (!remote || !current) return false

    // Remove 'v' prefix and any build metadata (+...)
    const cleanRemote = remote.replace(/^v/, '').split('+')[0]
    const cleanCurrent = current.replace(/^v/, '').split('+')[0]

    const r = cleanRemote.split('.').map(num => parseInt(num, 10))
    const c = cleanCurrent.split('.').map(num => parseInt(num, 10))

    // Compare major, minor, patch
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rVal = isNaN(r[i]) ? 0 : r[i]
        const cVal = isNaN(c[i]) ? 0 : c[i]

        if (rVal > cVal) return true
        if (rVal < cVal) return false
    }
    return false
}

/**
 * Fetch latest release from GitHub
 */
async function getLatestRelease(): Promise<LatestReleaseResult> {
    const { OWNER, REPO } = APP_CONFIG.GITHUB
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`

    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        // Attempt 1: Try with cross-fetch (standard)
        const response = await fetch(url, {
            headers: {
                'User-Agent': `Electron-App/${app.getVersion()}`, // Generic UA to avoid GitHub blocking
                'Accept': 'application/vnd.github.v3+json'
            },
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            console.warn(`[Updater] Fetch failed: ${response.status} ${response.statusText}`)
            return { error: `HTTP ${response.status}` }
        }

        const release = await response.json() as { tag_name?: string; name?: string; body?: string; html_url?: string }

        // Validate response structure
        if (!release || !release.tag_name) {
            return { error: 'Invalid release data' }
        }

        return {
            version: release.tag_name,
            releaseName: release.name || release.tag_name,
            body: release.body || 'New version available.',
            htmlUrl: release.html_url
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[Updater] Network error:`, message)

        // Attempt 2: Fallback to Electron's native 'net' module (if fetch fails due to proxy/env issues)
        if (message && (message.includes('fetch') || message.includes('network'))) {
            return new Promise((resolve) => {
                const request = net.request(url)
                request.setHeader('User-Agent', `Electron-App/${app.getVersion()}`)
                request.on('response', (response) => {
                    let data = ''
                    response.on('data', (chunk) => { data += chunk })
                    response.on('end', () => {
                        try {
                            if (response.statusCode !== 200) {
                                resolve({ error: `HTTP ${response.statusCode}` })
                            } else {
                                const release = JSON.parse(data) as { tag_name?: string; name?: string; body?: string; html_url?: string }
                                if (!release.tag_name) {
                                    resolve({ error: 'Invalid release data' })
                                    return
                                }
                                resolve({
                                    version: release.tag_name,
                                    releaseName: release.name || release.tag_name,
                                    body: release.body || 'New version available.',
                                    htmlUrl: release.html_url
                                })
                            }
                        } catch (e) {
                            resolve({ error: 'Parse error' })
                        }
                    })
                })
                request.on('error', (error) => {
                    resolve({ error: error.message })
                })
                request.end()
            })
        }

        return { error: message }
    }
}

/**
 * Initialize Updater IPC
 */
export function initUpdater() {
    const { IPC_CHANNELS } = APP_CONFIG

    ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
        if (isChecking) return { available: !!updateInfo, cached: true }

        const now = Date.now()
        // Cache geçerlilik süresini kontrol et
        if (now - lastCheckTime < CHECK_DEBOUNCE_MS && updateInfo) {
            return {
                available: true,
                version: updateInfo.version,
                releaseNotes: updateInfo.body,
                cached: true
            }
        }

        isChecking = true
        lastCheckTime = now

        try {
            const latest = await getLatestRelease()

            if ('error' in latest) {
                console.warn('[Updater] Check failed:', latest.error)
                return { available: false, error: latest.error }
            }

            const currentVersion = app.getVersion()
            if (isNewer(latest.version, currentVersion)) {
                updateInfo = latest
                return {
                    available: true,
                    version: latest.version,
                    releaseNotes: latest.body || ''
                }
            }

            updateInfo = null
            return { available: false }
        } catch (catastrophicError) {
            const message = catastrophicError instanceof Error ? catastrophicError.message : String(catastrophicError)
            console.error('[Updater] Catastrophic error:', message)
            return { available: false, error: message }
        } finally {
            isChecking = false
        }
    })

    ipcMain.handle(IPC_CHANNELS.OPEN_RELEASES, async () => {
        const { OWNER, REPO } = APP_CONFIG.GITHUB
        const url = updateInfo?.htmlUrl || `https://github.com/${OWNER}/${REPO}/releases`
        await shell.openExternal(url)
    })

    ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion())
}
