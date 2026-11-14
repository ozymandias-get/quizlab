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
const PROTOCOL_VERSION = 3
const HEALTH_PATH = '/api/health'
const SITE_LIST_PATH = '/api/sites'
const COOKIE_PATH = '/api/cookies'
const PROFILE_ID_KEY = 'profileId'
const PROFILE_NAME_KEY = 'profileName'
const DEFAULT_PROFILE_NAME = 'Chrome'
const MAX_PROFILE_NAME_LENGTH = 60
/**
 * The cookie changes of one site are collected for this long, so that a login
 * writes one packet instead of a dozen. The queue is also written to the
 * session store: a service worker that is killed inside this window still
 * delivers the change when it is woken up again.
 */
const COOKIE_DEBOUNCE_MS = 2000
/** How soon a packet the app asked to retry is sent again. */
const RETRY_DELAY_MS = 1000
/**
 * The pairing code the user copies from the app's settings page.
 *
 * It is stored in `chrome.storage.local` by the popup and read by this worker.
 * The code is never fetched over HTTP: any local process can send an `Origin`
 * header, so the shared secret only travels by the user's copy/paste.
 */
const STORAGE_KEYS = [
  'bridgeSecret',
  'lastConfigVersion',
  'knownTargets',
  'bridgePort',
  'bridgeInstanceId',
  'pendingSiteIds',
  'pendingChangedDomains',
  'pairingInvalid',
  'outdatedState',
  'tooLargeSiteIds',
  'lastSelectedProfileId',
  'lastSelectionVersion'
]

/** The sync with the app went through. */
const SYNC_OK = 'ok'
/** The bridge did not answer at all. */
const SYNC_UNREACHABLE = 'unreachable'
/** The bridge answered but refused a packet. */
const SYNC_REFUSED = 'refused'
/** This Chrome profile is not the cookie source the user selected. */
const SYNC_NOT_SELECTED = 'not_selected'
/** The app answered, but the pairing code it was signed with is not its own. */
const SYNC_UNAUTHORIZED = 'unauthorized'
/** The browser holds no session for the sites that were pushed. */
const SYNC_NO_COOKIES = 'no_cookies'
/** The extension may not read the sites that were pushed. */
const SYNC_PERMISSION_MISSING = 'permission_missing'

/** The app imported the packet (or took a packet that carried no cookies). */
const PACKET_SENT = 'sent'
/** The app recorded the browser state; there was nothing to import. */
const PACKET_ACCEPTED = 'accepted'
/** The app refused the packet because it was too large to read. */
const PACKET_TOO_LARGE = 'too_large'
/** The app refused the packet for good; the same packet cannot succeed. */
const PACKET_REFUSED = 'refused'
/** The app refused the packet for now and asked for a fresh round. */
const PACKET_RETRY = 'retry'
/** The request never reached the app. */
const PACKET_UNREACHABLE = 'unreachable'

let connected = false
let cookieDebounceTimer = null
const changedDomains = new Set()
let bridgeSecret = null
/** The id of this Chrome profile's extension instance. */
let profileId = null
/** The name the user gave this Chrome profile. */
let profileName = DEFAULT_PROFILE_NAME
/** Whether the app rejected the pairing code the worker currently holds. */
let pairingInvalid = false
/** The profile the app last named as the cookie source. */
let lastSelectedProfileId = null
/** The app's selection revision this worker last saw. */
let lastSelectionVersion = null
/** The running bridge this worker last talked to (a restart changes it). */
let bridgeInstanceId = null
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
/** Whether the last answered site list named this profile as the source. */
let lastSelectionWasSource = null
let autoSync = true
/** What the last push sent, so that the same state is not sent twice. */
let lastPush = null
let pendingSend = Promise.resolve(SYNC_OK)
/** The scan that is running, so that two callers share one connection state. */
let scanInFlight = null
/** The alarm transition that is running, so that two modes never coexist. */
let alarmSwitch = Promise.resolve()
/** The timer of a packet the app asked to retry. */
let retryTimer = null
/** The last write of the changed-domain queue. */
let changedDomainsWrite = Promise.resolve()

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

/** A name the popup may show and the app may display. */
function normalizeProfileName(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replaceAll(/\s+/g, ' ').slice(0, MAX_PROFILE_NAME_LENGTH)
}

/**
 * The headers every request to the bridge carries.
 *
 * Chrome gives every profile a separate extension storage, so `profileId` is
 * different in each profile even though the extension files are the same. The
 * name is URL-encoded because it may contain Turkish characters, and HTTP
 * header values are not Unicode.
 */
