/**
 * The site session bridge of the Quizlab Reader Chrome extension.
 *
 * The extension does not know which sites the app wants: it asks the app over
 * the loopback bridge, reads the cookies of the sites the app names and hands
 * them over — one packet per site.
 *
 * The bridge is a plain HTTP server in the app, so every request carries the
 * extension's origin and a signature over its own body. The app decides what
 * to do with a packet; this side only reads cookies and never writes them.
 *
 * MV3 service workers are killed after ~30s of inactivity and every module
 * level variable resets with them. Everything the worker has to remember
 * between two runs therefore lives in `chrome.storage.session`, and the
 * reconnect is driven by the alarm system rather than by a timer.
 */

const BRIDGE_HOST = '127.0.0.1'
const PORT_START = 51999
const PORT_END = 52009
const SCAN_INTERVAL_MS = 30000
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
/**
 * The app has to learn about a switch the user just flipped within 30 seconds,
 * and 30 seconds is the shortest period `chrome.alarms` accepts.
 */
const POLL_INTERVAL_MIN = 0.5
const PROTOCOL_VERSION = 2
const HEALTH_PATH = '/api/health'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'
const STORAGE_KEYS = [
  'bridgeSecret',
  'lastConfigVersion',
  'knownTargets',
  'bridgePort',
  'pendingSiteIds',
  'outdatedState',
  'tooLargeSiteIds'
]

/** The sync with the app went through. */
const SYNC_OK = 'ok'
/** The bridge did not answer at all. */
const SYNC_UNREACHABLE = 'unreachable'
/** The bridge answered but refused a packet. */
const SYNC_REFUSED = 'refused'

/** The app took the packet. */
const PACKET_SENT = 'sent'
/** The app refused the packet because it was too large to read. */
const PACKET_TOO_LARGE = 'too_large'
/** The app refused the packet for another reason. */
const PACKET_REFUSED = 'refused'
/** The request never reached the app. */
const PACKET_UNREACHABLE = 'unreachable'

let connected = false
let cookieDebounceTimer = null
let bridgeSecret = null
let lastConfigVersion = null
let knownTargets = []
/** The port the bridge was last seen on. */
let bridgePort = null
/** The sites whose packet the app refused; they are pushed again. */
let pendingSiteIds = new Set()
/** The sites whose packet did not fit into the app; they are not pushed again. */
let tooLargeSiteIds = new Set()
/** The state the app was last told about while it speaks an older protocol. */
let outdatedState = null
/** What the last push sent, so that the same state is not sent twice. */
let lastPush = null
let pendingSend = Promise.resolve(SYNC_OK)

async function computeHmac(body, secret) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const bodyData = encoder.encode(body)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, bodyData)
  const hashArray = [...new Uint8Array(signature)]
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function errorMessage(error) {
  if (error && typeof error.message === 'string') return error.message
  return String(error)
}

function getExtensionOrigin() {
  try {
    return `chrome-extension://${chrome.runtime.id}`
  } catch {
    return ''
  }
}

/** The headers every request to the bridge carries. */
function baseHeaders() {
  const headers = { 'x-protocol-version': String(PROTOCOL_VERSION) }
  const origin = getExtensionOrigin()
  if (origin) headers['Origin'] = origin
  return headers
}

/** The storage area the state survives a service worker restart in. */
function storageArea() {
  try {
    return chrome.storage.session || chrome.storage.local || null
  } catch {
    return null
  }
}

function normalizeTargets(value) {
  if (!Array.isArray(value)) return []
  const targets = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const siteId = typeof entry.siteId === 'string' ? entry.siteId.trim() : ''
    if (!siteId) continue
    const domains = Array.isArray(entry.cookieDomains)
      ? entry.cookieDomains.filter(
          (domain) => typeof domain === 'string' && domain.trim().length > 0
        )
      : []
    targets.push({ siteId, cookieDomains: domains })
  }
  return targets
}

