import type { DisplayMediaRequestHandlerHandlerRequest, Streams } from 'electron'
import { BrowserWindow, desktopCapturer, session } from 'electron'

import { markPartitionActive } from '../../core/cacheRegistry.js'
import { Logger } from '../../core/logger.js'
import { registerCustomPlatformOriginsAtStartup } from '../../features/ai/customPlatformOriginStartup.js'
import {
  registerAccountPartitionFor,
  registerSiteSessionPartitions
} from '../../features/web-session/siteSessionAccounts.js'
import type { SiteSessionTargetRow } from '../../features/web-session/siteSessionTargets.js'
import { APP_CONFIG } from '../constants.js'
import { showDisplayMediaPicker } from '../displayMediaPicker.js'
import { resolveWebPermission } from './permissionConsent.js'
import {
  APP_SESSION_PARTITION,
  evaluateWebPermission,
  listManagedAiPartitions,
  type WebPermissionRequest
} from './permissionPolicy.js'

export type MainWindowResolver = () => BrowserWindow | null

/**
 * Embedded remote views (AI Studio, etc.) need the main process to resolve getDisplayMedia via
 * desktopCapturer; granting the session "display-capture" permission alone is not enough.
 */
async function handleDisplayMediaRequest(
  request: DisplayMediaRequestHandlerHandlerRequest,
  callback: (streams: Streams) => void,
  getMainWindow: MainWindowResolver
): Promise<void> {
  // Electron invokes the permission callback exactly once. Wrapping it in a
  // try/catch would let the catch block call it a second time when the first
  // call throws, so the "answer exactly once" decision is made up front and
  // every later failure just falls through to the single pending answer.
  let answered = false
  const answerOnce = (streams: Streams): void => {
    if (answered) return
    answered = true
    callback(streams)
  }

  if (!request.videoRequested) {
    answerOnce({})
    return
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    })
    if (sources.length === 0) {
      answerOnce({})
      return
    }

    let picked: (typeof sources)[0]
    // Always show the picker, even with a single source: selecting the only
    // available screen silently would capture the whole screen without the
    // user ever consenting.
    const parent = BrowserWindow.getFocusedWindow() ?? getMainWindow()
    const pickedIndex = await showDisplayMediaPicker(parent, sources)
    if (pickedIndex === null || pickedIndex < 0 || pickedIndex >= sources.length) {
      answerOnce({})
      return
    }
    picked = sources[pickedIndex]

    answerOnce({
      video: { id: picked.id, name: picked.name }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.error('[Sessions] Display media request handler error:', message)
    answerOnce({})
  }
}

let sessionsConfigured = false
const configuredAiPartitions = new Set<string>()

const defaultMainWindowResolver: MainWindowResolver = () => BrowserWindow.getFocusedWindow()

/** Chromium reports the requesting frame; anything unusable falls back to a deny. */
function toPolicyRequest(
  partition: string,
  permission: string,
  details: { requestingUrl?: string; requestingOrigin?: string; isMainFrame?: boolean } | undefined
): WebPermissionRequest {
  return {
    partition,
    permission,
    requestingUrl: details?.requestingUrl,
    requestingOrigin: details?.requestingOrigin,
    isMainFrame: details?.isMainFrame
  }
}

/**
 * Attaches the shared policy to a session.
 *
 * Both handlers delegate to {@link evaluateWebPermission}; the only difference
 * is that a request may pause for user consent while a check must answer
 * synchronously. Chromium consults the check handler before some Web APIs
 * (Geolocation in particular), so answering only requests would leave those
 * paths unguarded.
 */
function applyPermissionPolicy(
  targetSession: Electron.Session,
  partition: string,
  getMainWindow: MainWindowResolver
): void {
  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const request = toPolicyRequest(partition, permission, details)
    const decision = evaluateWebPermission(request)
    if (!decision.requiresConsent) {
      if (!decision.granted) {
        Logger.warn(
          `[Sessions] Denied ${permission} in ${partition} ` +
            `(origin: ${request.requestingOrigin ?? 'unknown'}, reason: ${decision.reason})`
        )
      }
      callback(decision.granted)
      return
    }
    void resolveWebPermission(request, decision, getMainWindow).then(callback)
  })

  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const request = toPolicyRequest(partition, permission, {
      requestingOrigin,
      requestingUrl: details?.requestingUrl,
      isMainFrame: details?.isMainFrame ?? true
    })
    // A synchronous handler cannot show UI. A capability that still needs
    // consent is reported as not-yet-permitted; the check passes once
    // resolveWebPermission has recorded the user's decision.
    return evaluateWebPermission(request).granted
  })
}

export function setupAiSession(
  partition: string,
  getMainWindow: MainWindowResolver = defaultMainWindowResolver
): void {
  if (configuredAiPartitions.has(partition)) return

  const aiSession = session.fromPartition(partition)
  const partitionKey = partition.replace('persist:', '')
  markPartitionActive(partitionKey)

  aiSession.webRequest.onBeforeSendHeaders((details, callback) => {
    markPartitionActive(partitionKey)
    details.requestHeaders['User-Agent'] = APP_CONFIG.CHROME_USER_AGENT
    callback({ requestHeaders: details.requestHeaders })
  })

  applyPermissionPolicy(aiSession, partition, getMainWindow)

  aiSession.setDisplayMediaRequestHandler((request, callback) => {
    void handleDisplayMediaRequest(request, callback, getMainWindow)
  })

  configuredAiPartitions.add(partition)
}

/**
 * Registers a partition the app just minted for a new account.
 *
 * The registrar is handed to the composition root, which sets it on the
 * account code; the account code cannot import this module without closing a
 * cycle. The session setup is the app's own, with the same handlers every
 * static partition gets.
 */
export function registerSiteSessionAccount(site: SiteSessionTargetRow, accountId: string): void {
  registerAccountPartitionFor(site, accountId, setupAiSession)
}

export async function setupSessions(getMainWindow: MainWindowResolver): Promise<void> {
  if (sessionsConfigured) return

  try {
    const defaultSession = session.defaultSession
    if (defaultSession) {
      applyPermissionPolicy(defaultSession, APP_SESSION_PARTITION, getMainWindow)
    }

    const aiPartitions = new Set<string>(listManagedAiPartitions())

    for (const partition of aiPartitions) {
      setupAiSession(partition, getMainWindow)
    }

    // The registry-derived sessions above are configured first: the account
    // partitions are dynamic, so only the call below can register them with
    // the policy, cache registry and their own session — in that order, and
    // never before the static ones. The session setup is handed in because
    // the account module must not import this one.
    await registerSiteSessionPartitions(setupAiSession)
    await registerCustomPlatformOriginsAtStartup(setupAiSession)

    sessionsConfigured = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.error(`[Sessions] Error:`, message)
  }
}
