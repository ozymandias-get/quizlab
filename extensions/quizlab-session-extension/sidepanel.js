/**
 * The side panel of the Quizlab Reader site session extension.
 *
 * The extension reads the cookies of the sites the app names. The sites the
 * app ships with are covered by the host permissions the extension was
 * installed with; a site the user added afterwards is not. Chrome only grants
 * a permission that is asked for during a user gesture, so the user opens this
 * panel and presses the button of the site that is missing one.
 *
 * The panel selects a destination and asks the worker to import. It never reads a cookie
 * and never asks the network for anything. It reads the site list the service
 * worker persisted and asks Chrome for the permissions that are missing.
 */

/** The key the service worker persists the last site list under. */
const TARGETS_KEY = 'knownTargets'

/** The id of the element the status line lives in. */
const STATUS_ID = 'status'

/** The id of the element the sites are rendered into. */
const LIST_ID = 'sites'

/** What the panel says to the user. */
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
 * The pattern the panel asks for.
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
 * The service worker asks for the same pattern, so the panel and the
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
        '[Quizlab Panel] The permission of',
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
 * to the local storage when the browser has no session storage. The panel
 * reads it from the same place, or it would not find the list at all.
 */
function storageArea() {
  try {
    return chrome.storage.session || chrome.storage.local || null
  } catch {
    return null
  }
}

/** Whether the app told the worker that the stored pairing code is not its own. */
async function readPairingRejected() {
  const area = storageArea()
  if (!area) return false
  try {
    const stored = await area.get(['pairingInvalid'])
    return stored?.pairingInvalid === true
  } catch {
    return false
  }
}