/**
 * The state of the last run.
 *
 * A restarted worker would otherwise believe that the app had changed its
 * configuration and would push its cookies on every single poll.
 */
async function readPersistedState() {
  const area = storageArea()
  if (!area) return
  try {
    const stored = await area.get(STORAGE_KEYS)
    if (!stored) return
    if (typeof stored.bridgeSecret === 'string' && stored.bridgeSecret) {
      bridgeSecret = stored.bridgeSecret
    }
    if (typeof stored.lastConfigVersion === 'number') {
      lastConfigVersion = stored.lastConfigVersion
    }
    if (Array.isArray(stored.knownTargets)) {
      knownTargets = normalizeTargets(stored.knownTargets)
    }
    if (typeof stored.bridgePort === 'number') {
      bridgePort = stored.bridgePort
    }
    if (Array.isArray(stored.pendingSiteIds)) {
      pendingSiteIds = new Set(stored.pendingSiteIds.filter((id) => typeof id === 'string'))
    }
    if (Array.isArray(stored.tooLargeSiteIds)) {
      tooLargeSiteIds = new Set(stored.tooLargeSiteIds.filter((id) => typeof id === 'string'))
    }
    if (typeof stored.outdatedState === 'string') {
      outdatedState = stored.outdatedState
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The saved state could not be read:', errorMessage(error))
  }
  // The wake-up listens for the sites of the saved list until the app names
  // its own list.
  applyWakeUpFilter()
}

async function persistState(values) {
  const area = storageArea()
  if (!area) return
  try {
    await area.set(values)
  } catch (error) {
    console.warn('[Quizlab Bridge] The state could not be saved:', errorMessage(error))
  }
}

const stateReady = readPersistedState()

/**
 * Asks the app which sites it wants cookies for.
 *
 * The answer is signed like every other request: the app hands the secret to
 * the paired extension over the health endpoint, and the site list is only
 * given to a caller that proves it holds that secret.
 */
async function fetchSiteList(port) {
  try {
    const headers = baseHeaders()
    if (bridgeSecret) {
      headers['x-hmac-signature'] = await computeHmac(SITE_LIST_PATH, bridgeSecret)
    }
    const response = await fetch(`http://${BRIDGE_HOST}:${port}${SITE_LIST_PATH}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The site list request on port',
        port,
        'answered with',
        response.status
      )
      return null
    }
    const data = await response.json()
    if (!data || typeof data !== 'object') return null

    const protocolVersion = typeof data.protocolVersion === 'number' ? data.protocolVersion : 0
    const targets = normalizeTargets(data.targets)
    if (protocolVersion < PROTOCOL_VERSION) {
      // The app speaks an older protocol: it cannot read the per-site packets,
      // so no site may be treated as readable.
      console.warn(
        '[Quizlab Bridge] The app speaks the protocol',
        protocolVersion,
        'and cannot read the per-site packets'
      )
      return { protocolVersion, configVersion: 0, targets, outdated: true }
    }
    return {
      protocolVersion,
      configVersion: typeof data.configVersion === 'number' ? data.configVersion : 0,
      targets,
      outdated: false
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The site list request failed:', errorMessage(error))
    return null
  }
}

/**
 * The health endpoint of the bridge.
 *
 * It answers with the shared secret and with the protocol the app speaks. A
 * port that does not answer is simply not the bridge, so a failed request is
 * not worth a warning.
 */
async function fetchHealth(port) {
  try {
    const response = await fetch(`http://${BRIDGE_HOST}:${port}${HEALTH_PATH}`, {
      method: 'GET',
      headers: baseHeaders(),
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The health check on port',
        port,
        'answered with',
        response.status
      )
      return null
    }
    const data = await response.json()
    if (!data || typeof data.secret !== 'string' || !data.secret) return null
    return data
  } catch {
    return null
  }
}

async function rememberSecret(secret) {
  if (secret === bridgeSecret) return
  bridgeSecret = secret
  await persistState({ bridgeSecret: secret })
}