function baseHeaders() {
  const headers = { 'x-protocol-version': String(PROTOCOL_VERSION) }
  const origin = getExtensionOrigin()
  if (origin) headers['Origin'] = origin
  if (profileId) headers['x-quizlab-profile-id'] = profileId
  if (profileName) headers['x-quizlab-profile-name'] = encodeURIComponent(profileName)
  return headers
}

/** The payload the HMAC covers: the profile id plus the request payload. */
function signingPayload(payload) {
  return `${profileId || ''}\n${payload}`
}

/**
 * Makes sure this profile has an id and a name.
 *
 * The id is created once and kept in `chrome.storage.local`, which is separate
 * per Chrome profile. It is what lets the app tell two installed copies of the
 * same extension apart.
 */
async function ensureProfileIdentity() {
  try {
    const stored = await chrome.storage.local.get([PROFILE_ID_KEY, PROFILE_NAME_KEY])
    let id = typeof stored[PROFILE_ID_KEY] === 'string' ? stored[PROFILE_ID_KEY].trim() : ''
    if (!id) {
      id = crypto.randomUUID()
      await chrome.storage.local.set({ [PROFILE_ID_KEY]: id })
    }
    profileId = id
    profileName = normalizeProfileName(stored[PROFILE_NAME_KEY]) || DEFAULT_PROFILE_NAME
    if (profileName !== stored[PROFILE_NAME_KEY]) {
      await chrome.storage.local.set({ [PROFILE_NAME_KEY]: profileName })
    }
    await applyActionIdentity()
  } catch (error) {
    console.warn('[Quizlab Bridge] The profile identity could not be read:', errorMessage(error))
  }
}