/**
 * The site list the service worker persisted, or null when there is none.
 *
 * The panel cannot ask the app itself: the app only answers a signed request
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
    console.warn('[Quizlab Panel] The site list could not be read:', errorMessage(error))
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
  console.warn('[Quizlab Panel] The permission could not be requested:', errorMessage(error))
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

/** Shows the name in the panel header and in the Chrome tab title. */
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
    if (button.disabled) return
    button.disabled = true
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'set_profile_name', name }, (response) => {
        resolve(chrome.runtime.lastError ? { success: false } : response)
      })
    })
      .then((response) => {
        button.disabled = false
        if (response && response.success) {
          storedName = name
          hasStoredName = true
          input.value = name
          applyProfileLabel(name)
          if (state) {
            state.textContent = 'Kaydedildi'
            state.dataset.saved = 'true'
          }
          showFeedback('Profil adı kaydedildi.', true)
        } else {
          // The worker persists before it renames itself, so the name it still
          // uses is the one that was stored. The header keeps saying it.
          applyProfileLabel(storedName)
          if (state) {
            state.textContent = hasStoredName ? 'Kaydedildi' : 'Kaydedilmedi'
            state.dataset.saved = hasStoredName ? 'true' : 'false'
          }
          showFeedback('Profil adı kaydedilemedi.', false)
        }
      })
      .catch((error) => {
        button.disabled = false
        applyProfileLabel(storedName)
        console.warn('[Quizlab Panel] The profile name could not be saved:', errorMessage(error))
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
 * The panel writes the code to the local store and asks the service worker to
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
  const rejected = await readPairingRejected()
  if (existing && !rejected && state) {
    state.textContent = 'Eşleştirildi'
    state.dataset.paired = 'true'
  }

  const showFeedback = (text, isSuccess) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = isSuccess ? 'success' : 'error'
  }

  if (rejected) {
    showFeedback(
      'Quizlab bu eklentinin eşleştirme kodunu kabul etmiyor. Uygulamadaki yeni kodu yapıştırın.',
      false
    )
  }

  button.addEventListener('click', () => {
    const code = typeof input.value === 'string' ? input.value.trim().toLowerCase() : ''
    if (!isPairingCode(code)) {
      showFeedback('Kod 64 karakterlik olmalı. Kodu uygulamadan kopyalayın.', false)
      return
    }
    if (button.disabled) return
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
          if (typeof document.dispatchEvent === 'function') {
            // The magic selector card asks the worker for its own state; a new
            // pairing is the moment its connection line changes.
            try {
              document.dispatchEvent(new CustomEvent('quizlab:paired'))
            } catch {
              // A context without CustomEvent keeps the card on its first read.
            }
          }
          if (response.settingsSaved === false) {
            // The code works for this worker but could not be written to the
            // store: after a browser restart the user has to pair again.
            showFeedback(
              'Eşleştirildi ancak kod kalıcı olarak kaydedilemedi. Tarayıcı yeniden başlarsa yeniden eşleştirin.',
              false
            )
          } else if (response.notSelected) {
            showFeedback(
              'Eşleştirildi. Bu Chrome profili Quizlab’da seçili değil; Ayarlar → Site Oturumları bölümünden bu profili seçin.',
              false
            )
          } else if (response.result === 'refused') {
            showFeedback(
              'Eşleştirildi, ancak oturumlar şu an aktarılamadı. Site oturumları ekranındaki durumu kontrol edin.',
              false
            )
          } else if (response.result === 'partial') {
            showFeedback(
              'Eşleştirildi. Bazı oturumlar aktarıldı; bazı sitelerde Chrome oturumu yok ya da izin eksik.',
              false
            )
          } else if (response.result === 'no_cookies') {
            showFeedback('Eşleştirildi. Chrome’da bu siteler için oturum bulunamadı.', true)
          } else if (response.result === 'permission_missing') {
            showFeedback('Eşleştirildi, ancak bazı siteler için izin eksik.', false)
          } else {
            showFeedback('Eşleştirildi. Oturumlar aktarıldı.', true)
          }
          void renderSites()
        } else if (response && response.error === 'invalid_code') {
          showFeedback(
            'Kod kabul edilmedi. Uygulamadaki güncel kodu kopyaladığınızdan emin olun.',
            false
          )
        } else if (response && response.error === 'bridge_unreachable') {
          showFeedback('Quizlab’a ulaşılamadı. Uygulamanın açık olduğunu kontrol edin.', false)
        } else {
          showFeedback('Eşleştirilemedi.', false)
        }
      })
      .catch((error) => {
        button.disabled = false
        console.warn('[Quizlab Panel] The pairing failed:', errorMessage(error))
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
  // The last preference the worker confirmed. The checkbox returns to it when
  // a write fails, so it never shows a setting that is not on disk.
  let savedAutoSync = stored?.autoSync !== false
  if (auto) auto.checked = savedAutoSync
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
  let autoSyncPending = false
  const applyAutoSync = (value) => {
    savedAutoSync = value
    if (auto) auto.checked = value
  }

  auto?.addEventListener('change', () => {
    // A second click while the first request is on its way would send another
    // write for a value the panel has not confirmed yet.
    if (!auto || autoSyncPending) return
    const next = auto.checked
    autoSyncPending = true
    auto.disabled = true
    const settle = () => {
      autoSyncPending = false
      auto.disabled = false
    }
    try {
      chrome.runtime.sendMessage({ type: 'set_auto_sync', enabled: next }, (response) => {
        const error = chrome.runtime.lastError
        settle()
        if (error || response?.settingsSaved !== true) {
          // The write did not land: the stored preference is still the truth.
          auto.checked = savedAutoSync
          showFeedback('Eşitleme ayarı kaydedilemedi.', false)
          return
        }
        applyAutoSync(next)
        if (!response.success) {
          // The choice is safe; only the transfer it triggered was incomplete.
          showFeedback('Eşitleme ayarı kaydedildi ancak aktarım tamamlanamadı.', false)
        }
      })
    } catch (error) {
      settle()
      auto.checked = savedAutoSync
      console.warn('[Quizlab Panel] The automatic sync setting failed:', errorMessage(error))
      showFeedback('Eşitleme ayarı kaydedilemedi.', false)
    }
  })
  syncBtn?.addEventListener('click', () => {
    if (syncBtn.disabled) return
    syncBtn.disabled = true
    showFeedback('Site oturumları aktarılıyor...', true)
    chrome.runtime.sendMessage(
      { type: 'sync_now', targetId: siteSelect?.value || undefined },
      (response) => {
        const error = chrome.runtime.lastError
        syncBtn.disabled = false
        // The worker reports the preference it really holds. A request that
        // never arrived leaves the checkbox alone.
        if (auto && !error && typeof response?.autoSync === 'boolean') {
          applyAutoSync(response.autoSync)
        }
        if (!error && response?.result === 'not_selected') {
          showFeedback(
            'Bu Chrome profili Quizlab’da seçili değil. Quizlab → Ayarlar → Site Oturumları bölümünden bu profili seçin, sonra burada yeniden Aktar’a basın.',
            false
          )
        } else if (!error && response?.result === 'no_cookies') {
          showFeedback(
            'Aktarım için Chrome’da oturum çerezi bulunamadı. Sitede oturum açık mı kontrol edin.',
            false
          )
        } else if (!error && response?.result === 'permission_missing') {
          showFeedback('Bu siteler için izin eksik. Yukarıdaki site listesinden izin verin.', false)
        } else if (!error && response?.result === 'partial') {
          showFeedback(
            'Bazı oturumlar aktarıldı; bazı sitelerde Chrome oturumu yok ya da izin eksik.',
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

/** The labels of the stored selector state of one field. */
const SELECTOR_STATUS_TEXTS = {
  ready: 'Hazır',
  migrated: 'Taşındı',
  repaired: 'Otomatik onarıldı',
  needs_repick: 'Yeniden seçim gerekli',
  missing: 'Ayarlanmadı'
}

/** The texts the magic selector section shows. */
const SELECTOR_TEXTS = {
  checking: 'Kontrol ediliyor',
  connected: 'Bağlı',
  unpaired: 'Eşleştirilmedi',
  unreachable: 'QuizLab kapalı',
  unsupported: 'QuizLab sürümü desteklemiyor',
  noSite: 'Bu sitede seçim yapılamaz',
  unknownSite: 'Quizlab bu siteyi tanımıyor.',
  ambiguousSite: 'Bu alan adı birden fazla siteyle eşleşiyor; Quizlab’da doğru siteyi açın.',
  unknownTab: 'Bu sekmede seçim yapılamaz.',
  unknownField: 'Bu site bu alanı desteklemiyor.',
  permissionMissing:
    'Bu siteye erişim izni yok. Yukarıdaki site listesinden izin verip yeniden deneyin.',
  permissionDeclined: 'İzin verilmedi. Siteyi QuizLab’da açıp seçimi tekrar deneyin.',
  cannotInject: 'Bu sayfaya erişilemedi. Sayfayı yenileyip tekrar deneyin.',
  started: 'Seçim modu açıldı. Sayfada elementi seçin; ESC ile iptal edebilirsiniz.',
  saved: 'Seçici Quizlab’a ulaştı ve kaydedildi.',
  siteNotOpen: 'Quizlab’da bu site açık değil. Siteyi Quizlab’da açıp seçimi tekrar gönderin.',
  verificationFailed: 'Quizlab seçiciyi doğrulayamadı. Eski seçici korunuyor.',
  rejected: 'Aktarım reddedildi. Site ve hedef alanı kontrol edin.',
  retry: 'Bağlantı kurulamadı. QuizLab açık mı kontrol edin.'
}

/** Resolves with the active tab id, or null when Chrome does not report one. */
function readActiveTabId() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve(null)
          return
        }
        const tab = Array.isArray(tabs) ? tabs[0] : null
        resolve(tab && Number.isInteger(tab.id) ? tab.id : null)
      })
    } catch {
      resolve(null)
    }
  })
}

/** Sends one message to the service worker and awaits its answer. */
function sendWorkerMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(chrome.runtime.lastError ? null : response)
      })
    } catch {
      resolve(null)
    }
  })
}

