/**
 * The permission popup of the Quizlab Reader site session extension.
 *
 * The extension reads the cookies of the sites the app names. The sites the
 * app ships with are covered by the host permissions the extension was
 * installed with; a site the user added afterwards is not. Chrome only grants
 * a permission that is asked for during a user gesture, so the user opens this
 * popup and presses the button of the site that is missing one.
 *
 * The popup selects a destination and asks the worker to import. It never reads a cookie
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
 * The service worker asks for the same pattern, so the popup and the
 * worker agree on what "the extension may read this site" means.
 */
function originPatterns(host) {
  return [wildcardPattern(host)]
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
 * The storage area the site list is read from.
 *
 * The service worker writes the list into the session storage and falls back
 * to the local storage when the browser has no session storage. The popup
 * reads it from the same place, or it would not find the list at all.
 */
function storageArea() {
  try {
    return chrome.storage.session || chrome.storage.local || null
  } catch {
    return null
  }
}

/**
 * The site list the service worker persisted, or null when there is none.
 *
 * The popup cannot ask the app itself: the app only answers a signed request
 * and the secret of the signature lives in the memory of the service worker.
 */
async function readTargets() {
  const area = storageArea()
  if (!area) return null
  try {
    const stored = await area.get(TARGETS_KEY)
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
 * The name of a site.
 *
 * A user-added site carries an internal id (`custom:<id>`) that the user
 * never sees in the app, so the host of the site is its name. A built-in site
 * already has a readable id.
 */
function titleOf(site) {
  if (typeof site.label === 'string' && site.label.trim()) return site.label
  if (site.siteId.startsWith('custom:')) return site.hosts[0]
  return site.siteId
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
  name.textContent = titleOf(site)

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
    let request
    try {
      request = chrome.permissions.request({
        origins: site.missing.map(wildcardPattern)
      })
    } catch (error) {
      onFailed(error)
      return
    }
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
    sites.push({ siteId, hosts, missing, label: target.label })
  }

  const list = document.getElementById(LIST_ID)
  if (list) list.replaceChildren(...sites.map(renderRow))

  const missingCount = sites.filter((site) => site.missing.length > 0).length
  if (sites.length === 0) setStatus(TEXTS.noSite)
  else if (missingCount === 0) setStatus(TEXTS.allGranted)
  else setStatus(TEXTS.someMissing)
}

/**
 * Whether a value looks like the pairing code the app shows.
 */
function isPairingCode(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim())
}

/**
 * Reads the code the user paired this browser with, or null.
 */
async function readPairingCode() {
  try {
    const stored = await chrome.storage.local.get(['bridgeSecret'])
    const code = stored ? stored.bridgeSecret : null
    return isPairingCode(code) ? code.trim().toLowerCase() : null
  } catch {
    return null
  }
}

/** The default name of a profile the user has not named yet. */
const DEFAULT_PROFILE_NAME = 'Chrome'

/** The longest name the service worker accepts. */
const MAX_PROFILE_NAME_LENGTH = 60

/** The same normalization the service worker applies before saving. */
function normalizeProfileName(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replaceAll(/\s+/g, ' ').slice(0, MAX_PROFILE_NAME_LENGTH)
}

/** Shows the name in the popup header and in the Chrome tab title. */
function applyProfileLabel(name) {
  const label = document.getElementById('profile-label')
  if (label) label.textContent = `Bu Chrome profili: ${name}`
  document.title = `Quizlab site oturumları — ${name}`
}

/**
 * Wires the profile name field.
 *
 * The name is display data only: it lets the app tell two Chrome profiles
 * apart. The id that does the real identification is generated by the service
 * worker and never shown to the user.
 */
async function initProfileControls() {
  const input = document.getElementById('profile-name-input')
  const button = document.getElementById('profile-name-btn')
  const state = document.getElementById('profile-state')
  const feedback = document.getElementById('profile-feedback')
  if (!input || !button || button.dataset.initialized) return
  button.dataset.initialized = 'true'

  let storedName = DEFAULT_PROFILE_NAME
  let hasStoredName = false
  try {
    const stored = await chrome.storage.local.get(['profileName'])
    const normalized = normalizeProfileName(stored.profileName)
    if (normalized) {
      storedName = normalized
      hasStoredName = true
    }
  } catch {
    // The default name still works; the save below will report a failure.
  }
  input.value = storedName
  applyProfileLabel(storedName)
  if (state) {
    state.textContent = hasStoredName ? 'Kaydedildi' : 'Kaydedilmedi'
    state.dataset.saved = hasStoredName ? 'true' : 'false'
  }

  const showFeedback = (text, isSuccess) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = isSuccess ? 'success' : 'error'
  }

  const save = () => {
    const name = normalizeProfileName(input.value)
    if (!name) {
      showFeedback('Profil adı boş olamaz.', false)
      return
    }
    button.disabled = true
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'set_profile_name', name }, (response) => {
        resolve(chrome.runtime.lastError ? { success: false } : response)
      })
    })
      .then((response) => {
        button.disabled = false
        if (response && response.success) {
          input.value = name
          applyProfileLabel(name)
          if (state) {
            state.textContent = 'Kaydedildi'
            state.dataset.saved = 'true'
          }
          showFeedback('Profil adı kaydedildi.', true)
        } else {
          showFeedback('Profil adı kaydedilemedi.', false)
        }
      })
      .catch((error) => {
        button.disabled = false
        console.warn('[Quizlab Popup] The profile name could not be saved:', errorMessage(error))
        showFeedback('Profil adı kaydedilemedi.', false)
      })
  }

  button.addEventListener('click', save)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    }
  })
}