/** Shows the profile name on the toolbar button and in its tooltip. */
async function applyActionIdentity() {
  if (!chrome.action) return
  try {
    const title = profileName ? `Quizlab Site Sessions — ${profileName}` : 'Quizlab Site Sessions'
    await chrome.action.setTitle({ title })
    const badge = profileName.replaceAll(/\s+/g, '').slice(0, 4).toUpperCase()
    await chrome.action.setBadgeText({ text: badge })
    if (chrome.action.setBadgeBackgroundColor) {
      await chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' })
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The profile name could not be shown:', errorMessage(error))
  }
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
    const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 120) : ''
    targets.push({ siteId, cookieDomains: domains, ...(label ? { label } : {}) })
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
    // The running bridge this worker last talked to. Without this, every
    // service-worker restart looks like a brand-new bridge and re-pushes every
    // session, even though the app never changed.
    if (typeof stored.bridgeInstanceId === 'string') {
      bridgeInstanceId = stored.bridgeInstanceId
    }
    if (Array.isArray(stored.pendingSiteIds)) {
      pendingSiteIds = new Set(stored.pendingSiteIds.filter((id) => typeof id === 'string'))
    }
    // A cookie change that was queued before the worker was killed is still
    // waiting: the next send that reaches the app applies it.
    if (Array.isArray(stored.pendingChangedDomains)) {
      for (const domain of stored.pendingChangedDomains) {
        if (typeof domain === 'string' && domain) changedDomains.add(domain)
      }
    }
    if (stored.pairingInvalid === true) {
      pairingInvalid = true
    }
    if (Array.isArray(stored.tooLargeSiteIds)) {
      tooLargeSiteIds = new Set(stored.tooLargeSiteIds.filter((id) => typeof id === 'string'))
    }
    if (typeof stored.outdatedState === 'string') {
      outdatedState = stored.outdatedState
    }
    if (typeof stored.lastSelectedProfileId === 'string') {
      lastSelectedProfileId = stored.lastSelectedProfileId
    }
    if (typeof stored.lastSelectionVersion === 'number') {
      lastSelectionVersion = stored.lastSelectionVersion
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The saved state could not be read:', errorMessage(error))
  }
  // Preferences and the pairing code survive browser restarts; transient
  // bridge state does not.
  try {
    const preferences = await chrome.storage.local.get(['autoSync', 'bridgeSecret'])
    autoSync = preferences.autoSync !== false
    if (typeof preferences.bridgeSecret === 'string' && preferences.bridgeSecret) {
      bridgeSecret = preferences.bridgeSecret
    }
  } catch {}
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

/**
 * Writes the queue of changed domains, one write at a time.
 *
 * The value is built when the write runs: a change that is added while an
 * earlier write is still on its way is part of the later write and cannot be
 * overwritten by the older snapshot.
 */
function persistChangedDomains() {
  changedDomainsWrite = changedDomainsWrite
    .catch(() => undefined)
    .then(() => persistState({ pendingChangedDomains: [...changedDomains] }))
  return changedDomainsWrite
}

const stateReady = ensureProfileIdentity().then(() => readPersistedState())

/**
 * Asks the app which sites it wants cookies for.
 *
 * The answer is signed like every other request: the extension reads the
 * pairing code the user pasted into the popup, and the site list is only
 * given to a caller that proves it holds that code.
 *
 * The outcome is told apart because the caller has to know whether the app was
 * there at all: a 401 is the app telling us that the pairing code is not the
 * one it holds, and every other failure means the request itself did not go
 * through.
 */
async function requestSiteList(port) {
  try {
    const headers = baseHeaders()
    if (bridgeSecret) {
      headers['x-hmac-signature'] = await computeHmac(signingPayload(SITE_LIST_PATH), bridgeSecret)
    }
    const response = await fetch(`http://${BRIDGE_HOST}:${port}${SITE_LIST_PATH}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(2000)
    })
    if (response.status === 401) return { outcome: 'unauthorized' }
    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The site list request on port',
        port,
        'answered with',
        response.status
      )
      return { outcome: 'error', status: response.status }
    }
    const data = await response.json()
    if (!data || typeof data !== 'object') return { outcome: 'error' }

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
      return {
        outcome: 'ok',
        list: { protocolVersion, configVersion: 0, targets, outdated: true }
      }
    }
    return {
      outcome: 'ok',
      list: {
        protocolVersion,
        configVersion: typeof data.configVersion === 'number' ? data.configVersion : 0,
        targets,
        selectedProfileId:
          typeof data.selectedProfileId === 'string' && data.selectedProfileId
            ? data.selectedProfileId
            : null,
        selectionVersion:
          typeof data.selectionVersion === 'number' && Number.isFinite(data.selectionVersion)
            ? Math.max(0, Math.floor(data.selectionVersion))
            : 0,
        outdated: false
      }
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The site list request failed:', errorMessage(error))
    return { outcome: 'error' }
  }
}

/**
 * The health endpoint of the bridge.
 *
 * It answers with the protocol the app speaks and an instance id; it does not
 * carry the shared secret. A port that does not answer is simply not the
 * bridge, so a failed request is not worth a warning.
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
    if (!data || data.status !== 'ok') return null
    return data
  } catch {
    return null
  }
}

/** Whether a value looks like the pairing code the app shows. */
function isPairingCode(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim())
}

/**
 * Stores the code the user pasted into the popup.
 *
 * The local store keeps it across browser restarts; the session store keeps
 * the running worker's quick copy. The app's site list is only readable with
 * this code.
 */
async function rememberSecret(secret) {
  bridgeSecret = secret
  await persistState({ bridgeSecret: secret })
  try {
    await chrome.storage.local.set({ bridgeSecret: secret })
    return true
  } catch (error) {
    console.warn('[Quizlab Bridge] The pairing code could not be saved:', errorMessage(error))
    return false
  }
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
    throw error
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
    // The cookie query includes subdomains, so an exact-host grant is not enough.
    const granted = await containsAnyOrigin([`https://*.${host}/*`])
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
  // New catalogue sites need an explicit optional grant before any cookie read.
  if (!(await hasPermission(target.cookieDomains))) {
    return { targetId: target.siteId, status: 'permission_missing', cookies: [] }
  }
  const collected = new Map()
  for (const domain of target.cookieDomains) {
    for (const spelling of domainSpellings(domain)) {
      const found = await readCookies(spelling)
      for (const cookie of found) {
        // Partitioned third-party cookies cannot be flattened into the first-party jar.
        if (cookie.partitionKey) continue
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
    return {
      targetId: target.siteId,
      status: 'ok',
      cookies: cookies.map(normalizeCookie)
    }
  }
  return { targetId: target.siteId, status: 'no_cookies', cookies: [] }
}

/**
 * Sends the packet of one site to the app.
 *
 * The answer of the app is told apart in six ways. The important distinction
 * is not "did the HTTP request succeed" but "is this packet finished":
 *
 *   - the app imported it;
 *   - the app recorded a browser state that has nothing to import (empty
 *     session, missing permission);
 *   - the app refused it for good, so sending it again cannot help;
 *   - the app refused it for now (another round, a profile switch) and asked
 *     for a retry;
 *   - the packet was too large for the app to read; or
 *   - the request never reached the app.
 *
 * Only the last one says nothing about the packet itself.
 */
async function postPacket(packet, port) {
  try {
    const body = JSON.stringify(packet)
    const headers = { ...baseHeaders(), 'Content-Type': 'application/json' }
    if (bridgeSecret) {
      headers['x-hmac-signature'] = await computeHmac(signingPayload(body), bridgeSecret)
    }

    const response = await fetch(`http://${BRIDGE_HOST}:${port}${COOKIE_PATH}`, {
      signal: AbortSignal.timeout(10000),
      method: 'POST',
      headers,
      body
    })
    if (response.status === 413) {
      // The packet is bigger than the app reads: it can never be imported, so
      // it is not sent again.
      return PACKET_TOO_LARGE
    }

    let result = null
    try {
      result = await response.json()
    } catch {
      result = null
    }
    const retryable = result?.retryable === true

    if (!response.ok) {
      console.warn(
        '[Quizlab Bridge] The app refused the packet of',
        packet.targetId,
        'with',
        response.status
      )
      // A server error is transient; a refusal with an explicit retry flag is
      // a round the app has already replaced.
      if (response.status >= 500 || retryable) return PACKET_RETRY
      return PACKET_REFUSED
    }

    if (result && result.accepted === true) {
      if (packet.status !== 'ok') {
        // "the browser holds no session" and "the extension may not read the
        // site" are normal states the app recorded. There is nothing to
        // import, and sending the same report again would only repeat it.
        return PACKET_ACCEPTED
      }
      if (result.importSucceeded === true) return PACKET_SENT
      // The app took the packet but the session was not written. A retry is
      // worth it only when the app says so; a failed rollback is final.
      return retryable ? PACKET_RETRY : PACKET_REFUSED
    }

    // An app that predates the `accepted`/`importSucceeded` fields answers
    // with `success` alone. It cannot tell an import from a recorded browser
    // state, so the packet status decides what the answer means.
    if (result && result.success === true) {
      return packet.status === 'ok' ? PACKET_SENT : PACKET_ACCEPTED
    }
    if (result && result.success === false && packet.status !== 'ok') return PACKET_ACCEPTED
    return retryable ? PACKET_RETRY : PACKET_REFUSED
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
    lastPush.instanceId === bridgeInstanceId &&
    lastPush.configVersion === list.configVersion &&
    lastPush.fingerprint === fingerprint
  )
}

/**
 * Sends one packet per site.
 *
 * The outcome of every packet is counted, because the caller has to tell the
 * user *why* a manual transfer did not import anything. A site whose packet
 * the app refused for good is not queued again; a site the app asked to retry
 * stays queued and gets one short retry.
 *
 * A site whose packet did not fit into the app is remembered as well, but the
 * other way round: it is not pushed again, because a packet that is too large
 * stays too large.
 */
async function pushTargets(targets, port) {
  const summary = {
    imported: 0,
    noCookies: 0,
    permissionMissing: 0,
    tooLarge: 0,
    refused: 0,
    retry: 0
  }
  for (const target of targets) {
    if (tooLargeSiteIds.has(target.siteId)) continue
    let packet
    try {
      packet = await collectTargetPacket(target)
    } catch {
      // Retain the site for the next poll, but keep syncing the other sites.
      pendingSiteIds.add(target.siteId)
      summary.retry += 1
      scheduleRetry()
      continue
    }
    const outcome = await postPacket(packet, port)
    if (outcome === PACKET_SENT) {
      pendingSiteIds.delete(target.siteId)
      summary.imported += 1
    } else if (outcome === PACKET_ACCEPTED) {
      pendingSiteIds.delete(target.siteId)
      // The app recorded the browser state. It is not a failed transfer, but
      // it is also not an imported session, and the user may have to act.
      if (packet.status === 'permission_missing') summary.permissionMissing += 1
      else if (packet.status === 'no_cookies') summary.noCookies += 1
      else summary.imported += 1
    } else if (outcome === PACKET_TOO_LARGE) {
      pendingSiteIds.delete(target.siteId)
      tooLargeSiteIds.add(target.siteId)
      summary.tooLarge += 1
      // The state did not reach the app entirely, so the app has to be told
      // about it again when it asks for something new.
      console.warn(
        '[Quizlab Bridge] The packet of',
        target.siteId,
        'is too large for the app; it is not pushed again'
      )
    } else if (outcome === PACKET_RETRY) {
      pendingSiteIds.add(target.siteId)
      summary.retry += 1
      scheduleRetry()
    } else if (outcome === PACKET_UNREACHABLE) {
      // The connection is gone; the scan and the heartbeat own the retry.
      pendingSiteIds.add(target.siteId)
      summary.retry += 1
    } else {
      // Refused for good: retrying the same packet would only repeat it.
      pendingSiteIds.delete(target.siteId)
      summary.refused += 1
    }
    // Only the site, the domains, the outcome and the count are logged. A
    // cookie value never reaches the log.
    console.log(
      `[Quizlab Bridge] ${target.siteId} (${target.cookieDomains.join(', ')}): ` +
        `${packet.status}, ${packet.cookies.length} cookies, ${outcome}`
    )
  }
  return summary
}

/** Sends the queue again soon, because the app asked for a fresh round. */
function scheduleRetry() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void queueSend({})
  }, RETRY_DELAY_MS)
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

  // Without the pairing code the site list is signed wrong and refused; the
  // popup is where the user enters it.
  if (!bridgeSecret) return SYNC_UNREACHABLE

  const request = await requestSiteList(port)
  if (request.outcome === 'unauthorized') {
    // The app answered, so it is running; it does not know this pairing code.
    // This is not the same as "the app is not there", and the user can fix it
    // only by pairing again.
    console.warn('[Quizlab Bridge] The app rejected the pairing code of this extension')
    return SYNC_UNAUTHORIZED
  }
  if (request.outcome !== 'ok') return SYNC_UNREACHABLE
  const list = request.list

  // The signed list proves that the app answered this worker. The cookie
  // changes that were queued for it belong to this round — including the ones
  // that were queued before a service-worker restart.
  const changedDomainsForSend = new Set(changedDomains)
  if (typeof settings.changedDomain === 'string' && settings.changedDomain) {
    changedDomainsForSend.add(settings.changedDomain)
  }
  changedDomains.clear()
  // A change that arrived while the list was being fetched stays queued and
  // is written back with the rest of the queue.
  await persistChangedDomains()

  if (list.outdated) {
    await reportOutdatedOnce(list, port)
    return SYNC_OK
  }

  if (outdatedState !== null) {
    outdatedState = null
    await persistState({ outdatedState: null })
  }

  const isSelected = Boolean(profileId) && list.selectedProfileId === profileId
  lastSelectionWasSource = isSelected
  const selectionVersion = list.selectionVersion
  // The revision catches A -> B -> A between two polls: the profile sees that
  // the source changed even though it is selected again by the time it asks.
  const selectionChanged =
    isSelected && (lastSelectedProfileId !== profileId || lastSelectionVersion !== selectionVersion)

  if (!isSelected) {
    // Another Chrome profile is the cookie source. Keep the site list so the
    // popup can still show permissions, but do not push anything: the app
    // would refuse the packets anyway.
    lastSelectedProfileId = list.selectedProfileId
    lastSelectionVersion = selectionVersion
    knownTargets = list.targets
    lastConfigVersion = list.configVersion
    pendingSiteIds.clear()
    applyWakeUpFilter()
    await persistState({
      knownTargets,
      lastConfigVersion,
      pendingSiteIds: [],
      lastSelectedProfileId,
      lastSelectionVersion
    })
    // A manual "sync now" from a profile that is not the source has nothing
    // to deliver; saying "ok" would tell the user the sessions were imported.
    return settings.forceAll === true ? SYNC_NOT_SELECTED : SYNC_OK
  }

  if (settings.forceAll === true) {
    // The whole manual transfer pushes every site, so a retry queue is not
    // needed. A transfer for one site keeps the queue of the others.
    if (!settings.targetId) pendingSiteIds.clear()
  }

  if (!autoSync && settings.forceAll !== true) {
    // Auto-sync is off, so the selection markers are deliberately left alone:
    // when the user syncs manually or turns auto-sync back on, the profile
    // still sees that it has not pushed since it became the source.
    knownTargets = list.targets
    lastConfigVersion = list.configVersion
    applyWakeUpFilter()
    await persistState({ knownTargets, lastConfigVersion })
    return SYNC_OK
  }

  lastSelectedProfileId = profileId
  lastSelectionVersion = selectionVersion

  const fingerprint = targetsFingerprint(list.targets)
  const changed =
    selectionChanged ||
    list.configVersion !== lastConfigVersion ||
    fingerprint !== targetsFingerprint(knownTargets)

  if (changed || settings.forceAll === true || settings.resync === true) {
    // The app asked for something else than it did the last time: a site whose
    // packet did not fit gets another chance, because the user may have
    // changed something in the app.
    tooLargeSiteIds.clear()
  }

  // The sites that have to be pushed: the ones the app refused, the ones the
  // browser changed and — when the bridge is a new one or this profile just
  // became the selected one — all of them.
  const wanted = new Set(pendingSiteIds)
  for (const target of list.targets) {
    if (changed || selectionChanged || settings.forceAll === true) wanted.add(target.siteId)
    for (const changedDomain of changedDomainsForSend) {
      if (targetCoversDomain(target, changedDomain)) {
        // A changed cookie can make a previously oversized packet smaller.
        tooLargeSiteIds.delete(target.siteId)
        wanted.add(target.siteId)
      }
    }
  }
  if (
    (settings.connect === true && !statePushedTo(list, fingerprint)) ||
    settings.forceAll === true ||
    settings.resync === true
  ) {
    for (const target of list.targets) wanted.add(target.siteId)
  }
  // A site whose packet did not fit is retried only after its cookies change.
  for (const siteId of tooLargeSiteIds) wanted.delete(siteId)

  // A site the app does not ask for anymore is not pushed again.
  const asked = new Set(list.targets.map((target) => target.siteId))
  for (const siteId of pendingSiteIds) {
    if (!asked.has(siteId)) pendingSiteIds.delete(siteId)
  }
  for (const siteId of tooLargeSiteIds) {
    if (!asked.has(siteId)) tooLargeSiteIds.delete(siteId)
  }

  const targets = list.targets.filter(
    (target) =>
      (settings.forceAll === true || wanted.has(target.siteId)) &&
      (!settings.targetId || target.siteId === settings.targetId)
  )
  if (settings.forceAll === true && targets.length === 0) return SYNC_REFUSED
  if (targets.length === 0) {
    if (changed) {
      lastConfigVersion = list.configVersion
      knownTargets = list.targets
      applyWakeUpFilter()
      await persistState({
        lastConfigVersion,
        knownTargets,
        tooLargeSiteIds: [...tooLargeSiteIds],
        lastSelectedProfileId,
        lastSelectionVersion
      })
    }
    return SYNC_OK
  }

  // Remember the whole round before the first packet leaves. A worker that is
  // killed halfway through pushes the unfinished sites again on its next run;
  // the writes are idempotent, so retrying a sent site is safe.
  for (const target of targets) pendingSiteIds.add(target.siteId)
  await persistState({
    lastSelectedProfileId,
    lastSelectionVersion,
    pendingSiteIds: [...pendingSiteIds],
    tooLargeSiteIds: [...tooLargeSiteIds]
  })

  const summary = await pushTargets(targets, port)
  if (changed) {
    lastConfigVersion = list.configVersion
    knownTargets = list.targets
    applyWakeUpFilter()
  }
  const incomplete = summary.refused > 0 || summary.retry > 0 || summary.tooLarge > 0
  if (!incomplete && targets.length === list.targets.length) {
    // The whole state reached the bridge: it does not have to be sent again.
    lastPush = { instanceId: bridgeInstanceId, configVersion: list.configVersion, fingerprint }
  }

  // A manual "sync now" is a one-off action that stops the automatic mirror —
  // but only when it really delivered something. A failed attempt must not
  // change a preference the user set for the automatic path. The preference is
  // written before the worker reports it; a failed write leaves it as it was.
  if (settings.forceAll === true && summary.imported > 0 && autoSync) {
    try {
      await chrome.storage.local.set({ autoSync: false })
      autoSync = false
    } catch (error) {
      console.warn(
        '[Quizlab Bridge] The automatic sync preference could not be turned off:',
        errorMessage(error)
      )
    }
  }

  await persistState({
    lastConfigVersion,
    knownTargets,
    pendingSiteIds: [...pendingSiteIds],
    tooLargeSiteIds: [...tooLargeSiteIds],
    lastSelectedProfileId,
    lastSelectionVersion
  })

  if (incomplete) return SYNC_REFUSED
  if (summary.imported === 0) {
    // Nothing was written. The row of the site says why; a "success" here would
    // tell the user a session was transferred that never existed.
    if (summary.permissionMissing > 0) return SYNC_PERMISSION_MISSING
    if (summary.noCookies > 0) return SYNC_NO_COOKIES
  }
  return SYNC_OK
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

/**
 * The alarms are switched as one serialized transition.
 *
 * `enterScanMode` and `setupHeartbeat` are called from the scan and from the
 * heartbeat at the same time. Clearing one alarm and creating the other are
 * separate asynchronous calls, so two transitions that interleave would leave
 * both alarms behind — a scan and a heartbeat that both keep the worker awake.
 * Every transition therefore runs after the previous one finished.
 */
function switchAlarmMode(mode) {
  const next = alarmSwitch
    .catch(() => undefined)
    .then(async () => {
      if (mode === 'scan') {
        connected = false
        await chrome.alarms.clear(HEARTBEAT_ALARM).catch(() => false)
        // The scan alarm is periodic as well: a scan that cannot re-arm itself
        // (a worker killed mid-scan) would otherwise stop the reconnect loop.
        await chrome.alarms.create(SCAN_ALARM, {
          delayInMinutes: SCAN_INTERVAL_MS / 60000,
          periodInMinutes: SCAN_INTERVAL_MS / 60000
        })
      } else {
        connected = true
        await chrome.alarms.clear(SCAN_ALARM).catch(() => false)
        await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: POLL_INTERVAL_MIN })
      }
    })
  alarmSwitch = next
  return next
}

function enterScanMode() {
  // RULE: Always keep a scan alarm active when disconnected. This ensures the
  // service worker can be woken by the alarm system.
  return switchAlarmMode('scan')
}

function setupHeartbeat() {
  // RULE: Always keep a heartbeat alarm active when connected.
  return switchAlarmMode('heartbeat')
}

/** Remembers whether the app rejected the pairing code of this worker. */
async function setPairingInvalid(invalid) {
  if (pairingInvalid === invalid) return
  pairingInvalid = invalid
  await persistState({ pairingInvalid: invalid })
}

/**
 * Looks for the bridge and brings the app up to date.
 *
 * Only one scan runs at a time. The worker is started by six different events
 * (the module load, `onInstalled`, `onStartup`, the scan alarm, a navigation
 * wake-up and the pairing action) and several of them can fire together. Two
 * scans would each pick a port, each write `connected` and each switch the
 * alarms, so the one that finishes last would decide the connection state.
 * Every caller shares the scan that is running instead.
 *
 * A pairing scan cannot share one: it runs with a candidate secret that the
 * worker does not own yet, so it waits for the running scan and then runs its
 * own.
 */
function scanForBridge(options) {
  const settings = options || {}
  if (scanInFlight) {
    if (!settings.force) return scanInFlight
    return waitForScan(settings)
  }
  const run = performScan(settings).finally(() => {
    if (scanInFlight === run) scanInFlight = null
  })
  scanInFlight = run
  return run
}

/** Waits for the running scan, then starts a fresh one. */
async function waitForScan(settings) {
  while (scanInFlight) {
    await scanInFlight.catch(() => SYNC_UNREACHABLE)
  }
  return scanForBridge(settings)
}

async function performScan(settings) {
  await stateReady
  try {
    for (let port = PORT_START; port <= PORT_END; port++) {
      const health = await fetchHealth(port)
      if (!health) continue
      if (!bridgeSecret) {
        // The bridge is there, but the extension is not paired yet. Staying in
        // scan mode keeps the popup's pairing action the only way forward.
        await enterScanMode()
        return SYNC_UNREACHABLE
      }

      // The instance id identifies the running bridge: a bridge that answers
      // with another id is a new one, and the app may have lost its session in
      // the meantime. A bridge that could not be reached for a moment does not
      // make the next one a new one.
      const justConnected =
        typeof health.instanceId === 'string' && health.instanceId !== bridgeInstanceId
      if (typeof health.instanceId === 'string') bridgeInstanceId = health.instanceId
      bridgePort = port

      const result = await queueSend({
        port,
        connect: justConnected,
        // A pairing is the user asking for the sessions: it pushes the sites
        // even when this bridge already had them.
        resync: settings.resync === true
      })
      if (result === SYNC_UNREACHABLE || result === SYNC_UNAUTHORIZED) {
        // The app is up but did not confirm the connection. The worker must not
        // stay in a fake "connected" state: it goes back to scanning, and the
        // scan alarm is always (re-)armed.
        if (result === SYNC_UNAUTHORIZED && !settings.probe) {
          await setPairingInvalid(true)
        }
        await enterScanMode()
        return result
      }

      // The bridge answered with a signed list, so the port and the instance
      // are worth remembering. A probe does not write them on failure.
      await persistState({ bridgePort, bridgeInstanceId })
      await setPairingInvalid(false)
      await setupHeartbeat()
      return result
    }

    // No port answered. This also covers a worker that still believed it was
    // connected: a failed scan always means "disconnected now".
    await enterScanMode()
    return SYNC_UNREACHABLE
  } catch (error) {
    console.warn('[Quizlab Bridge] The bridge scan failed:', errorMessage(error))
    await enterScanMode()
    return SYNC_UNREACHABLE
  }
}

/** Pushes the site whose cookie changed. */
async function handleCookieChange(changeInfo) {
  await stateReady
  if (!changeInfo || !changeInfo.cookie) return
  const domain = changeInfo.cookie.domain
  if (typeof domain !== 'string' || !domain) return
  if (!isKnownDomain(domain)) return

  // The queue is written before the debounce starts. A service worker that is
  // killed inside the two seconds otherwise loses the change: the heartbeat
  // only pushes what changed, and nothing would tell it about this cookie.
  const isNewDomain = !changedDomains.has(domain)
  changedDomains.add(domain)
  if (isNewDomain) await persistChangedDomains()

  if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer)
  cookieDebounceTimer = setTimeout(() => {
    cookieDebounceTimer = null
    // The send drains the queue itself once it has reached the app, so a change
    // that never got there is not lost with the timer.
    void queueSend({})
  }, COOKIE_DEBOUNCE_MS)
}

