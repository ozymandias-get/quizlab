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
const STORAGE_KEYS = ['bridgeSecret', 'lastConfigVersion', 'knownTargets', 'bridgePort']

let currentPort = PORT_START
let connected = false
let cookieDebounceTimer = null
let bridgeSecret = null
let lastConfigVersion = null
let knownTargets = []
let bridgePort = null
let pendingSend = Promise.resolve(true)

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
  } catch (error) {
    console.warn('[Quizlab Bridge] The saved state could not be read:', errorMessage(error))
  }
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
      knownTargets = []
      await persistState({ knownTargets: [] })
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
 * queried without the leading dot.
 */
function domainSpellings(domain) {
  const trimmed = typeof domain === 'string' ? domain.trim().toLowerCase() : ''
  const host = trimmed.replace(/^\.+/, '')
  if (!host) return []
  return trimmed.startsWith('.') ? [trimmed, host] : [host]
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

/** Whether the extension may read a host at all. */
async function containsAnyOrigin(patterns) {
  for (const pattern of patterns) {
    try {
      if (await chrome.permissions.contains({ origins: [pattern] })) return true
    } catch {
      // Without the permissions API the host permissions of the manifest are
      // the answer, and they are granted when the extension is installed.
      return true
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
  if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') return true
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
  if (cookies.length > 0) {
    return { targetId: target.siteId, status: 'ok', cookies: cookies.map(normalizeCookie) }
  }

  const permitted = await hasPermission(target.cookieDomains)
  return {
    targetId: target.siteId,
    status: permitted ? 'no_cookies' : 'permission_missing',
    cookies: []
  }
}

/** Sends the packet of one site to the app. */
async function postPacket(packet) {
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

    const response = await fetch(`http://${BRIDGE_HOST}:${currentPort}${COOKIE_PATH}`, {
      method: 'POST',
      headers,
      body
    })
    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The app refused the packet of',
        packet.targetId,
        'with',
        response.status
      )
      return false
    }
    return true
  } catch (error) {
    console.warn(
      '[Quizlab Bridge] The packet of',
      packet.targetId,
      'could not be sent:',
      errorMessage(error)
    )
    return false
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

/** Sends one packet per site and reports whether all of them arrived. */
async function pushTargets(targets) {
  let succeeded = true
  for (const target of targets) {
    const packet = await collectTargetPacket(target)
    const sent = await postPacket(packet)
    if (!sent) succeeded = false
    // Only the site, the domains, the outcome and the count are logged. A
    // cookie value never reaches the log.
    console.warn(
      `[Quizlab Bridge] ${target.siteId} (${target.cookieDomains.join(', ')}): ` +
        `${packet.status}, ${packet.cookies.length} cookies`
    )
  }
  return succeeded
}

/** Tells the app that the sites cannot be read at all. */
async function reportOutdated(targets) {
  for (const target of targets) {
    await postPacket({ targetId: target.siteId, status: 'permission_missing', cookies: [] })
  }
}

/**
 * Brings the app up to date with the browser.
 *
 * The cookies are only pushed when something actually changed: the app asked
 * for a different set of sites, the app changed its configuration, the browser
 * changed a cookie of one of the sites or the connection was just established.
 * A poll that finds nothing new sends nothing.
 */
async function sendCookiesToApp(options) {
  const settings = options || {}
  await stateReady

  if (!bridgeSecret) {
    const health = await fetchHealth(currentPort)
    if (!health) return false
    await rememberSecret(health.secret)
  }

  const list = await fetchSiteList(currentPort)
  if (!list) return false

  if (list.outdated) {
    await reportOutdated(list.targets)
    return true
  }

  const changed =
    list.configVersion !== lastConfigVersion ||
    targetsFingerprint(list.targets) !== targetsFingerprint(knownTargets)

  if (changed) {
    // The state is only remembered once the packets are through: a push that
    // failed has to be repeated by the next poll.
    const sent = await pushTargets(list.targets)
    if (!sent) return false
    lastConfigVersion = list.configVersion
    knownTargets = list.targets
    await persistState({ lastConfigVersion, knownTargets })
    return true
  }

  if (settings.force !== true) return true

  const changedDomain = typeof settings.changedDomain === 'string' ? settings.changedDomain : ''
  const targets = changedDomain
    ? list.targets.filter((target) => targetCoversDomain(target, changedDomain))
    : list.targets
  if (targets.length === 0) return true
  return pushTargets(targets)
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
    .catch(() => false)
    .then(() => sendCookiesToApp(options))
    .catch((error) => {
      console.warn('[Quizlab Bridge] The site session sync failed:', errorMessage(error))
      return false
    })
  return pendingSend
}

function enterScanMode() {
  // RULE: Always keep a scan alarm active when disconnected.
  // This ensures the SW can be woken by the alarm system.
  connected = false
  chrome.alarms.clear(HEARTBEAT_ALARM).catch(() => {})
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: SCAN_INTERVAL_MS / 60000 })
  if (bridgePort !== null) {
    // The bridge is gone: the next connection is a new one.
    bridgePort = null
    void persistState({ bridgePort: null })
  }
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

      currentPort = port
      await rememberSecret(health.secret)
      const justConnected = bridgePort !== port
      bridgePort = port
      connected = true
      await persistState({ bridgePort: port })

      const sent = await queueSend({ force: justConnected })
      if (sent) {
        setupHeartbeat()
      } else {
        // Bridge is up but refused the payload — keep scanning so the
        // next alarm retries instead of hanging in a fake "connected".
        enterScanMode()
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
    void queueSend({ force: true, changedDomain: domain })
  }, 2000)
}

// Event listeners registered synchronously at top level (MV3 requirement)

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    void scanForBridge()
  } else if (alarm.name === HEARTBEAT_ALARM) {
    // The heartbeat polls the site list. It only pushes when the app asked
    // for something else than it did the last time.
    void queueSend({ force: false }).then((sent) => {
      if (sent !== true) {
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

// Wake up the service worker when the user navigates to Gemini or AI Studio.
chrome.webNavigation.onCompleted.addListener(
  () => {
    void scanForBridge()
  },
  {
    url: [{ hostSuffix: 'gemini.google.com' }, { hostSuffix: 'aistudio.google.com' }]
  }
)