/**
 * Wires the magic selector card.
 *
 * The card only shows state; the pick itself happens on the page. Starting a
 * pick keeps the panel open, because the in-page panel carries the selection
 * and the side panel keeps the result visible.
 */
async function initSelectorControls() {
  const button = document.getElementById('selector-btn')
  if (!button || button.dataset.initialized) return
  button.dataset.initialized = 'true'

  // A browser without the tabs API (an old harness, a restricted context) has
  // no active tab to pick on. The section stays inert instead of throwing.
  if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
    button.disabled = true
    return
  }

  const fieldSelect = document.getElementById('selector-field')
  const connection = document.getElementById('selector-connection')
  const siteLabel = document.getElementById('selector-site')
  const inputStatus = document.getElementById('selector-input-status')
  const buttonStatus = document.getElementById('selector-button-status')
  const feedback = document.getElementById('selector-feedback')
  const preview = document.getElementById('selector-preview')

  let tabId = null
  let currentHost = null
  let currentPermission = true
  /** Bumped on every refresh; a slow answer for an older tab is ignored. */
  let refreshRevision = 0

  const showFeedback = (text, isSuccess) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = isSuccess ? 'success' : 'error'
  }

  const clearFeedback = () => {
    if (!feedback) return
    feedback.textContent = ''
    delete feedback.dataset.state
  }

  const clearPreview = () => {
    if (!preview) return
    preview.textContent = ''
    delete preview.dataset.state
  }

  const setConnection = (text, tone) => {
    if (!connection) return
    connection.textContent = text
    connection.dataset.selector = tone
  }

  const renderStatus = (element, status) => {
    if (!element) return
    element.textContent = status
      ? SELECTOR_STATUS_TEXTS[status] || SELECTOR_STATUS_TEXTS.missing
      : '-'
  }

  const renderOutcome = (lastOutcome, hostname) => {
    if (!lastOutcome || typeof lastOutcome !== 'object') return
    // A result belongs to the pick it was produced for. Showing another tab's
    // outcome as this site's result is exactly the confusion this guard
    // prevents; the panel keeps the outcome of the current host only.
    if (lastOutcome.hostname && hostname && lastOutcome.hostname !== hostname) return
    if (preview && typeof lastOutcome.selector === 'string') {
      const fieldText = lastOutcome.field === 'button' ? 'gönder butonu' : 'mesaj alanı'
      preview.textContent = `${lastOutcome.hostname} · ${fieldText}: ${lastOutcome.selector}`
      preview.dataset.state = 'shown'
    }
    if (lastOutcome.state === 'saved') showFeedback(SELECTOR_TEXTS.saved, true)
    else if (lastOutcome.state === 'site_not_open') showFeedback(SELECTOR_TEXTS.siteNotOpen, false)
    else if (lastOutcome.state === 'verification_failed') {
      const reason =
        typeof lastOutcome.reason === 'string' && lastOutcome.reason
          ? ` (${lastOutcome.reason})`
          : ''
      showFeedback(SELECTOR_TEXTS.verificationFailed + reason, false)
    } else if (lastOutcome.state === 'unpaired') showFeedback(SELECTOR_TEXTS.unpaired, false)
    else showFeedback(SELECTOR_TEXTS.retry, false)
  }

  const applyFields = (fields) => {
    if (!fieldSelect) return
    const allowed = Array.isArray(fields) && fields.length > 0 ? fields : []
    for (const option of fieldSelect.options) {
      option.disabled = allowed.length > 0 && !allowed.includes(option.value)
    }
    if (allowed.length > 0 && !allowed.includes(fieldSelect.value)) {
      fieldSelect.value = allowed[0]
    }
  }

  /** The start button says which element it is waiting for. */
  const applyStartLabel = () => {
    if (!button) return
    const field = fieldSelect ? fieldSelect.value : 'input'
    button.textContent = field === 'button' ? 'Gönder Butonunu Seç' : 'Mesaj Alanını Seç'
  }

  const refresh = async () => {
    const revision = (refreshRevision += 1)
    setConnection(SELECTOR_TEXTS.checking, 'idle')
    const nextTabId = await readActiveTabId()
    if (revision !== refreshRevision) return
    tabId = nextTabId
    const response =
      tabId === null ? null : await sendWorkerMessage({ type: 'selector_state', tabId })
    if (revision !== refreshRevision) return
    if (!response || response.success !== true) {
      setConnection(SELECTOR_TEXTS.unreachable, 'error')
      if (siteLabel) siteLabel.textContent = SELECTOR_TEXTS.noSite
      renderStatus(inputStatus, null)
      renderStatus(buttonStatus, null)
      button.disabled = true
      return
    }

    const nextHost = typeof response.host === 'string' ? response.host : null
    if (currentHost !== nextHost) {
      // The result and the preview describe the previous site; keeping them
      // would read as "this tab already has a saved selector".
      clearFeedback()
      clearPreview()
    }
    currentHost = nextHost
    currentPermission = response.permission !== false

    const connectionState = response.connection
    if (connectionState === 'ok') setConnection(SELECTOR_TEXTS.connected, 'ok')
    else if (connectionState === 'unpaired') setConnection(SELECTOR_TEXTS.unpaired, 'error')
    else if (connectionState === 'unsupported') {
      setConnection(SELECTOR_TEXTS.unsupported, 'error')
    } else setConnection(SELECTOR_TEXTS.unreachable, 'error')

    const site = response.site
    if (siteLabel) {
      siteLabel.textContent = response.ambiguous
        ? SELECTOR_TEXTS.ambiguousSite
        : site
          ? site.displayName
          : SELECTOR_TEXTS.noSite
    }
    renderStatus(inputStatus, site?.status?.input)
    renderStatus(buttonStatus, site?.status?.button)
    applyFields(site?.fields)
    applyStartLabel()

    const supported = response.supported !== 'none'
    button.disabled = connectionState !== 'ok' || !site || !supported
    if (connectionState === 'unsupported' || !supported) {
      showFeedback(SELECTOR_TEXTS.unsupported, false)
    }

    renderOutcome(response.lastOutcome, nextHost)
  }

  if (fieldSelect) {
    fieldSelect.addEventListener('change', applyStartLabel)
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return
    const field = fieldSelect ? fieldSelect.value : 'input'
    // The tab may have changed since the last refresh. Read it again and let
    // the worker refuse a stale id instead of injecting into another tab.
    const activeId = await readActiveTabId()
    if (activeId === null) {
      showFeedback(SELECTOR_TEXTS.unknownTab, false)
      return
    }
    tabId = activeId

    // A custom site is not covered by the manifest's host permissions. The
    // request has to be made from this click's user gesture; a granted
    // permission is not required for `activeTab`, but asking here is what makes
    // the second pick after the temporary grant works too.
    if (currentPermission === false && currentHost) {
      try {
        const granted = await chrome.permissions.request({
          origins: [`https://${currentHost}/*`, `https://*.${currentHost}/*`]
        })
        if (!granted) {
          showFeedback(SELECTOR_TEXTS.permissionDeclined, false)
        } else {
          currentPermission = true
        }
      } catch (error) {
        console.warn(
          '[Quizlab Panel] The picker permission could not be requested:',
          errorMessage(error)
        )
      }
    }

    button.disabled = true
    clearFeedback()
    const response = await sendWorkerMessage({ type: 'selector_start', tabId, field })
    button.disabled = false
    if (response && response.success === true) {
      // The side panel stays open: the page shows the picker and the panel
      // shows the result the worker broadcasts when the pick is done.
      showFeedback(SELECTOR_TEXTS.started, true)
      return
    }
    const error = response && typeof response.error === 'string' ? response.error : ''
    if (error === 'unsupported_site') showFeedback(SELECTOR_TEXTS.unknownSite, false)
    else if (error === 'ambiguous_site') showFeedback(SELECTOR_TEXTS.ambiguousSite, false)
    else if (error === 'unsupported_tab') showFeedback(SELECTOR_TEXTS.unknownTab, false)
    else if (error === 'unsupported_field') showFeedback(SELECTOR_TEXTS.unknownField, false)
    else if (error === 'unpaired') showFeedback(SELECTOR_TEXTS.unpaired, false)
    else if (error === 'unsupported') showFeedback(SELECTOR_TEXTS.unsupported, false)
    else if (error === 'permission_missing') showFeedback(SELECTOR_TEXTS.permissionMissing, false)
    else {
      const detail = response && typeof response.detail === 'string' ? ` (${response.detail})` : ''
      showFeedback(SELECTOR_TEXTS.cannotInject + detail, false)
    }
  })

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('quizlab:paired', () => {
      void refresh()
    })
  }

  // A popup was rebuilt every time it opened, so it never saw a tab change.
  // The panel stays open while the user moves between tabs, so the site of the
  // active tab and the result of a pick have to follow the browser.
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      void refresh()
    })
  }
  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((changedTabId, changeInfo) => {
      if (changeInfo.status !== 'complete' && !changeInfo.url) return
      if (tabId !== null && changedTabId !== tabId) return
      void refresh()
    })
  }
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'selector_outcome') void refresh()
    })
  }

  await refresh()
}

async function render() {
  try {
    await initProfileControls()
    await initPairingControls()
    await initImportControls()
    await initSelectorControls()
    await renderSites()
  } catch (error) {
    console.warn('[Quizlab Panel] The panel could not be rendered:', errorMessage(error))
    setStatus(TEXTS.failed)
  }
}

void render()
