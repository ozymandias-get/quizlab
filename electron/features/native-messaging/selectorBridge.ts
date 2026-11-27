/**
 * The two bridge routes of the magic selector transfer.
 *
 * They share the bridge's origin, environment, profile and HMAC rules but
 * nothing else with the cookie packets: the site catalogue is read from the
 * platform registry, the transfer has its own body limit, and a pick never
 * touches the cookie rounds or the session queue.
 *
 * Replay handling is deliberately narrow. A request id is remembered only after
 * the signature proved the caller holds the pairing code, and only for an
 * outcome that is deterministic (stored, refused, malformed). "The site is not
 * open" and "verification failed" are *not* remembered: the user may open the
 * site and send the very same pick again, and that retry has to be processed.
 */
import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'

import type { SelectorSitesResponse } from '../../../shared/constants/selectorTransfer.js'
import {
  isSelectorRequestId,
  MAX_SELECTOR_BODY_SIZE,
  MAX_SELECTOR_READ_SIZE,
  MAX_SELECTOR_REQUEST_IDS,
  SELECTOR_REQUEST_ID_HEADER,
  SELECTOR_REQUEST_TTL_MS,
  SELECTOR_SITES_PATH,
  SELECTOR_TRANSFER_PATH,
  SELECTOR_TRANSFER_VERSION,
  selectorSitesSigningPayload,
  selectorTransferSigningPayload
} from '../../../shared/constants/selectorTransfer.js'
import { APP_CONFIG } from '../../app/constants.js'
import { Logger } from '../../core/logger.js'
import type { SelectorIngestResult, SelectorLiveView } from '../ai/selectorIngest.js'
import type { SelectorSiteTarget } from '../ai/selectorTargets.js'

/** The success answer of a stored pick. */
const STATUS_PICK_TOO_LARGE = 413

let ingestSelector: ((raw: unknown) => Promise<SelectorIngestResult>) | null = null

interface RequestProfile {
  id: string | undefined
  name: string
}

/** What the routes need from the bridge manager. */
interface SelectorBridgeManager {
  _sharedSecret: string
  markExtensionSeen?: (profileId?: string, profileName?: string) => void
  markExtensionPaired?: (profileId?: string) => void | Promise<void>
}

/** The request ids this bridge has answered deterministically. */
const seenRequestIds = new Map<string, number>()

function pruneRequestIds(now: number): void {
  for (const [key, at] of seenRequestIds) {
    if (now - at <= SELECTOR_REQUEST_TTL_MS) continue
    seenRequestIds.delete(key)
  }
  // A long-running app must not grow this map without a bound.
  if (seenRequestIds.size <= MAX_SELECTOR_REQUEST_IDS) return
  const ordered = [...seenRequestIds.entries()].sort((left, right) => left[1] - right[1])
  for (const [key] of ordered.slice(0, seenRequestIds.size - MAX_SELECTOR_REQUEST_IDS)) {
    seenRequestIds.delete(key)
  }
}

function isSeen(profileId: string, requestId: string, now: number): boolean {
  pruneRequestIds(now)
  return seenRequestIds.has(`${profileId}\n${requestId}`)
}

function rememberRequest(profileId: string, requestId: string, now: number): void {
  seenRequestIds.set(`${profileId}\n${requestId}`, now)
  pruneRequestIds(now)
}

/** Whether a signature matches the payload it is supposed to cover. */
function isValidSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected.toLowerCase()),
    Buffer.from(signature.toLowerCase())
  )
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Reads a bounded JSON body and hands it back as a string. */
function readBoundedBody(
  req: IncomingMessage,
  res: ServerResponse
): Promise<{ body: string } | { tooLarge: true }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    let oversized = false

    const finish = (value: { body: string } | { tooLarge: true }) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    req.on('data', (chunk: Buffer) => {
      if (settled) return
      if (chunk.length > MAX_SELECTOR_READ_SIZE - size) {
        // Nothing past the read budget is kept or hashed; the answer is final.
        oversized = true
        chunks.length = 0
        sendJson(res, STATUS_PICK_TOO_LARGE, { error: 'packet_too_large' })
        req.socket?.end()
        finish({ tooLarge: true })
        return
      }
      const remaining = Math.max(0, MAX_SELECTOR_BODY_SIZE - size)
      if (remaining > 0) {
        chunks.push(remaining >= chunk.length ? chunk : Buffer.from(chunk.subarray(0, remaining)))
      }
      size += chunk.length
    })
    req.on('error', () => finish({ tooLarge: true }))
    req.on('end', () => {
      if (settled) return
      if (oversized || size > MAX_SELECTOR_BODY_SIZE) {
        sendJson(res, STATUS_PICK_TOO_LARGE, { error: 'packet_too_large' })
        finish({ tooLarge: true })
        return
      }
      finish({ body: Buffer.concat(chunks).toString('utf8') })
    })
  })
}