/** The identity of a cookie: host, name, path and scope. */
function cookieIdentity(cookie) {
  const domain = typeof cookie.domain === 'string' ? cookie.domain.trim().toLowerCase() : ''
  const host = domain.replace(/^\.+/, '')
  const scope = domain.startsWith('.') ? 'domain' : 'host'
  const name = typeof cookie.name === 'string' ? cookie.name : ''
  const path = typeof cookie.path === 'string' && cookie.path ? cookie.path : '/'
  return `${host}::${name}::${path}::${scope}`
}

/**
 * The spellings a domain has to be queried with.
 *
 * Chrome matches the domain attribute of a cookie exactly: a query for
 * `.chatgpt.com` returns the domain-wide cookies of the site and nothing else.
 * The host-only cookies of the same site only come back when the host is
 * queried without the leading dot. Both spellings are therefore always asked
 * for — a domain that is written without a leading dot still has a
 * domain-wide spelling.
 */
function domainSpellings(domain) {
  const trimmed = typeof domain === 'string' ? domain.trim().toLowerCase() : ''
  const host = trimmed.replace(/^\.+/, '')
  if (!host) return []
  return trimmed.startsWith('.') ? [trimmed, host] : [host, `.${host}`]
}

async function readCookies(domain) {
  try {
    const found = await chrome.cookies.getAll({ domain })
    return Array.isArray(found) ? found : []
  } catch (error) {
    console.warn(
      '[Quizlab Bridge] The cookies of',
      domain,
      'could not be read:',
      errorMessage(error)
    )
    return []
  }
}

/**
 * Whether the extension may read a host at all.
 *
 * A check that fails is a check that did not pass: a throwing permissions API
 * means that the permission could not be proven, not that it is there.
 */
async function containsAnyOrigin(patterns) {
  for (const pattern of patterns) {
    try {
      if (await chrome.permissions.contains({ origins: [pattern] })) return true
    } catch (error) {
      console.warn(
        '[Quizlab Bridge] The permission of',
        pattern,
        'could not be read:',
        errorMessage(error)
      )
      return false
    }
  }
  return false
}

/**
 * Whether the extension may read the site.
 *
 * A site the extension may not read is reported as such, so that the app can
 * tell it apart from a site the browser simply holds no session for.
 */
async function hasPermission(domains) {
  if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') {
    // Without the permissions API the host permissions of the manifest are
    // the answer, and they are granted when the extension is installed.
    return true
  }
  for (const domain of domains) {
    const host = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/^\.+/, '') : ''
    if (!host) continue
    const granted = await containsAnyOrigin([`https://${host}/*`, `https://*.${host}/*`])
    if (!granted) return false
  }
  return true
}

/** The SameSite values Chrome reports and the app accepts. */
const SAME_SITE_VALUES = new Set(['unspecified', 'no_restriction', 'lax', 'strict'])

/**
 * A cookie in the shape the app reads it.
 *
 * The app refuses a whole packet when one of its cookies does not fit, so
 * every field falls back to a value the app knows instead of travelling as
 * `undefined`.
 */
function normalizeCookie(cookie) {
  const sameSite = typeof cookie.sameSite === 'string' ? cookie.sameSite : ''
  return {
    name: typeof cookie.name === 'string' ? cookie.name : '',
    value: typeof cookie.value === 'string' ? cookie.value : '',
    domain: typeof cookie.domain === 'string' ? cookie.domain : '',
    path: typeof cookie.path === 'string' && cookie.path ? cookie.path : '/',
    secure: cookie.secure === true,
    httpOnly: cookie.httpOnly === true,
    sameSite: SAME_SITE_VALUES.has(sameSite) ? sameSite : 'unspecified',
    expires:
      typeof cookie.expirationDate === 'number' ? Math.floor(cookie.expirationDate) : undefined
  }
}