/**
 * Wires the pairing form.
 *
 * The popup writes the code to the local store and asks the service worker to
 * pair immediately; the worker signs the site-list request with it, so a wrong
 * code is reported here instead of silently leaving the session sync broken.
 */
async function initPairingControls() {
  const input = document.getElementById('pairing-code-input')
  const button = document.getElementById('pair-btn')
  const state = document.getElementById('pair-state')
  const feedback = document.getElementById('pair-feedback')
  if (!input || !button || button.dataset.initialized) return
  button.dataset.initialized = 'true'

  const existing = await readPairingCode()
  if (existing && state) {
    state.textContent = 'Eşleştirildi'
    state.dataset.paired = 'true'
  }

  const showFeedback = (text, isSuccess) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = isSuccess ? 'success' : 'error'
  }

  button.addEventListener('click', () => {
    const code = typeof input.value === 'string' ? input.value.trim().toLowerCase() : ''
    if (!isPairingCode(code)) {
      showFeedback('Kod 64 karakterlik olmalı. Kodu uygulamadan kopyalayın.', false)
      return
    }
    button.disabled = true
    showFeedback('Eşleştiriliyor...', true)
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'pair', secret: code }, (response) => {
        resolve(chrome.runtime.lastError ? { success: false } : response)
      })
    })
      .then((response) => {
        button.disabled = false
        if (response && response.success) {
          if (state) {
            state.textContent = 'Eşleştirildi'
            state.dataset.paired = 'true'
          }
          showFeedback('Eşleştirildi. Oturumlar aktarılabilir.', true)
          void renderSites()
        } else {
          showFeedback(
            'Eşleştirilemedi. Quizlab açık mı ve kodu doğru yapıştırdınız mı kontrol edin.',
            false
          )
        }
      })
      .catch((error) => {
        button.disabled = false
        console.warn('[Quizlab Popup] The pairing failed:', errorMessage(error))
        showFeedback('Eşleştirilemedi.', false)
      })
  })
}

async function initImportControls() {
  const syncBtn = document.getElementById('sync-btn')
  const feedback = document.getElementById('sync-feedback')
  const auto = document.getElementById('auto-sync')
  const siteSelect = document.getElementById('site-select')
  if (!syncBtn || syncBtn.dataset.initialized) return
  syncBtn.dataset.initialized = 'true'
  const area = chrome.storage?.local
  const stored = area ? await area.get(['autoSync']) : {}
  if (auto) auto.checked = stored?.autoSync !== false
  if (siteSelect) {
    const targets = await readTargets()
    for (const target of targets || []) {
      const option = document.createElement('option')
      option.value = target.siteId
      option.textContent = titleOf({ ...target, hosts: hostsOf(target) })
      siteSelect.appendChild(option)
    }
  }
  const showFeedback = (text, isSuccess) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = isSuccess ? 'success' : 'error'
  }
  auto?.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'set_auto_sync', enabled: auto.checked }, (response) => {
      const error = chrome.runtime.lastError
      if (error || !response?.success) {
        showFeedback(
          response?.settingsSaved
            ? 'Eşitleme ayarı kaydedildi ancak aktarım tamamlanamadı.'
            : 'Eşitleme ayarı kaydedilemedi.',
          false
        )
      }
    })
  })
  syncBtn?.addEventListener('click', () => {
    syncBtn.disabled = true
    showFeedback('Site oturumları aktarılıyor...', true)
    chrome.runtime.sendMessage(
      { type: 'sync_now', targetId: siteSelect?.value || undefined },
      (response) => {
        const error = chrome.runtime.lastError
        syncBtn.disabled = false
        if (auto && !error && (response?.autoSync === false || response?.success)) {
          auto.checked = false
        }
        if (!error && response?.result === 'not_selected') {
          showFeedback(
            'Bu Chrome profili Quizlab’da seçili değil. Quizlab → Ayarlar → Site Oturumları bölümünden bu profili seçin, sonra burada yeniden Aktar’a basın.',
            false
          )
        } else if (!error && response?.success) {
          showFeedback('Oturumlar aktarıldı. Site oturumu uygulamaya aktarıldı.', true)
        } else {
          showFeedback(
            'Aktarım tamamlanamadı. Quizlab açık olmalı; site izinini ve Chrome oturumunu kontrol edin.',
            false
          )
        }
      }
    )
  })
}

async function render() {
  try {
    await initProfileControls()
    await initPairingControls()
    await initImportControls()
    await renderSites()
  } catch (error) {
    console.warn('[Quizlab Popup] The popup could not be rendered:', errorMessage(error))
    setStatus(TEXTS.failed)
  }
}

void render()
