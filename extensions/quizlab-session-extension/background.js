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
/**
 * The Chrome id of the development build.
 *
 * One source folder produces two extensions; the manifest key decides which id
 * Chrome derives, and the id is the only thing this worker has to know about
 * the build it runs in. The value is pinned in
 * `shared/constants/extensionRelease.ts` and re-derived from the dev public key
 * by the extension contract test.
 */
const DEV_EXTENSION_ID = 'coonffpgfklpknbbkpilpcjjfjndheic'
/** Which build this worker is: `prod` for the release extension, `dev` otherwise. */
const EXTENSION_ENVIRONMENT = chrome.runtime.id === DEV_EXTENSION_ID ? 'dev' : 'prod'
/**
 * The ports of this build.
 *
 * The release app listens on 51999-52009 and the development app on
 * 52010-52020 (see `electron/features/native-messaging/nativeMessagingTypes.ts`).
 * The ranges never overlap and a build never scans the range of the other one,
 * so two running apps cannot answer each other's extension.
 */
const PORT_START = EXTENSION_ENVIRONMENT === 'dev' ? 52010 : 51999
const PORT_END = EXTENSION_ENVIRONMENT === 'dev' ? 52020 : 52009
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
/**
 * The magic selector transfer.
 *
 * A picked element is not a cookie packet: it has its own path, its own signed
 * payload and its own body, so it works while the session sync is off and can
 * never enter the cookie queue. The values are pinned in
 * `shared/constants/selectorTransfer.ts`; the bridge contract test re-reads
 * them so the two cannot drift.
 */