/**
 * The packet of one site.
 *
 * A packet carries the cookies of a single site, because the app refuses a
 * packet that carries the cookie of another one.
 *
 * A site the extension may not read *completely* is reported as such even when
 * some of its cookies were read: the app would otherwise import the session it
 * could see and delete the cookies of the domain it could not.
 */
async function collectTargetPacket(target) {
  const collected = new Map()
  for (const domain of target.cookieDomains) {
    for (const spelling of domainSpellings(domain)) {
      const found = await readCookies(spelling)
      for (const cookie of found) {
        collected.set(cookieIdentity(cookie), cookie)
      }
    }
  }

  const cookies = [...collected.values()]
  const permitted = await hasPermission(target.cookieDomains)
  if (!permitted) {
    return { targetId: target.siteId, status: 'permission_missing', cookies: [] }
  }
  if (cookies.length > 0) {
    return { targetId: target.siteId, status: 'ok', cookies: cookies.map(normalizeCookie) }
  }
  return { targetId: target.siteId, status: 'no_cookies', cookies: [] }
}

/**
 * Sends the packet of one site to the app.
 *
 * The answer of the app is told apart in four ways: the app took the packet,
 * the app refused it, the app refused it because it was too large to read, or
 * the request never reached the app. The last one is the only one that says
 * nothing about the packet itself.
 */
async function postPacket(packet, port) {
  try {
    const body = JSON.stringify(packet)
    const headers = {
      'Content-Type': 'application/json',
      'x-protocol-version': String(PROTOCOL_VERSION)
    }
    const origin = getExtensionOrigin()
    if (origin) headers['Origin'] = origin
    if (bridgeSecret) {
      headers['x-hmac-signature'] = await computeHmac(body, bridgeSecret)
    }

    const response = await fetch(`http://${BRIDGE_HOST}:${port}${COOKIE_PATH}`, {
      method: 'POST',
      headers,
      body
    })
    if (response.status === 413) {
      // The packet is bigger than the app reads: it can never be imported, so
      // it is not sent again.
      return PACKET_TOO_LARGE
    }
    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The app refused the packet of',
        packet.targetId,
        'with',
        response.status
      )
      return PACKET_REFUSED
    }
    return PACKET_SENT
  } catch (error) {
    console.warn(
      '[Quizlab Bridge] The packet of',
      packet.targetId,
      'could not be sent:',
      errorMessage(error)
    )
    return PACKET_UNREACHABLE
  }
}

/** The fingerprint of a target list: what the app asked for, and nothing else. */
function targetsFingerprint(targets) {
  return targets
    .map((target) => `${target.siteId}:${[...target.cookieDomains].sort().join(',')}`)
    .sort()
    .join('|')
}

/** Whether a domain belongs to one of the domains of a target. */
function domainIsCovered(domains, domain) {
  const host = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/^\.+/, '') : ''
  if (!host) return false
  return domains.some((allowed) => {
    const allowedHost =
      typeof allowed === 'string' ? allowed.trim().toLowerCase().replace(/^\.+/, '') : ''
    if (!allowedHost) return false
    return host === allowedHost || host.endsWith(`.${allowedHost}`)
  })
}

function targetCoversDomain(target, domain) {
  return domainIsCovered(target.cookieDomains, domain)
}

function isKnownDomain(domain) {
  return knownTargets.some((target) => targetCoversDomain(target, domain))
}

/**
 * Whether this state was already pushed to this bridge.
 *
 * The app only has to be told once: a second push of the same state would
 * rewrite every session of the app for nothing.
 */
function statePushedTo(list, fingerprint) {
  return (
    lastPush !== null &&
    lastPush.secret === bridgeSecret &&
    lastPush.configVersion === list.configVersion &&
    lastPush.fingerprint === fingerprint
  )
}