/** Announces the write, so the renderer drops its cached selectors at once. */
function broadcastConfigChanged(hostname: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue
    window.webContents.send(APP_CONFIG.IPC_CHANNELS.AI_CONFIG_CHANGED, hostname)
  }
}

async function getIngest(): Promise<(raw: unknown) => Promise<SelectorIngestResult>> {
  if (ingestSelector) return ingestSelector
  const [{ createSelectorIngest }, targets, aiConfig, aiView] = await Promise.all([
    import('../ai/selectorIngest.js'),
    import('../ai/selectorTargets.js'),
    import('../ai/aiConfigHandlers.js'),
    import('../ai-view/aiWebContentsViewManager.js')
  ])

  /**
   * The managed Electron view of a site, or null when the site is not open.
   *
   * The exact host wins; a view on a sibling host of the same site is accepted
   * because the ingestion re-checks the site identity and stores under the
   * view's own host.
   */
  const findViewForSite = (site: SelectorSiteTarget): SelectorLiveView | null => {
    let fallback: SelectorLiveView | null = null
    for (const viewId of aiView.listManagedAiViewIds()) {
      const url = aiView.getAiViewUrl(viewId)
      if (!url) continue
      let host: string
      try {
        host = new URL(url).hostname.toLowerCase()
      } catch {
        continue
      }
      if (!targets.hostBelongsToSelectorSite(host, site)) continue
      const candidate = { viewId, url }
      if (host === site.hostname) return candidate
      if (!fallback) fallback = candidate
    }
    return fallback
  }

  ingestSelector = createSelectorIngest({
    loadSites: targets.buildSelectorSiteTargets,
    readConfigs: aiConfig.readAiConfigMap,
    savePatch: aiConfig.saveAiConfigPatch,
    findViewForSite: async (site) => findViewForSite(site),
    executeScript: (viewId, script) => aiView.executeAiViewScript(viewId, script),
    broadcastConfigChanged
  })
  return ingestSelector
}

/**
 * Answers the selector site catalogue.
 *
 * The signature is checked against the path, exactly like the site session
 * list. The profile is registered only after the code is proven, so a forged
 * Origin header cannot add a profile.
 */