const SELECTOR_TRANSFER_PATH = '/api/selectors'
const SELECTOR_SITES_PATH = '/api/selectors/sites'
const SELECTOR_TRANSFER_VERSION = 1
const SELECTOR_REQUEST_ID_HEADER = 'x-quizlab-request-id'
const SELECTOR_SITES_KEY = 'selectorSites'
const SELECTOR_SESSIONS_KEY = 'selectorSessions'
const SELECTOR_LAST_OUTCOME_KEY = 'selectorLastOutcome'
/** A pick longer than this is forgotten; the content script is gone by then. */
const SELECTOR_SESSION_TTL_MS = 10 * 60 * 1000
/** How many live picks are remembered at once. */
const MAX_SELECTOR_SESSIONS = 8
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
  'lastSelectionVersion',
  SELECTOR_SITES_KEY,
  SELECTOR_SESSIONS_KEY,
  SELECTOR_LAST_OUTCOME_KEY
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
/** Some sessions were imported, some sites had nothing to import. */
const SYNC_PARTIAL = 'partial'

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
/** Whether the pairing probe is running with a code the worker does not own yet. */
let pairingInFlight = false
/** The pairing requests that are running, one at a time. */
let pairingQueue = Promise.resolve()
/** The last write of the changed-domain queue. */
let changedDomainsWrite = Promise.resolve()
/** The sites and fields the magic selector may target, as the app named them. */
let selectorSites = []
/** Whether the app understands the selector transfer (null: not asked yet). */
let selectorSupported = null
/** The picks this worker is driving; written to the session store. */
let selectorSessions = []
/** Serializes the session-store writes. */
let selectorSessionsWrite = Promise.resolve()
/** The last transfer result, so a reopened popup can show it. */
let selectorLastOutcome = null
/** The sends that are running, one per pick session. */
const selectorSends = new Map()

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
  const headers = {
    'x-protocol-version': String(PROTOCOL_VERSION),
    // Names the build, so the bridge can refuse an extension of the other
    // environment even before it reads the request. The port range and the
    // pinned origin already separate them; this is a third, independent check.
    'x-quizlab-environment': EXTENSION_ENVIRONMENT
  }
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
    const build = EXTENSION_ENVIRONMENT === 'dev' ? ' (Dev)' : ''
    const title = profileName
      ? `Quizlab Site Sessions${build} — ${profileName}`
      : `Quizlab Site Sessions${build}`
    await chrome.action.setTitle({ title })
    const badge = profileName.replaceAll(/\s+/g, '').slice(0, 4).toUpperCase()
    await chrome.action.setBadgeText({ text: badge })
    if (chrome.action.setBadgeBackgroundColor) {
      // A different badge colour makes the two loaded builds tell apart at a
      // glance in the toolbar.
      await chrome.action.setBadgeBackgroundColor({
        color: EXTENSION_ENVIRONMENT === 'dev' ? '#0ea5e9' : '#4f46e5'
      })
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
  let hasSessionSecret = false
  try {
    const stored = await area.get(STORAGE_KEYS)
    if (!stored) return
    if (typeof stored.bridgeSecret === 'string' && stored.bridgeSecret) {
      bridgeSecret = stored.bridgeSecret
      hasSessionSecret = true
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
    if (Array.isArray(stored[SELECTOR_SITES_KEY])) {
      selectorSites = normalizeSelectorSites(stored[SELECTOR_SITES_KEY])
    }
    if (Array.isArray(stored[SELECTOR_SESSIONS_KEY])) {
      selectorSessions = normalizeSelectorSessions(stored[SELECTOR_SESSIONS_KEY])
    }
    if (
      stored[SELECTOR_LAST_OUTCOME_KEY] &&
      typeof stored[SELECTOR_LAST_OUTCOME_KEY] === 'object'
    ) {
      selectorLastOutcome = stored[SELECTOR_LAST_OUTCOME_KEY]
    }
  } catch (error) {
    console.warn('[Quizlab Bridge] The saved state could not be read:', errorMessage(error))
  }
  // Preferences and the pairing code survive browser restarts; transient
  // bridge state does not.
  try {
    const preferences = await chrome.storage.local.get(['autoSync', 'bridgeSecret'])
    autoSync = preferences.autoSync !== false
    // The session copy is the most recent one: the same worker wrote it after
    // the app verified the code, and it survives a worker restart. The local
    // copy is the fallback for a browser restart, when the session store is
    // empty. A local write that failed after a verified pairing must not make
    // its old code win over the verified one.
    if (
      !hasSessionSecret &&
      typeof preferences.bridgeSecret === 'string' &&
      preferences.bridgeSecret
    ) {
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
 * The secret a request is signed with.
 *
 * Every normal request signs with the committed pairing code. A pairing probe
 * passes its candidate explicitly instead: the worker must not put a code it
 * has not verified into the state every other flow signs with, or a heartbeat
 * that overlaps the probe would sign with the candidate and a wrong code would
 * look like a broken pairing.
 */
function requestSecret(secret) {
  if (typeof secret === 'string' && secret) return secret
  return bridgeSecret
}

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
async function requestSiteList(port, secret) {
  const signingSecret = requestSecret(secret)
  try {
    const headers = baseHeaders()
    if (signingSecret) {
      headers['x-hmac-signature'] = await computeHmac(signingPayload(SITE_LIST_PATH), signingSecret)
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
 * Whether a health answer belongs to this build.
 *
 * The development build only talks to a bridge that says it is the development
 * one. The release build also accepts a bridge that predates the field: an app
 * installed before the two builds existed is still the app this extension was
 * paired with, and refusing it would break that install for no security gain —
 * the port range, the pinned origin and the HMAC still hold.
 */
function acceptsBridgeEnvironment(value) {
  if (value === EXTENSION_ENVIRONMENT) return true
  if (value === undefined && EXTENSION_ENVIRONMENT === 'prod') return true
  return false
}

/**
 * The health endpoint of the bridge.
 *
 * It answers with the protocol the app speaks, an instance id and the
 * environment it belongs to; it does not carry the shared secret. A port that
 * does not answer is simply not the bridge, so a failed request is not worth a
 * warning.
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
    if (!acceptsBridgeEnvironment(data.environment)) {
      // Another app listens here: not ours, whatever the port says.
      console.warn(
        '[Quizlab Bridge] Ignored a bridge of the',
        String(data.environment),
        'environment on port',
        port
      )
      return null
    }
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
async function postPacket(packet, port, secret) {
  const signingSecret = requestSecret(secret)
  try {
    const body = JSON.stringify(packet)
    const headers = { ...baseHeaders(), 'Content-Type': 'application/json' }
    if (signingSecret) {
      headers['x-hmac-signature'] = await computeHmac(signingPayload(body), signingSecret)
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
function statePushedTo(list, fingerprint, instanceId) {
  return (
    lastPush !== null &&
    lastPush.instanceId === instanceId &&
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
async function pushTargets(targets, port, secret) {
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
    const outcome = await postPacket(packet, port, secret)
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
async function reportOutdatedOnce(list, port, secret) {
  const key = `${list.protocolVersion}:${targetsFingerprint(list.targets)}`
  if (outdatedState === key) return
  let delivered = true
  for (const target of list.targets) {
    const outcome = await postPacket(
      { targetId: target.siteId, status: 'permission_missing', cookies: [] },
      port,
      secret
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
  const instanceId =
    typeof settings.instanceId === 'string' ? settings.instanceId : bridgeInstanceId

  // Without the pairing code the site list is signed wrong and refused; the
  // popup is where the user enters it. A pairing probe passes its candidate
  // explicitly, so the committed code of every other flow stays untouched.
  const secret = requestSecret(settings.secret)
  if (!secret) return SYNC_UNREACHABLE

  const request = await requestSiteList(port, secret)
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
    await reportOutdatedOnce(list, port, secret)
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
    (settings.connect === true && !statePushedTo(list, fingerprint, instanceId)) ||
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

  const summary = await pushTargets(targets, port, secret)
  if (changed) {
    lastConfigVersion = list.configVersion
    knownTargets = list.targets
    applyWakeUpFilter()
  }
  const incomplete = summary.refused > 0 || summary.retry > 0 || summary.tooLarge > 0
  if (!incomplete && targets.length === list.targets.length) {
    // The whole state reached the bridge: it does not have to be sent again.
    lastPush = {
      instanceId,
      configVersion: list.configVersion,
      fingerprint
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
  if (summary.noCookies > 0 || summary.permissionMissing > 0) {
    // Some sessions were imported, but not all of them: a plain "ok" would let
    // the popup claim the whole transfer succeeded.
    return SYNC_PARTIAL
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
 * Runs one pairing after the previous one finished.
 *
 * Two pairing dialogs can send two requests at once. Each request has to
 * validate its own code against an unchanged connection, and a later request
 * must not restore the port or the instance a successful earlier one
 * committed. Serializing the whole task — not only the scan it uses — keeps
 * `pairingInFlight` truthful and each response tied to its own code.
 */
function runPairing(task) {
  const run = pairingQueue.catch(() => undefined).then(task)
  pairingQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
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
  // A pairing scan signs with its candidate; every other scan signs with the
  // committed code.
  const secret = requestSecret(settings.secret)
  try {
    for (let port = PORT_START; port <= PORT_END; port++) {
      const health = await fetchHealth(port)
      if (!health) continue
      if (!secret) {
        // The bridge is there, but the extension is not paired yet. Staying in
        // scan mode keeps the popup's pairing action the only way forward.
        await enterScanMode()
        return SYNC_UNREACHABLE
      }

      // The instance id identifies the running bridge: a bridge that answers
      // with another id is a new one, and the app may have lost its session in
      // the meantime. A bridge that could not be reached for a moment does not
      // make the next one a new one.
      //
      // The candidate is kept local until the app proved that it is talking to
      // this worker: a wrong pairing code must never change the port or the
      // instance every other flow is using.
      const candidatePort = port
      const candidateInstanceId =
        typeof health.instanceId === 'string' ? health.instanceId : bridgeInstanceId
      const justConnected = candidateInstanceId !== bridgeInstanceId

      const result = await queueSend({
        port: candidatePort,
        instanceId: candidateInstanceId,
        connect: justConnected,
        secret,
        // A pairing is the user asking for the sessions: it pushes the sites
        // even when this bridge already had them.
        resync: settings.resync === true
      })
      if (result === SYNC_UNREACHABLE || result === SYNC_UNAUTHORIZED) {
        // The app is up but did not confirm the connection. The worker must not
        // stay in a fake "connected" state: it goes back to scanning, and the
        // scan alarm is always (re-)armed.
        //
        // A probe is the exception: it only proved that its candidate code is
        // not the app's, not that the committed code stopped working. Leaving
        // the heartbeat alone keeps a wrong pairing attempt from disconnecting
        // a working extension.
        if (settings.probe !== true) {
          if (result === SYNC_UNAUTHORIZED) await setPairingInvalid(true)
          await enterScanMode()
        }
        return result
      }

      // The app answered with a signed list, so the port and the instance it
      // named are now the active connection.
      bridgeInstanceId = candidateInstanceId
      bridgePort = candidatePort
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

/* -------------------------------------------------------------------------
 * Magic selector
 *
 * The popup drives this section; the page-side work happens in the injected
 * `content/picker.js`. Three rules shape it:
 *
 *   1. The transfer never touches the cookie queue or the cookie alarm loop.
 *      It has its own signed path, its own port discovery and its own state.
 *   2. A pick is bound to one tab, one document and one session id, so two
 *      tabs (or two picks) can never deliver into each other.
 *   3. The worker may die between the confirm and the POST. The session is
 *      therefore in the session store, the request id is stable, and the app
 *      deduplicates a retried request instead of writing twice.
 * ---------------------------------------------------------------------- */

/** The transfer went through and the app stored the selector. */
const SELECTOR_SAVED = 'saved'
/** The app verified nothing because the site is not open in QuizLab. */
const SELECTOR_SITE_NOT_OPEN = 'site_not_open'
/** The app refused the selector after checking it in its own view. */
const SELECTOR_VERIFICATION_FAILED = 'verification_failed'
/** The app does not accept this build's pairing code. */
const SELECTOR_UNPAIRED = 'unpaired'
/** The app refused the request for good. */
const SELECTOR_REJECTED = 'rejected'
/** The bridge did not answer. */
const SELECTOR_UNREACHABLE = 'unreachable'
/** The app predates the selector feature. */
const SELECTOR_UNSUPPORTED = 'unsupported'

/** The selector states an outcome may have. */
const SELECTOR_SESSION_STATES = ['active', 'sending', 'saved', 'cancelled', 'retryable', 'failed']

function normalizeSelectorSites(value) {
  if (!Array.isArray(value)) return []
  const sites = []
  const seen = new Set()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const siteId = typeof entry.siteId === 'string' ? entry.siteId.trim() : ''
    const hostname = typeof entry.hostname === 'string' ? entry.hostname.trim().toLowerCase() : ''
    if (!siteId || !hostname) continue
    const pathPrefix =
      typeof entry.pathPrefix === 'string' && entry.pathPrefix.trim()
        ? entry.pathPrefix.trim().replace(/\/+$/, '')
        : ''
    // One host may carry several sites below different paths; the host alone is
    // not their identity.
    const key = `${hostname}\n${pathPrefix}`
    if (seen.has(key)) continue
    seen.add(key)
    const hosts = []
    if (Array.isArray(entry.hosts)) {
      for (const host of entry.hosts) {
        if (typeof host !== 'string') continue
        const normalized = host
          .trim()
          .toLowerCase()
          .replace(/^\*?\./, '')
        if (normalized && !hosts.includes(normalized)) hosts.push(normalized)
      }
    }
    if (!hosts.includes(hostname)) hosts.unshift(hostname)
    const fields = Array.isArray(entry.fields)
      ? entry.fields.filter((field) => field === 'input' || field === 'button')
      : []
    const displayName =
      typeof entry.displayName === 'string' && entry.displayName.trim()
        ? entry.displayName.trim().slice(0, 120)
        : siteId
    const status = normalizeSelectorStatusPair(entry.status)
    let hostStatuses = null
    if (entry.hostStatuses && typeof entry.hostStatuses === 'object') {
      const normalizedMap = {}
      for (const [hostKey, pair] of Object.entries(entry.hostStatuses)) {
        const normalizedHost = typeof hostKey === 'string' ? hostKey.trim().toLowerCase() : ''
        const normalizedPair = normalizeSelectorStatusPair(pair)
        if (normalizedHost && normalizedPair) normalizedMap[normalizedHost] = normalizedPair
      }
      if (Object.keys(normalizedMap).length > 0) hostStatuses = normalizedMap
    }
    sites.push({
      siteId,
      displayName,
      hostname,
      hosts,
      ...(pathPrefix ? { pathPrefix } : {}),
      fields: fields.length > 0 ? fields : ['input', 'button'],
      ...(status ? { status } : {}),
      ...(hostStatuses ? { hostStatuses } : {})
    })
  }
  return sites
}

function normalizeSelectorStatus(value) {
  if (
    value === 'ready' ||
    value === 'migrated' ||
    value === 'repaired' ||
    value === 'needs_repick' ||
    value === 'missing' ||
    value === 'unknown'
  ) {
    return value
  }
  return 'missing'
}

function normalizeSelectorStatusPair(value) {
  if (!value || typeof value !== 'object') return null
  return {
    input: normalizeSelectorStatus(value.input),
    button: normalizeSelectorStatus(value.button)
  }
}

function normalizeSelectorSessions(value) {
  if (!Array.isArray(value)) return []
  const now = Date.now()
  const sessions = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.sessionId !== 'string' || !entry.sessionId) continue
    if (!Number.isInteger(entry.tabId)) continue
    if (typeof entry.hostname !== 'string' || !entry.hostname) continue
    if (entry.field !== 'input' && entry.field !== 'button') continue
    const startedAt = typeof entry.startedAt === 'number' ? entry.startedAt : 0
    if (!startedAt || now - startedAt > SELECTOR_SESSION_TTL_MS) continue
    sessions.push({
      sessionId: entry.sessionId,
      requestId: typeof entry.requestId === 'string' ? entry.requestId : '',
      tabId: entry.tabId,
      frameId: Number.isInteger(entry.frameId) ? entry.frameId : 0,
      documentId: typeof entry.documentId === 'string' ? entry.documentId : '',
      hostname: entry.hostname.trim().toLowerCase(),
      siteId: typeof entry.siteId === 'string' ? entry.siteId : '',
      field: entry.field,
      startHref: typeof entry.startHref === 'string' ? entry.startHref : '',
      startedAt,
      state: SELECTOR_SESSION_STATES.includes(entry.state) ? entry.state : 'active',
      outcome: typeof entry.outcome === 'string' ? entry.outcome : null,
      lastSelector: typeof entry.lastSelector === 'string' ? entry.lastSelector : null,
      lastPayloadDigest:
        typeof entry.lastPayloadDigest === 'string' ? entry.lastPayloadDigest : null
    })
  }
  return sessions.slice(-MAX_SELECTOR_SESSIONS)
}

/** Whether a host belongs to a site (the site's own host or a subdomain). */
function hostBelongsToSelectorSite(host, site) {
  const normalized = typeof host === 'string' ? host.trim().toLowerCase() : ''
  if (!normalized) return false
  return site.hosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`))
}

/** Pages that are never a pick target (login, account, OAuth). */
const EXCLUDED_SELECTOR_PATH_PATTERNS =
  /^\/(?:auth|login|signin|sign-in|signup|sign-up|register|account|accounts|oauth|sso|session)(?:\/|$)/i

function pathBelongsToSelectorSite(pathname, site) {
  const path = typeof pathname === 'string' && pathname ? pathname : '/'
  if (EXCLUDED_SELECTOR_PATH_PATTERNS.test(path)) return false
  if (!site.pathPrefix) return true
  return path === site.pathPrefix || path.startsWith(`${site.pathPrefix}/`)
}

/**
 * The site a hostname (and page path) belongs to.
 *
 * The same ranking as the app: exact host first, then the longest host suffix,
 * then the most specific entry path. A tie between different sites is
 * ambiguous and is refused instead of being decided by list order.
 */
function findSelectorSiteMatch(host, pathname) {
  const normalized = typeof host === 'string' ? host.trim().toLowerCase() : ''
  if (!normalized) return null
  const ranked = []
  for (const site of selectorSites) {
    if (!pathBelongsToSelectorSite(pathname, site)) continue
    let tier = -1
    let hostLength = 0
    for (const allowed of site.hosts) {
      if (normalized === allowed) {
        const candidateTier = normalized === site.hostname ? 0 : 1
        if (tier === -1 || candidateTier < tier) {
          tier = candidateTier
          hostLength = allowed.length
        }
        continue
      }
      if (normalized.endsWith(`.${allowed}`)) {
        if (tier === -1 || 2 < tier) {
          tier = 2
          hostLength = allowed.length
        } else if (tier === 2 && allowed.length > hostLength) {
          hostLength = allowed.length
        }
      }
    }
    if (tier < 0) continue
    ranked.push({
      site,
      tier,
      hostLength,
      pathLength: site.pathPrefix ? site.pathPrefix.length : 0
    })
  }
  if (ranked.length === 0) return null
  ranked.sort((left, right) => {
    if (left.tier !== right.tier) return left.tier - right.tier
    if (left.hostLength !== right.hostLength) return right.hostLength - left.hostLength
    return right.pathLength - left.pathLength
  })
  const best = ranked[0]
  const storageConflict = selectorSites.some(
    (other) => other.siteId !== best.site.siteId && other.hostname === best.site.hostname
  )
  const ambiguous =
    storageConflict ||
    ranked.some(
      (entry) =>
        entry.tier === best.tier &&
        entry.hostLength === best.hostLength &&
        entry.pathLength === best.pathLength &&
        entry.site.siteId !== best.site.siteId
    )
  return { site: best.site, ambiguous }
}

/** The site a hostname belongs to, or null when it is absent or ambiguous. */
function findSelectorSite(host, pathname) {
  const match = findSelectorSiteMatch(host, pathname)
  return match && !match.ambiguous ? match.site : null
}

/** What the extension signs when it asks for the selector sites. */
function selectorSitesSigningPayload() {
  return `${profileId}\n${SELECTOR_SITES_PATH}`
}

/** What the extension signs when it sends a pick. */
function selectorTransferSigningPayload(requestId, body) {
  return `${profileId}\n${SELECTOR_TRANSFER_PATH}\n${requestId}\n${body}`
}

/**
 * Writes the pick list, one write at a time.
 *
 * The snapshot is built when the write runs, so a pick that finishes while an
 * earlier write is on its way is never overwritten by the older list.
 */
function persistSelectorSessions() {
  selectorSessions = selectorSessions.slice(-MAX_SELECTOR_SESSIONS)
  selectorSessionsWrite = selectorSessionsWrite
    .catch(() => undefined)
    .then(() => persistState({ [SELECTOR_SESSIONS_KEY]: selectorSessions }))
  return selectorSessionsWrite
}

/** Forgets the picks whose content script is gone. */
function pruneSelectorSessions() {
  const now = Date.now()
  selectorSessions = selectorSessions.filter(
    (session) => now - session.startedAt <= SELECTOR_SESSION_TTL_MS
  )
}

async function openSelectorSession(session) {
  const existing = selectorSessions.findIndex((entry) => entry.sessionId === session.sessionId)
  if (existing >= 0) selectorSessions[existing] = session
  else selectorSessions.push(session)
  pruneSelectorSessions()
  await persistSelectorSessions()
}

async function updateSelectorSession(sessionId, patch) {
  const index = selectorSessions.findIndex((entry) => entry.sessionId === sessionId)
  if (index < 0) return
  selectorSessions[index] = { ...selectorSessions[index], ...patch }
  await persistSelectorSessions()
}

/** Asks the bridge for the selector sites on one port. */
async function fetchSelectorSites(port, secret) {
  try {
    const headers = baseHeaders()
    headers['x-hmac-signature'] = await computeHmac(selectorSitesSigningPayload(), secret)
    const response = await fetch(`http://${BRIDGE_HOST}:${port}${SELECTOR_SITES_PATH}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(2500)
    })
    if (response.status === 401) return { outcome: SELECTOR_UNPAIRED }
    if (response.status === 404) {
      // The app is there but predates the feature. The popup says so instead of
      // pretending the extension is broken.
      return { outcome: SELECTOR_UNSUPPORTED }
    }
    if (!response.ok) return { outcome: 'error', status: response.status }
    const data = await response.json()
    if (!data || typeof data !== 'object') return { outcome: 'error' }
    const version = typeof data.version === 'number' ? data.version : 0
    if (version < SELECTOR_TRANSFER_VERSION) return { outcome: SELECTOR_UNSUPPORTED }
    return {
      outcome: 'ok',
      sites: normalizeSelectorSites(data.sites)
    }
  } catch {
    return { outcome: 'unreachable' }
  }
}

/**
 * Finds the bridge without disturbing the cookie side of it.
 *
 * The remembered port is tried first; a stale one falls back to the range of
 * this build. Nothing here pushes cookies, touches the alarms or advances the
 * site-session rounds.
 */
async function resolveSelectorBridge() {
  await stateReady
  const secret = bridgeSecret
  if (!secret) return { state: SELECTOR_UNPAIRED }
  pruneSelectorSessions()

  const ports = []
  if (typeof bridgePort === 'number') ports.push(bridgePort)
  // A restarted app can listen on another port of the range. The remembered
  // port is tried first, then the whole range: otherwise the user has to
  // reopen the panel after every app restart.
  for (let port = PORT_START; port <= PORT_END; port++) {
    if (!ports.includes(port)) ports.push(port)
  }

  for (const port of ports) {
    const result = await fetchSelectorSites(port, secret)
    if (result.outcome === SELECTOR_UNPAIRED) return { state: SELECTOR_UNPAIRED }
    if (result.outcome === 'ok' || result.outcome === SELECTOR_UNSUPPORTED) {
      if (bridgePort !== port) {
        bridgePort = port
        await persistState({ bridgePort })
      }
      if (result.outcome === 'ok') {
        selectorSupported = true
        selectorSites = result.sites
        await persistState({ [SELECTOR_SITES_KEY]: selectorSites })
        return { state: 'ok' }
      }
      selectorSupported = false
      return { state: SELECTOR_UNSUPPORTED }
    }
  }

  if (typeof bridgePort === 'number') {
    // The remembered port did not answer. A restarted app may listen on another
    // port of the range; the worker's own reconnect finds it and the next
    // popup open uses it. The popup does not wait for a full scan here.
    void scanForBridge({})
  }
  return { state: SELECTOR_UNREACHABLE }
}

/** The tab's address, or null when the extension may not read it. */
async function readTabUrl(tabId) {
  if (!Number.isInteger(tabId)) return null
  try {
    const tab = await chrome.tabs.get(tabId)
    return typeof tab?.url === 'string' && tab.url ? tab.url : null
  } catch {
    return null
  }
}

/** The host of a URL, or null when the URL is not a web page. */
function hostOfUrl(url) {
  if (typeof url !== 'string' || !url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/** The path of a web page URL, or undefined. */
function pathOfUrl(url) {
  if (typeof url !== 'string' || !url) return undefined
  try {
    return new URL(url).pathname || '/'
  } catch {
    return undefined
  }
}

/** The origin patterns that let the extension inject a picker into a host. */
function selectorOriginPatterns(host) {
  const normalized = typeof host === 'string' ? host.trim().toLowerCase() : ''
  if (!normalized) return []
  // Both spellings are probed: depending on the Chrome version and the grant,
  // `contains` matches the exact host pattern and/or the wildcard one.
  return [`https://${normalized}/*`, `https://*.${normalized}/*`]
}

/** Whether the extension may inject the picker into this host. */
async function hasSelectorPermission(host) {
  const patterns = selectorOriginPatterns(host)
  if (patterns.length === 0) return false
  if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') return true
  for (const pattern of patterns) {
    try {
      if (await chrome.permissions.contains({ origins: [pattern] })) return true
    } catch {
      return false
    }
  }
  return false
}

/** The site and field a tab may be picked on, or an error code. */
async function resolveSelectorTarget(tabId, field) {
  const url = await readTabUrl(tabId)
  const host = hostOfUrl(url)
  if (!host) return { error: 'unsupported_tab' }
  const match = findSelectorSiteMatch(host, pathOfUrl(url))
  if (!match) return { error: 'unsupported_site' }
  if (match.ambiguous) return { error: 'ambiguous_site' }
  const site = match.site
  const requested = field === 'button' ? 'button' : field === 'input' ? 'input' : null
  if (!requested) return { error: 'invalid_field' }
  if (!site.fields.includes(requested)) return { error: 'unsupported_field' }
  return { url, host, site, field: requested }
}

/** Starts one pick: injects the page-side scripts and remembers the session. */
async function startSelectorPick(tabId, field) {
  const bridge = await resolveSelectorBridge()
  if (bridge.state !== 'ok') {
    return { success: false, error: bridge.state }
  }

  const target = await resolveSelectorTarget(tabId, field)
  if (target.error) return { success: false, error: target.error }

  // `activeTab` may grant access even when `permissions.contains` says the host
  // is not granted (the user opened the panel from the toolbar button), so the
  // injection is attempted and its error is classified. A pre-check would
  // refuse a pick that Chrome would have allowed.
  const previous = selectorSessions.filter((session) => session.tabId === tabId)
  let cancelledPrevious = false
  for (const session of previous) {
    if (session.state !== 'saved' && session.state !== 'cancelled') {
      session.state = 'cancelled'
      cancelledPrevious = true
    }
  }
  if (cancelledPrevious) {
    await persistSelectorSessions()
  }

  const sessionId = crypto.randomUUID()
  const requestId = crypto.randomUUID()

  let injection = null
  try {
    injection = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ['content/selector-engine.js', 'content/picker.js']
    })
  } catch (error) {
    console.warn('[Quizlab Bridge] The picker could not be injected:', errorMessage(error))
    const detail = errorMessage(error)
    const denied = /cannot access|permission|not allowed|extensions gallery/i.test(detail)
    return {
      success: false,
      error: denied ? 'permission_missing' : 'cannot_inject',
      hostname: target.host,
      origins: selectorOriginPatterns(target.host),
      detail
    }
  }

  const result = Array.isArray(injection) ? injection[0] : null
  if (!result) return { success: false, error: 'cannot_inject', detail: 'no_injection_result' }

  const session = {
    sessionId,
    requestId,
    tabId,
    frameId: Number.isInteger(result.frameId) ? result.frameId : 0,
    documentId: typeof result.documentId === 'string' ? result.documentId : '',
    hostname: target.host,
    siteId: target.site.siteId,
    field: target.field,
    startHref: target.url,
    startedAt: Date.now(),
    state: 'active',
    outcome: null,
    lastSelector: null,
    lastPayloadDigest: null
  }
  await openSelectorSession(session)

  const initMessage = {
    type: 'quizlab_selector_init',
    sessionId,
    field: target.field,
    startHref: target.url
  }
  try {
    if (session.documentId) {
      // Address the document the injection landed in. A navigation between the
      // injection and this message otherwise lets the init reach another
      // document, where no picker exists.
      await chrome.tabs.sendMessage(tabId, initMessage, { documentId: session.documentId })
    } else {
      await chrome.tabs.sendMessage(tabId, initMessage)
    }
  } catch (error) {
    const detail = errorMessage(error)
    if (session.documentId) {
      try {
        await chrome.tabs.sendMessage(tabId, initMessage)
      } catch (fallbackError) {
        await updateSelectorSession(sessionId, { state: 'failed', outcome: 'cannot_inject' })
        console.warn(
          '[Quizlab Bridge] The picker did not accept init:',
          errorMessage(fallbackError)
        )
        return { success: false, error: 'cannot_inject', detail: errorMessage(fallbackError) }
      }
    } else {
      await updateSelectorSession(sessionId, { state: 'failed', outcome: 'cannot_inject' })
      console.warn('[Quizlab Bridge] The picker did not accept init:', detail)
      return { success: false, error: 'cannot_inject', detail }
    }
  }

  return {
    success: true,
    sessionId,
    field: target.field,
    hostname: target.host,
    site: {
      siteId: target.site.siteId,
      displayName: target.site.displayName,
      hostname: target.site.hostname
    }
  }
}

/** Sends one pick to the app and tells the panel what the app did with it. */
async function postSelectorPick(session, payload) {
  const secret = bridgeSecret
  if (!secret) return { state: SELECTOR_UNPAIRED }

  if (!bridgePort || selectorSupported !== true) {
    const bridge = await resolveSelectorBridge()
    if (bridge.state !== 'ok') {
      return {
        state: bridge.state === SELECTOR_UNSUPPORTED ? SELECTOR_REJECTED : bridge.state
      }
    }
  }

  const body = JSON.stringify({
    version: SELECTOR_TRANSFER_VERSION,
    requestId: session.requestId,
    hostname: session.hostname,
    ...(session.siteId ? { siteId: session.siteId } : {}),
    field: session.field,
    selector: payload.selector,
    candidates: payload.candidates,
    fingerprint: payload.fingerprint,
    sourceUrl: payload.sourceUrl
  })
  const headers = {
    ...baseHeaders(),
    'Content-Type': 'application/json',
    [SELECTOR_REQUEST_ID_HEADER]: session.requestId
  }

  try {
    headers['x-hmac-signature'] = await computeHmac(
      selectorTransferSigningPayload(session.requestId, body),
      secret
    )
    const response = await fetch(`http://${BRIDGE_HOST}:${bridgePort}${SELECTOR_TRANSFER_PATH}`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(12000)
    })

    let result = null
    try {
      result = await response.json()
    } catch {
      result = null
    }
    const error = typeof result?.error === 'string' ? result.error : ''

    if (response.ok) {
      if (result?.status === 'saved' || result?.saved === true) {
        return {
          state: SELECTOR_SAVED,
          ...(typeof result?.hostname === 'string' && result.hostname
            ? { hostname: result.hostname }
            : {})
        }
      }
      return { state: SELECTOR_REJECTED, message: 'Aktarım kaydedilmedi.' }
    }
    if (response.status === 401) return { state: SELECTOR_UNPAIRED }
    if (response.status === 409 && error === 'duplicate_request') {
      // An older bridge answers a retry with this and no outcome. Claiming the
      // pick was saved would be a false success: the first attempt may have
      // been refused. The user re-picks while the site is open.
      return {
        state: SELECTOR_REJECTED,
        message:
          'Bu seçimin önceki sonucu bilinmiyor. Siteyi QuizLab’da açıp seçimi yeniden gönderin.'
      }
    }
    if (response.status === 409 && error === 'site_not_open') {
      return { state: SELECTOR_SITE_NOT_OPEN }
    }
    if (response.status === 422) {
      return {
        state: SELECTOR_VERIFICATION_FAILED,
        reason: typeof result?.reason === 'string' ? result.reason : ''
      }
    }
    if (response.status === 404) return { state: SELECTOR_REJECTED }
    if (response.status >= 500) return { state: SELECTOR_UNREACHABLE }
    return { state: SELECTOR_REJECTED, reason: error || `status_${response.status}` }
  } catch (error) {
    console.warn('[Quizlab Bridge] The pick could not be sent:', errorMessage(error))
    return { state: SELECTOR_UNREACHABLE }
  }
}

/**
 * Tells the open side panel that a pick produced a result.
 *
 * The panel no longer closes itself while the pick runs, so the result has to
 * reach it without a reload. Nobody listening (the panel is closed) is the
 * normal case and not an error.
 */
function broadcastSelectorOutcome(outcome) {
  try {
    chrome.runtime.sendMessage({ type: 'selector_outcome', outcome }, () => {
      void chrome.runtime.lastError
    })
  } catch {
    // A worker without a runtime page to answer keeps the stored outcome.
  }
}

function minimizeSelectorSourceUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return ''
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return rawUrl.trim()
    return `${parsed.origin}${parsed.pathname || '/'}`
  } catch {
    return rawUrl.trim()
  }
}

async function computeSelectorPayloadDigest(session, payload) {
  const canonical = JSON.stringify({
    version: SELECTOR_TRANSFER_VERSION,
    hostname: session.hostname,
    siteId: session.siteId || '',
    field: session.field,
    selector: payload.selector,
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
    fingerprint: payload.fingerprint || null,
    sourceUrl: payload.sourceUrl || ''
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A result from one tab, bound to its own session and document. */
async function handleSelectorPickResult(message, sender) {
  await stateReady
  pruneSelectorSessions()

  const tabId = sender?.tab?.id
  const sessionId = typeof message.sessionId === 'string' ? message.sessionId : ''
  if (!Number.isInteger(tabId) || !sessionId) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim oturumu bulunamadı.' }
  }
  const session = selectorSessions.find((entry) => entry.sessionId === sessionId)
  if (
    !session ||
    session.tabId !== tabId ||
    Date.now() - session.startedAt > SELECTOR_SESSION_TTL_MS
  ) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim oturumu bulunamadı.' }
  }
  // The document check keeps a result from a previous page (the tab navigated
  // and the new page injected its own script) out of this session.
  if (Number.isInteger(sender.frameId) && sender.frameId !== session.frameId) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim başka bir çerçeveden geldi.' }
  }
  if (
    session.documentId &&
    typeof sender.documentId === 'string' &&
    sender.documentId !== session.documentId
  ) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim eski bir sayfadan geldi.' }
  }

  const payload = message.payload
  if (!payload || typeof payload !== 'object') {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim verisi eksik.' }
  }
  if (typeof payload.selector !== 'string' || payload.selector.length === 0) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçici eksik.' }
  }
  if (session.field !== message.field) {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Hedef alan uyuşmuyor.' }
  }

  const minimizedSourceUrl = minimizeSelectorSourceUrl(payload.sourceUrl)
  const normalizedFingerprint =
    session.field === 'input' && payload.fingerprint && typeof payload.fingerprint === 'object'
      ? (() => {
          const copy = { ...payload.fingerprint }
          delete copy.text
          return copy
        })()
      : payload.fingerprint
  const normalizedPayload = {
    ...payload,
    fingerprint: normalizedFingerprint,
    sourceUrl: minimizedSourceUrl
  }
  const payloadDigest = await computeSelectorPayloadDigest(session, normalizedPayload)

  if (session.state === 'cancelled') {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim oturumu iptal edildi.' }
  }
  if (session.state === 'failed') {
    return { ok: false, state: SELECTOR_REJECTED, message: 'Seçim oturumu geçersiz.' }
  }
  if (session.state === 'saved') {
    if (session.lastPayloadDigest && session.lastPayloadDigest === payloadDigest) {
      return { ok: true, state: SELECTOR_SAVED }
    }
    return {
      ok: false,
      state: SELECTOR_REJECTED,
      message: 'Bu oturum zaten farklı bir seçimle tamamlandı.'
    }
  }

  // Two confirms of the exact same payload share one write; a different
  // payload arriving while another send is in flight must never share it.
  const running = selectorSends.get(sessionId)
  if (running) {
    if (running.payloadDigest === payloadDigest) return running.promise
    return {
      ok: false,
      state: SELECTOR_REJECTED,
      message: 'Önceki seçim aktarımı devam ediyor.'
    }
  }

  let requestId = session.requestId
  const payloadChanged = session.lastPayloadDigest
    ? session.lastPayloadDigest !== payloadDigest
    : Boolean(session.lastSelector && session.lastSelector !== payload.selector)
  if (payloadChanged || !requestId) {
    // Any meaningful payload change (selector, candidates, fingerprint, or URL)
    // gets a fresh idempotency key so the bridge does not reject it as a conflict.
    requestId = crypto.randomUUID()
    session.requestId = requestId
  }
  session.lastSelector = payload.selector
  session.lastPayloadDigest = payloadDigest

  const run = (async () => {
    await updateSelectorSession(sessionId, {
      state: 'sending',
      requestId,
      lastSelector: payload.selector,
      lastPayloadDigest: payloadDigest
    })
    const outcome = await postSelectorPick(session, normalizedPayload)

    const current = selectorSessions.find((entry) => entry.sessionId === sessionId)
    const wasCancelled = current?.state === 'cancelled'
    const hasNewerTabSession = selectorSessions.some(
      (entry) =>
        entry.tabId === session.tabId &&
        entry.sessionId !== sessionId &&
        entry.startedAt >= session.startedAt &&
        entry.state !== 'cancelled'
    )

    if (outcome.state === SELECTOR_SAVED) {
      await updateSelectorSession(sessionId, { state: 'saved', outcome: outcome.state })
      if (!hasNewerTabSession) {
        const record = {
          state: outcome.state,
          tabId: session.tabId,
          hostname: outcome.hostname || session.hostname,
          field: session.field,
          selector: payload.selector,
          at: Date.now()
        }
        selectorLastOutcome = record
        await persistState({ [SELECTOR_LAST_OUTCOME_KEY]: record })
        broadcastSelectorOutcome(record)
      }
      return { ok: true, state: SELECTOR_SAVED, retryable: false }
    }

    if (wasCancelled) {
      if (!hasNewerTabSession) {
        broadcastSelectorOutcome({
          state: SELECTOR_REJECTED,
          tabId: session.tabId,
          hostname: session.hostname,
          field: session.field,
          selector: payload.selector,
          at: Date.now(),
          message: 'Seçim oturumu iptal edildi.'
        })
      }
      return {
        ok: false,
        state: SELECTOR_REJECTED,
        retryable: false,
        message: 'Seçim oturumu iptal edildi.'
      }
    }

    const finalState =
      outcome.state === SELECTOR_REJECTED || outcome.state === SELECTOR_UNPAIRED
        ? 'failed'
        : 'retryable'

    const record = {
      state: outcome.state,
      tabId: session.tabId,
      hostname: session.hostname,
      field: session.field,
      selector: payload.selector,
      at: Date.now(),
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.message ? { message: outcome.message } : {})
    }
    await updateSelectorSession(sessionId, { state: finalState, outcome: outcome.state })
    if (!hasNewerTabSession) {
      selectorLastOutcome = record
      await persistState({ [SELECTOR_LAST_OUTCOME_KEY]: record })
      broadcastSelectorOutcome(record)
    }

    return {
      ok: false,
      state: outcome.state,
      retryable: finalState === 'retryable',
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.message ? { message: outcome.message } : {})
    }
  })()

  selectorSends.set(sessionId, { payloadDigest, promise: run })
  try {
    return await run
  } finally {
    if (selectorSends.get(sessionId)?.promise === run) selectorSends.delete(sessionId)
  }
}