/**
 * Sends one packet per site.
 *
 * A site whose packet the app refused is remembered: it is pushed again with
 * the next poll, because the app may have refused it for a reason that is
 * gone by then.
 *
 * A site whose packet did not fit into the app is remembered as well, but the
 * other way round: it is not pushed again, because a packet that is too large
 * stays too large.
 */
async function pushTargets(targets, port) {
  let refused = false
  for (const target of targets) {
    if (tooLargeSiteIds.has(target.siteId)) continue
    const packet = await collectTargetPacket(target)
    const outcome = await postPacket(packet, port)
    if (outcome === PACKET_SENT) {
      pendingSiteIds.delete(target.siteId)
    } else if (outcome === PACKET_TOO_LARGE) {
      pendingSiteIds.delete(target.siteId)
      tooLargeSiteIds.add(target.siteId)
      // The state did not reach the app entirely, so the app has to be told
      // about it again when it asks for something new.
      refused = true
      console.warn(
        '[Quizlab Bridge] The packet of',
        target.siteId,
        'is too large for the app; it is not pushed again'
      )
    } else {
      pendingSiteIds.add(target.siteId)
      refused = true
    }
    // Only the site, the domains, the outcome and the count are logged. A
    // cookie value never reaches the log.
    console.log(
      `[Quizlab Bridge] ${target.siteId} (${target.cookieDomains.join(', ')}): ` +
        `${packet.status}, ${packet.cookies.length} cookies`
    )
  }
  return refused
}

/**
 * Tells the app that the sites cannot be read at all.
 *
 * The app speaks an older protocol, so it cannot read the packets anyway. The
 * state is reported once and not on every poll: a report per poll would be a
 * packet every 30 seconds for an app that will never understand them.
 *
 * The state is marked as reported only after the report went through: a
 * report that never reached the app is lost otherwise, and the user is never
 * told to reload the extension.
 */
async function reportOutdatedOnce(list, port) {
  const key = `${list.protocolVersion}:${targetsFingerprint(list.targets)}`
  if (outdatedState === key) return
  let delivered = true
  for (const target of list.targets) {
    const outcome = await postPacket(
      { targetId: target.siteId, status: 'permission_missing', cookies: [] },
      port
    )
    // The app answers with a refusal: it does not understand the packet. The
    // report still went through, so it is not repeated.
    if (outcome === PACKET_UNREACHABLE) delivered = false
  }
  if (!delivered) {
    console.warn(
      '[Quizlab Bridge] The app was not told about the old protocol; the report is repeated'
    )
    return
  }
  outdatedState = key
  await persistState({ outdatedState: key })
}

/**
 * Brings the app up to date with the browser.
 *
 * The cookies are only pushed when something actually changed: the app asked
 * for a different set of sites, the app changed its configuration, the browser
 * changed a cookie of one of the sites, the app refused an earlier packet or
 * the bridge is a new one. A poll that finds nothing new sends nothing.
 */
