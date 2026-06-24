import { app, net, shell } from 'electron'

import { failure, success } from '../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../app/constants.js'
import { requireTrustedIpcSender } from './ipcSecurity.js'
import { Logger } from './logger.js'
import { registerIpcHandler } from './typedIpcMain.js'

type LatestRelease = {
  version: string
  body: string
  htmlUrl?: string
  releaseName?: string
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

  const cleanRemote = remote.replace(/^v/, '').split('+')[0]
  const cleanCurrent = current.replace(/^v/, '').split('+')[0]

  const r = cleanRemote.split('.').map((num) => parseInt(num, 10))
  const c = cleanCurrent.split('.').map((num) => parseInt(num, 10))

  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rVal = isNaN(r[i]) ? 0 : r[i]
    const cVal = isNaN(c[i]) ? 0 : c[i]

    if (rVal > cVal) return true
    if (rVal < cVal) return false
  }
  return false
}

type ReleasePayload = {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
}

function parseReleasePayload(raw: unknown): LatestReleaseResult {
  const release = raw as ReleasePayload
  if (!release || !release.tag_name) {
    return { error: 'Invalid release data' }
  }
  return {
    version: release.tag_name,
    releaseName: release.name || release.tag_name,
    body: release.body || 'New version available.',
    htmlUrl: release.html_url
  }
}

/**
 * Fetch latest release from GitHub
 */
async function getLatestRelease(): Promise<LatestReleaseResult> {
  const { OWNER, REPO } = APP_CONFIG.GITHUB
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await globalThis.fetch(url, {
      headers: {
        'User-Agent': `Electron-App/${app.getVersion()}`, // Generic UA to avoid GitHub blocking
        Accept: 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      Logger.warn(`[Updater] Fetch failed: ${response.status} ${response.statusText}`)
      return { error: `HTTP ${response.status}` }
    }

    return parseReleasePayload(await response.json())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Logger.warn(`[Updater] Network error:`, message)

    return new Promise((resolve) => {
      const request = net.request(url)
      request.setHeader('User-Agent', `Electron-App/${app.getVersion()}`)
      request.on('response', (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => {
          try {
            if (response.statusCode !== 200) {
              resolve({ error: `HTTP ${response.statusCode}` })
            } else {
              resolve(parseReleasePayload(JSON.parse(data)))
            }
          } catch {
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
}

/**
 * Initialize Updater IPC
 */
export function initUpdater() {
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.CHECK_FOR_UPDATES,
    async (event) => {
      if (isChecking) return success({ available: !!updateInfo, cached: true })

      const now = Date.now()
      if (now - lastCheckTime < CHECK_DEBOUNCE_MS && updateInfo) {
        return success({
          available: true,
          version: updateInfo.version,
          releaseNotes: updateInfo.body,
          cached: true
        })
      }

      isChecking = true
      lastCheckTime = now

      try {
        const latest = await getLatestRelease()

        if ('error' in latest) {
          Logger.warn('[Updater] Check failed:', latest.error)
          return success({ available: false, error: latest.error })
        }

        const currentVersion = app.getVersion()
        if (isNewer(latest.version, currentVersion)) {
          updateInfo = latest
          return success({
            available: true,
            version: latest.version,
            releaseNotes: latest.body || ''
          })
        }

        updateInfo = null
        return success({ available: false })
      } catch (catastrophicError) {
        const message =
          catastrophicError instanceof Error ? catastrophicError.message : String(catastrophicError)
        Logger.error('[Updater] Catastrophic error:', message)
        return success({ available: false, error: message })
      } finally {
        isChecking = false
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Unauthorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.OPEN_RELEASES,
    async () => {
      const { GITHUB } = APP_CONFIG
      const { OWNER, REPO } = GITHUB
      const url = updateInfo?.htmlUrl || `https://github.com/${OWNER}/${REPO}/releases/latest`
      await shell.openExternal(url)
      return success(true)
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_APP_VERSION,
    () => {
      return success(app.getVersion())
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