/** What the panel shows: connection, the active tab's site, the last result. */
async function buildSelectorState(tabId) {
  const bridge = await resolveSelectorBridge()
  const url = await readTabUrl(tabId)
  const host = hostOfUrl(url)
  const match = host ? findSelectorSiteMatch(host, pathOfUrl(url)) : null
  const site = match && !match.ambiguous ? match.site : null
  const status = site
    ? (host && site.hostStatuses && site.hostStatuses[host]) ||
      site.status || { input: 'missing', button: 'missing' }
    : null
  const capability =
    selectorSupported === null ? null : selectorSupported === true ? 'selectors' : 'none'
  const permission = host ? await hasSelectorPermission(host) : false

  return {
    supported: capability,
    connection: bridge.state,
    host,
    permission,
    ambiguous: Boolean(match && match.ambiguous),
    site: site
      ? {
          siteId: site.siteId,
          displayName: site.displayName,
          hostname: site.hostname,
          pathPrefix: site.pathPrefix || null,
          fields: site.fields,
          status
        }
      : null,
    lastOutcome: selectorLastOutcome
  }
}

// Event listeners registered synchronously at top level (MV3 requirement)

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    void scanForBridge()
  } else if (alarm.name === HEARTBEAT_ALARM) {
    // The heartbeat polls the site list of the bridge it knows. It only
    // pushes when the app asked for something else than it did the last time.
    const requestCode = bridgeSecret
    void queueSend({}).then((result) => {
      // A result produced while the pairing probe runs — or with a code the
      // worker no longer holds — says nothing about the current pairing. A
      // wrong code or a re-pairing must not disconnect a working extension.
      if (pairingInFlight || requestCode !== bridgeSecret) return
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
 * Opens the panel when the toolbar button is pressed.
 *
 * The toolbar button has no popup any more, so without this Chrome would open
 * nothing. The call is repeated on every worker start because the preference
 * lives in Chrome and an older Chrome that has no side panel API must not throw
 * here.
 */
function enableSidePanelOnActionClick() {
  if (!chrome.sidePanel || typeof chrome.sidePanel.setPanelBehavior !== 'function') return
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) =>
      console.warn(
        '[Quizlab Bridge] The side panel behaviour could not be set:',
        errorMessage(error)
      )
    )
}

enableSidePanelOnActionClick()

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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        .then(() =>
          runPairing(async () => {
            // The candidate is only ever passed to the probe; it is not put
            // into the state every other flow signs with. A wrong code must
            // never replace the working one, and a heartbeat that overlaps the
            // probe must not sign with an unverified code. The code is saved
            // only after the app answered the signed site list request — which
            // is the proof that it holds this code. Whether the following
            // import succeeds is a separate result: pairing and transfer are
            // not the same success.
            pairingInFlight = true
            try {
              const result = await scanForBridge({
                force: true,
                probe: true,
                resync: true,
                secret: code
              })
              if (result === SYNC_UNAUTHORIZED) {
                return { success: false, error: 'invalid_code' }
              }
              if (result === SYNC_UNREACHABLE) {
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
            } finally {
              pairingInFlight = false
            }
          })
        )
        .then(
          (response) => sendResponse(response),
          (error) => sendResponse({ success: false, error: errorMessage(error) })
        )
      return true
    }
    if (message?.type === 'selector_state') {
      buildSelectorState(message.tabId)
        .then((state) => sendResponse({ success: true, ...state }))
        .catch((error) => sendResponse({ success: false, error: errorMessage(error) }))
      return true
    }
    if (message?.type === 'selector_start') {
      startSelectorPick(message.tabId, message.field)
        .then((response) => sendResponse(response))
        .catch((error) => sendResponse({ success: false, error: errorMessage(error) }))
      return true
    }
    if (message?.type === 'selector_pick_result') {
      handleSelectorPickResult(message, sender)
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({ ok: false, state: SELECTOR_UNREACHABLE, message: errorMessage(error) })
        )
      return true
    }
    if (message?.type === 'selector_pick_cancelled') {
      const sessionId = typeof message.sessionId === 'string' ? message.sessionId : ''
      if (sessionId) {
        void (async () => {
          await stateReady
          const session = selectorSessions.find((entry) => entry.sessionId === sessionId)
          if (!session) return { ok: false }
          if (Number.isInteger(sender?.tab?.id) && sender.tab.id !== session.tabId) {
            return { ok: false }
          }
          if (session.state === 'saved') return { ok: false, alreadySaved: true }
          await updateSelectorSession(sessionId, { state: 'cancelled' })
          return { ok: true }
        })()
          .then((result) => sendResponse(result))
          .catch(() => sendResponse({ ok: false }))
        return true
      }
      sendResponse({ ok: false })
      return false
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