async function sendCookiesToApp(options) {
  const settings = options || {}
  await stateReady

  const port = typeof settings.port === 'number' ? settings.port : bridgePort
  if (!port) return SYNC_UNREACHABLE

  if (!bridgeSecret) {
    const health = await fetchHealth(port)
    if (!health) return SYNC_UNREACHABLE
    await rememberSecret(health.secret)
  }

  const list = await fetchSiteList(port)
  if (!list) return SYNC_UNREACHABLE

  if (list.outdated) {
    await reportOutdatedOnce(list, port)
    return SYNC_OK
  }

  if (outdatedState !== null) {
    outdatedState = null
    await persistState({ outdatedState: null })
  }

  const fingerprint = targetsFingerprint(list.targets)
  const changed =
    list.configVersion !== lastConfigVersion || fingerprint !== targetsFingerprint(knownTargets)

  if (changed) {
    // The app asked for something else than it did the last time: a site whose
    // packet did not fit gets another chance, because the user may have
    // changed something in the app.
    tooLargeSiteIds.clear()
  }

  // The sites that have to be pushed: the ones the app refused, the ones the
  // browser changed and — when the bridge is a new one — all of them.
  const wanted = new Set(pendingSiteIds)
  for (const target of list.targets) {
    if (changed) wanted.add(target.siteId)
    if (typeof settings.changedDomain === 'string' && settings.changedDomain) {
      if (targetCoversDomain(target, settings.changedDomain)) wanted.add(target.siteId)
    }
  }
  if (settings.connect === true && !statePushedTo(list, fingerprint)) {
    for (const target of list.targets) wanted.add(target.siteId)
  }
  // A site whose packet did not fit into the app is not pushed again: the
  // packet cannot get smaller by waiting.
  for (const siteId of tooLargeSiteIds) wanted.delete(siteId)

  // A site the app does not ask for anymore is not pushed again.
  const asked = new Set(list.targets.map((target) => target.siteId))
  for (const siteId of pendingSiteIds) {
    if (!asked.has(siteId)) pendingSiteIds.delete(siteId)
  }
  for (const siteId of tooLargeSiteIds) {
    if (!asked.has(siteId)) tooLargeSiteIds.delete(siteId)
  }

  const targets = list.targets.filter((target) => wanted.has(target.siteId))
  if (targets.length === 0) {
    if (changed) {
      lastConfigVersion = list.configVersion
      knownTargets = list.targets
      applyWakeUpFilter()
      await persistState({
        lastConfigVersion,
        knownTargets,
        tooLargeSiteIds: [...tooLargeSiteIds]
      })
    }
    return SYNC_OK
  }

  const refused = await pushTargets(targets, port)
  if (changed) {
    lastConfigVersion = list.configVersion
    knownTargets = list.targets
    applyWakeUpFilter()
  }
  if (!refused && targets.length === list.targets.length) {
    // The whole state reached the bridge: it does not have to be sent again.
    lastPush = { secret: bridgeSecret, configVersion: list.configVersion, fingerprint }
  }
  await persistState({
    lastConfigVersion,
    knownTargets,
    pendingSiteIds: [...pendingSiteIds],
    tooLargeSiteIds: [...tooLargeSiteIds]
  })
  return refused ? SYNC_REFUSED : SYNC_OK
}

/**
 * The sends are chained.
 *
 * A wake-up of the worker, an alarm and a cookie change can all ask for a push
 * at the same time. One at a time keeps the packets of a site from racing
 * each other.
 */
function queueSend(options) {
  pendingSend = pendingSend
    .catch(() => SYNC_UNREACHABLE)
    .then(() => sendCookiesToApp(options))
    .catch((error) => {
      console.warn('[Quizlab Bridge] The site session sync failed:', errorMessage(error))
      return SYNC_UNREACHABLE
    })
  return pendingSend
}

function enterScanMode() {
  // RULE: Always keep a scan alarm active when disconnected.
  // This ensures the SW can be woken by the alarm system.
  connected = false
  chrome.alarms.clear(HEARTBEAT_ALARM).catch(() => {})
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: SCAN_INTERVAL_MS / 60000 })
}

function setupHeartbeat() {
  // RULE: Always keep a heartbeat alarm active when connected.
  connected = true
  chrome.alarms.clear(SCAN_ALARM).catch(() => {})
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: POLL_INTERVAL_MIN })
}

