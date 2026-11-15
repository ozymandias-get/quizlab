import { app, net } from 'electron'

import { failure, success } from '../../shared/lib/typedIpc.js'
import type { UpdateCheckResult } from '../../shared/types/system.js'
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
/**
 * The check that is currently running.
 *
 * A second request while the network call is in flight joins this promise
 * instead of receiving an early `{ available: false, cached: true }`, which
 * the UI would treat as a completed negative result.
 */
let pendingCheck: Promise<UpdateCheckResult> | null = null
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

async function getLatestRelease(): Promise<LatestReleaseResult> {
  const { OWNER, REPO } = APP_CONFIG.GITHUB
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    let response: globalThis.Response
    try {
      response = await globalThis.fetch(url, {
        headers: {
          'User-Agent': `Electron-App/${app.getVersion()}`, // Generic UA to avoid GitHub blocking
          Accept: 'application/vnd.github.v3+json'
        },
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      Logger.warn(`[Updater] Fetch failed: ${response.status} ${response.statusText}`)
      return { error: `HTTP ${response.status}` }
    }

    return parseReleasePayload(await response.json())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Logger.warn(`[Updater] Network error:`, message)

    // Fallback path must be time-bounded too: an unbounded request that
    // neither responds nor errors would leave the IPC handler (and the
    // `isChecking` guard) stuck forever, disabling update checks.
    return new Promise((resolve) => {
      let settled = false
      const settle = (result: LatestReleaseResult) => {
        if (settled) return
        settled = true
        clearTimeout(fallbackTimeoutId)
        resolve(result)
      }

      const request = net.request(url)
      const fallbackTimeoutId = setTimeout(() => {
        try {
          request.abort()
        } catch {
          // Request may already be destroyed.
        }
        settle({ error: 'Fallback request timed out' })
      }, 12000)

      request.setHeader('User-Agent', `Electron-App/${app.getVersion()}`)
      request.on('response', (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => {
          try {
            if (response.statusCode !== 200) {
              settle({ error: `HTTP ${response.statusCode}` })
            } else {
              settle(parseReleasePayload(JSON.parse(data)))
            }
          } catch {
            settle({ error: 'Parse error' })
          }
        })
      })
      request.on('error', (error) => {
        settle({ error: error.message })
      })
      request.end()
    })
  }
}

async function runUpdateCheck(): Promise<UpdateCheckResult> {
  try {
    const latest = await getLatestRelease()

    if ('error' in latest) {
      Logger.warn('[Updater] Check failed:', latest.error)
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
    const message =
      catastrophicError instanceof Error ? catastrophicError.message : String(catastrophicError)
    Logger.error('[Updater] Catastrophic error:', message)
    return { available: false, error: message }
  }
}

export function initUpdater() {
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.CHECK_FOR_UPDATES,
    async (_event) => {
      const now = Date.now()
      if (!pendingCheck && now - lastCheckTime < CHECK_DEBOUNCE_MS && updateInfo) {
        return success({
          available: true,
          version: updateInfo.version,
          releaseNotes: updateInfo.body,
          cached: true
        })
      }

      if (!pendingCheck) {
        lastCheckTime = now
        pendingCheck = runUpdateCheck().finally(() => {
          pendingCheck = null
        })
      }

      const check = pendingCheck
      return success(await check)
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Unauthorized')
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