// Event listeners registered synchronously at top level (MV3 requirement)

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    void scanForBridge()
  } else if (alarm.name === HEARTBEAT_ALARM) {
    // The heartbeat polls the site list of the bridge it knows. It only
    // pushes when the app asked for something else than it did the last time.
    void queueSend({}).then((result) => {
      if (result === SYNC_UNREACHABLE || result === SYNC_UNAUTHORIZED) {
        // Re-enter scan mode when the bridge is gone so the reconnect loop
        // keeps running instead of silently stopping the session sync.
        if (result === SYNC_UNAUTHORIZED) void setPairingInvalid(true)
        void enterScanMode()
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

if (chrome.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'set_auto_sync') {
      const enabled = message.enabled === true
      stateReady
        .then(async () => {
          // The preference is written before the worker behaves differently:
          // a failed write used to leave the worker mirroring (or not
          // mirroring) a state that the next restart would not read.
          try {
            if (autoSync !== enabled) await chrome.storage.local.set({ autoSync: enabled })
          } catch (error) {
            console.warn(
              '[Quizlab Bridge] The automatic sync preference could not be saved:',
              errorMessage(error)
            )
            return { success: false, settingsSaved: false }
          }
          autoSync = enabled
          const result = await queueSend(enabled ? { resync: true } : {})
          // `success` is about the transfer; `settingsSaved` says the choice
          // itself is on disk. The popup reports the two separately.
          return { success: result === SYNC_OK, result, settingsSaved: true }
        })
        .then(
          (response) => sendResponse(response),
          () => sendResponse({ success: false, settingsSaved: false })
        )
      return true
    }
    if (message?.type === 'sync_now') {
      queueSend({ forceAll: true, targetId: message.targetId })
        .then((result) => sendResponse({ success: result === SYNC_OK, result, autoSync }))
        .catch((error) => sendResponse({ success: false, error: errorMessage(error), autoSync }))
      return true
    }
    if (message?.type === 'set_profile_name') {
      const name = normalizeProfileName(message.name)
      if (!name) {
        sendResponse({ success: false, error: 'invalid_name' })
        return false
      }
      stateReady
        .then(async () => {
          // The name is persisted first. A write that failed must not leave a
          // name in memory that the popup and the app would show until the next
          // restart silently goes back to the old one.
          try {
            await chrome.storage.local.set({ [PROFILE_NAME_KEY]: name })
          } catch (error) {
            console.warn(
              '[Quizlab Bridge] The profile name could not be saved:',
              errorMessage(error)
            )
            return { success: false, error: 'storage_failed' }
          }
          profileName = name
          await applyActionIdentity()
          return { success: true }
        })
        .then(
          (response) => sendResponse(response),
          (error) => sendResponse({ success: false, error: errorMessage(error) })
        )
      return true
    }
    if (message?.type === 'pair') {
      const code = typeof message.secret === 'string' ? message.secret.trim().toLowerCase() : ''
      if (!isPairingCode(code)) {
        sendResponse({ success: false, error: 'invalid_code' })
        return false
      }
      stateReady
        .then(async () => {
          // The code is tried in memory first. A wrong code must never replace
          // the working one or survive in the storage, so it is only saved
          // after the app answered the signed site list request — which is the
          // proof that it holds this code. Whether the following import
          // succeeds is a separate result: pairing and transfer are not the
          // same success.
          const previousSecret = bridgeSecret
          const previousInstanceId = bridgeInstanceId
          const previousPort = bridgePort
          try {
            bridgeSecret = code
            bridgeInstanceId = null
            const result = await scanForBridge({ force: true, probe: true, resync: true })
            if (result === SYNC_UNAUTHORIZED) {
              bridgeSecret = previousSecret
              bridgeInstanceId = previousInstanceId
              bridgePort = previousPort
              return { success: false, error: 'invalid_code' }
            }
            if (result === SYNC_UNREACHABLE) {
              bridgeSecret = previousSecret
              bridgeInstanceId = previousInstanceId
              bridgePort = previousPort
              return { success: false, error: 'bridge_unreachable' }
            }
            const settingsSaved = await rememberSecret(code)
            return {
              success: true,
              result,
              settingsSaved,
              // Pairing worked, but the app intends to import from another
              // Chrome profile. The popup tells the user to select this one.
              notSelected: lastSelectionWasSource === false
            }
          } catch (error) {
            bridgeSecret = previousSecret
            bridgeInstanceId = previousInstanceId
            bridgePort = previousPort
            throw error
          }
        })
        .then(
          (response) => sendResponse(response),
          (error) => sendResponse({ success: false, error: errorMessage(error) })
        )
      return true
    }
  })
}

/** The wake-up itself: the bridge is looked for again. */
function onNavigationCompleted() {
  void scanForBridge()
}

// The listener has to be registered synchronously: a worker that is woken up
// by a navigation has to know the listener before it returns.
applyWakeUpFilter()