async function handleSelectorSites(
  req: IncomingMessage,
  res: ServerResponse,
  manager: SelectorBridgeManager,
  profile: RequestProfile
): Promise<void> {
  const profileId = profile.id
  if (!profileId) {
    sendJson(res, 400, { error: 'Missing profile id' })
    return
  }
  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (!isValidSignature(selectorSitesSigningPayload(profileId), signature, manager._sharedSecret)) {
    Logger.warn('[NativeMessaging] Rejected selector site list request: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }
  manager.markExtensionSeen?.(profile.id, profile.name)
  await manager.markExtensionPaired?.(profile.id)

  try {
    const [targets, aiConfig] = await Promise.all([
      import('../ai/selectorTargets.js'),
      import('../ai/aiConfigHandlers.js')
    ])
    const [sites, configs] = await Promise.all([
      targets.buildSelectorSiteTargets(),
      aiConfig.readAiConfigMap().catch(() => ({}))
    ])
    const payload: SelectorSitesResponse = {
      version: SELECTOR_TRANSFER_VERSION,
      sites: sites.map((site) => {
        const status = targets.statusOfSite(site, configs)
        return {
          siteId: site.siteId,
          displayName: site.displayName,
          hostname: site.hostname,
          hosts: site.hosts,
          fields: site.fields,
          ...(status ? { status } : {})
        }
      })
    }
    sendJson(res, 200, payload)
  } catch (error) {
    Logger.error('[NativeMessaging] Failed to build the selector site list:', error)
    sendJson(res, 500, { error: 'Internal error' })
  }
}

/** Answers one picked element: verified and stored, or refused with a reason. */
async function handleSelectorTransfer(
  req: IncomingMessage,
  res: ServerResponse,
  manager: SelectorBridgeManager,
  profile: RequestProfile
): Promise<void> {
  const profileId = profile.id
  if (!profileId) {
    sendJson(res, 400, { error: 'Missing profile id' })
    return
  }
  const requestIdHeader = req.headers[SELECTOR_REQUEST_ID_HEADER as never]
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader
  if (!isSelectorRequestId(requestId)) {
    sendJson(res, 400, { error: 'invalid_request_id' })
    return
  }

  const read = await readBoundedBody(req, res)
  if ('tooLarge' in read) return
  const body = read.body

  const signature = req.headers['x-hmac-signature' as never] as string | undefined
  if (
    !isValidSignature(
      selectorTransferSigningPayload(profileId, requestId, body),
      signature,
      manager._sharedSecret
    )
  ) {
    Logger.warn('[NativeMessaging] Rejected selector transfer: invalid signature')
    sendJson(res, 401, { error: 'Invalid signature' })
    return
  }

  // Proven to come from a paired extension; only now may the profile change.
  manager.markExtensionSeen?.(profile.id, profile.name)
  await manager.markExtensionPaired?.(profile.id)

  const now = Date.now()
  if (isSeen(profileId, requestId, now)) {
    // A retry of a request that already reached a deterministic answer. The
    // extension treats this as "the first attempt landed".
    sendJson(res, 409, { error: 'duplicate_request', retryable: false })
    return
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body)
  } catch {
    rememberRequest(profileId, requestId, now)
    sendJson(res, 400, { error: 'invalid_payload', reason: 'malformed_json' })
    return
  }

  const ingest = await getIngest()
  const outcome = await ingest(parsedBody)
  switch (outcome.status) {
    case 'saved':
      rememberRequest(profileId, requestId, now)
      sendJson(res, 200, {
        status: 'saved',
        saved: true,
        hostname: outcome.hostname,
        field: outcome.field
      })
      return
    case 'invalid_payload':
      rememberRequest(profileId, requestId, now)
      if (outcome.reason === 'hostname_url_mismatch') {
        sendJson(res, 403, { error: 'host_mismatch' })
        return
      }
      sendJson(res, 400, { error: 'invalid_payload', reason: outcome.reason })
      return
    case 'unknown_site':
      rememberRequest(profileId, requestId, now)
      sendJson(res, 403, { error: 'unknown_site' })
      return
    case 'site_not_open':
      // Not remembered: opening the site and sending the same pick again is the
      // documented way forward.
      sendJson(res, 409, { error: 'site_not_open', retryable: true })
      return
    case 'verification_failed':
      // Not remembered either: the DOM may settle, and a retry is harmless
      // because nothing was written.
      sendJson(res, 422, { error: 'verification_failed', reason: outcome.reason })
      return
    case 'save_failed':
      sendJson(res, 500, { error: 'save_failed' })
      return
  }
}

/**
 * Routes the selector endpoints.
 *
 * Called after the bridge's origin and environment checks; returns false when
 * the request is not a selector one, so the cookie router keeps its own paths.
 * The answers are written asynchronously, so the flag is returned immediately.
 */
export function handleSelectorBridgeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: unknown,
  profile: RequestProfile
): boolean {
  const pathname = (req.url || '').split('?')[0]
  if (pathname !== SELECTOR_SITES_PATH && pathname !== SELECTOR_TRANSFER_PATH) return false
  const bridgeManager = manager as SelectorBridgeManager

  if (pathname === SELECTOR_SITES_PATH) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return true
    }
    void handleSelectorSites(req, res, bridgeManager, profile)
    return true
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return true
  }
  void handleSelectorTransfer(req, res, bridgeManager, profile)
  return true
}