async function scanForBridge() {
  await stateReady
  try {
    for (let port = PORT_START; port <= PORT_END; port++) {
      const health = await fetchHealth(port)
      if (!health) continue

      // The secret identifies the bridge: a bridge that answers with another
      // secret is a new one, and the app may have lost its session in the
      // meantime. A bridge that could not be reached for a moment does not
      // make the next one a new one.
      const justConnected = health.secret !== bridgeSecret
      await rememberSecret(health.secret)
      bridgePort = port
      connected = true
      await persistState({ bridgePort: port })

      const result = await queueSend({ port, connect: justConnected })
      if (result === SYNC_UNREACHABLE) {
        // Bridge is up but did not answer — keep scanning so the next alarm
        // retries instead of hanging in a fake "connected".
        enterScanMode()
      } else {
        setupHeartbeat()
      }
      return
    }

    // Bridge not found — enter scan mode if not already scanning.
    if (!connected) {
      enterScanMode()
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The bridge scan failed:', errorMessage(error))
    if (!connected) enterScanMode()
  }
}

/** Pushes the site whose cookie changed. */
async function handleCookieChange(changeInfo) {
  await stateReady
  if (!changeInfo || !changeInfo.cookie) return
  const domain = changeInfo.cookie.domain
  if (typeof domain !== 'string' || !domain) return
  if (!isKnownDomain(domain)) return

  if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer)
  cookieDebounceTimer = setTimeout(() => {
    cookieDebounceTimer = null
    void queueSend({ changedDomain: domain })
  }, 2000)
}

// Event listeners registered synchronously at top level (MV3 requirement)

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    void scanForBridge()
  } else if (alarm.name === HEARTBEAT_ALARM) {
    // The heartbeat polls the site list of the bridge it knows. It only
    // pushes when the app asked for something else than it did the last time.
    void queueSend({}).then((result) => {
      if (result === SYNC_UNREACHABLE) {
        // Re-enter scan mode when the bridge is gone so the reconnect loop
        // keeps running instead of silently stopping the session sync.
        enterScanMode()
      }
    })
  }
})

chrome.runtime.onInstalled.addListener(() => {
  void scanForBridge()
})

// Fires on every Chrome browser startup (even when the SW was killed while
// Chrome was closed) and guarantees a reconnect attempt after a reboot.
chrome.runtime.onStartup.addListener(() => {
  void scanForBridge()
})

chrome.cookies.onChanged.addListener((changeInfo) => {
  void handleCookieChange(changeInfo)
})

// Triggers on Chrome startup and whenever the SW is spun up.
void scanForBridge()

/**
 * The hosts the navigation wake-up listens for.
 *
 * The list is the one of the sites the app asks for: the worker wakes up when
 * the user visits a site whose session may be taken from Chrome. The list is
 * not written down here — a site the app adds later is in it as well.
 */
function wakeUpHosts() {
  const hosts = new Set()
  for (const target of knownTargets) {
    for (const domain of target.cookieDomains) {
      const host = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/^\.+/, '') : ''
      if (host) hosts.add(host)
    }
  }
  return [...hosts]
}

/** The hosts the wake-up listens for at the moment. */
let wakeUpFilter = []
/** Whether the wake-up is registered at all. */
let wakeUpRegistered = false

/**
 * Wakes the worker up when the user visits a site of the app.
 *
 * The listener is registered again whenever the list of the sites changes:
 * the filter of a listener cannot be changed, only replaced. The wake-up stays
 * cheap — it only fires for the hosts of the sites the app asks for.
 */
function applyWakeUpFilter() {
  const hosts = wakeUpHosts()
  if (wakeUpRegistered && hosts.length === wakeUpFilter.length) {
    if (hosts.every((host, index) => host === wakeUpFilter[index])) return
  }
  wakeUpFilter = hosts
  wakeUpRegistered = true
  try {
    chrome.webNavigation.onCompleted.removeListener(onNavigationCompleted)
    chrome.webNavigation.onCompleted.addListener(onNavigationCompleted, {
      url: hosts.map((host) => ({ hostSuffix: host }))
    })
  } catch (error) {
    // A filter that Chrome does not accept must not take the worker down: the
    // alarm wakes it up anyway.
    console.warn(
      '[Quizlab Bridge] The navigation wake-up could not be registered:',
      errorMessage(error)
    )
  }
}

/** The wake-up itself: the bridge is looked for again. */
function onNavigationCompleted() {
  void scanForBridge()
}

// The listener has to be registered synchronously: a worker that is woken up
// by a navigation has to know the listener before it returns.
applyWakeUpFilter()
