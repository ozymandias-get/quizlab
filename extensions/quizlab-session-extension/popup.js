/**
 * The permission popup of the Quizlab Reader site session extension.
 *
 * The extension reads the cookies of the sites the app names. The sites the
 * app ships with are covered by the host permissions the extension was
 * installed with; a site the user added afterwards is not. Chrome only grants
 * a permission that is asked for during a user gesture, so the user opens this
 * popup and presses the button of the site that is missing one.
 *
 * The popup is a permission screen and nothing else: it never reads a cookie
 * and never asks the network for anything. It reads the site list the service
 * worker persisted and asks Chrome for the permissions that are missing.
 */

/** The key the service worker persists the last site list under. */
const TARGETS_KEY = 'knownTargets'

/** The id of the element the status line lives in. */
const STATUS_ID = 'status'

/** The id of the element the sites are rendered into. */
const LIST_ID = 'sites'

/** What the popup says to the user. */
const TEXTS = {
  appMissing: 'Önce Quizlab Reader uygulamasını açın ve site oturumunu etkinleştirin.',
  noSite: 'İzin gerektiren site yok.',
  allGranted: 'Bütün siteler için izin verilmiş.',
  someMissing: 'Bazı siteler için izin gerekiyor.',
  granted: 'İzin verilmiş',
  missing: 'İzin gerekiyor',
  grant: 'İzin ver',
  declined: 'İzin verilmedi.',
  failed: 'İzin verilemedi.'
}

function errorMessage(error) {
  if (error && typeof error.message === 'string') return error.message
  return String(error)
}

/** The host of a cookie domain, without the leading dot. */
function hostOf(domain) {
  if (typeof domain !== 'string') return ''
  return domain.trim().toLowerCase().replace(/^\.+/, '')
}

/**
 * The pattern the popup asks for.
 *
 * The wildcard covers the host itself and every subdomain of it, so it covers
 * both patterns the service worker probes. Chrome lets the user narrow it out
 * of the optional host permissions the manifest declares.
 */
function wildcardPattern(host) {
  return `https://*.${host}/*`
}

/**
 * The origin patterns of a host.
 *
 * The service worker asks for the same two patterns, so the popup and the
 * worker agree on what "the extension may read this site" means.
 */
function originPatterns(host) {
  return [`https://${host}/*`, wildcardPattern(host)]
}

/** The hosts a site needs a permission for. */
function hostsOf(target) {
  const domains = Array.isArray(target?.cookieDomains) ? target.cookieDomains : []
  const hosts = []
  for (const domain of domains) {
    const host = hostOf(domain)
    if (host && !hosts.includes(host)) hosts.push(host)
  }
  return hosts
}

/**
 * Whether the extension may read a host.
 *
 * A check that fails is a check that did not pass: a throwing permissions API
 * means that the permission could not be proven, not that it is there.
 */
async function hasPermission(host) {
  if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') {
    // Without the permissions API the host permissions of the manifest are
    // the answer, and they were granted when the extension was installed.
    return true
  }
  for (const pattern of originPatterns(host)) {
    try {
      if (await chrome.permissions.contains({ origins: [pattern] })) return true
    } catch (error) {
      console.warn(
        '[Quizlab Popup] The permission of',
        pattern,
        'could not be read:',
        errorMessage(error)
      )
      return false
    }
  }
  return false
}

/** The hosts of a site that still need a permission. */
async function missingHosts(hosts) {
  const missing = []
  for (const host of hosts) {
    if (!(await hasPermission(host))) missing.push(host)
  }
  return missing
}

/**
 * The site list the service worker persisted, or null when there is none.
 *
 * The popup cannot ask the app itself: the app only answers a signed request
 * and the secret of the signature lives in the memory of the service worker.
 */
async function readTargets() {
  try {
    const stored = await chrome.storage.session.get(TARGETS_KEY)
    const targets = stored ? stored[TARGETS_KEY] : undefined
    if (!Array.isArray(targets)) return null
    return targets
  } catch (error) {
    console.warn('[Quizlab Popup] The site list could not be read:', errorMessage(error))
    return null
  }
}

function setStatus(message) {
  const element = document.getElementById(STATUS_ID)
  if (!element) return
  element.textContent = message
}

function clearList() {
  const list = document.getElementById(LIST_ID)
  if (!list) return
  list.replaceChildren()
}

/**
 * The row of one site.
 *
 * A site that already has its permission says so and offers no button: there
 * is nothing for the user to do about it.
 */
function renderRow(site) {
  const row = document.createElement('li')
  row.className = 'site'

  const name = document.createElement('span')
  name.className = 'site-name'
  name.textContent = site.siteId

  const domains = document.createElement('span')
  domains.className = 'site-domains'
  // A site that misses a permission shows the hosts that miss it: the others
  // are already taken care of.
  domains.textContent = (site.missing.length > 0 ? site.missing : site.hosts).join(', ')

  const state = document.createElement('span')
  state.className = 'site-state'
  state.textContent = site.missing.length > 0 ? TEXTS.missing : TEXTS.granted

  row.appendChild(name)
  row.appendChild(domains)
  row.appendChild(state)

  if (site.missing.length === 0) return row

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'grant'
  button.textContent = TEXTS.grant
  button.addEventListener('click', () => {
    // The request has to be made inside the click handler: Chrome only grants
    // a runtime permission to a request that comes from a user gesture.
    const request = chrome.permissions.request({
      origins: site.missing.map(wildcardPattern)
    })
    void Promise.resolve(request).then(onGranted, onFailed)
  })

  row.appendChild(button)
  return row
}

/** The user allowed the permission. */
async function onGranted(granted) {
  if (!granted) {
    setStatus(TEXTS.declined)
    return
  }
  await render()
}

/** The request itself failed. */
function onFailed(error) {
  console.warn('[Quizlab Popup] The permission could not be requested:', errorMessage(error))
  setStatus(TEXTS.failed)
}

/**
 * Renders the sites of the app and the permissions they still miss.
 */
async function renderSites() {
  const targets = await readTargets()
  if (targets === null) {
    clearList()
    setStatus(TEXTS.appMissing)
    return
  }

  const sites = []
  for (const target of targets) {
    const siteId = typeof target?.siteId === 'string' ? target.siteId.trim() : ''
    if (!siteId) continue
    const hosts = hostsOf(target)
    if (hosts.length === 0) continue
    const missing = await missingHosts(hosts)
    sites.push({ siteId, hosts, missing })
  }

  const list = document.getElementById(LIST_ID)
  if (list) list.replaceChildren(...sites.map(renderRow))

  const missingCount = sites.filter((site) => site.missing.length > 0).length
  if (sites.length === 0) setStatus(TEXTS.noSite)
  else if (missingCount === 0) setStatus(TEXTS.allGranted)
  else setStatus(TEXTS.someMissing)
}

async function render() {
  try {
    await renderSites()
  } catch (error) {
    console.warn('[Quizlab Popup] The popup could not be rendered:', errorMessage(error))
    setStatus(TEXTS.failed)
  }
}

void render()
