/**
 * The side panel of the Quizlab Reader site session extension.
 *
 * The extension reads the cookies of the sites the app names and drives the
 * on-demand Magic Selector on supported AI tabs.
 */

/** The key the service worker persists the last site list under. */
const TARGETS_KEY = 'knownTargets'

/** The id of the element the site-permission status line lives in. */
const STATUS_ID = 'status'

/** The id of the element the sites are rendered into. */
const LIST_ID = 'sites'

/** What the sessions panel says to the user. */
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

function wildcardPattern(host) {
  return `https://*.${host}/*`
}

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

/** Whether the extension may read a host. */
async function hasPermission(host) {
  if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') {
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

function storageArea() {
  try {
    return chrome.storage.session || chrome.storage.local || null
  } catch {
    return null
  }
}

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

function updateSessionsBadge(missingCount) {
  const badge = document.getElementById('sessions-badge')
  if (!badge) return
  if (missingCount > 0) {
    badge.textContent = String(missingCount)
    badge.hidden = false
  } else {
    badge.textContent = '0'
    badge.hidden = true
  }
}

function titleOf(site) {
  if (typeof site.label === 'string' && site.label.trim()) return site.label
  if (site.siteId.startsWith('custom:')) return site.hosts[0]
  return site.siteId
}

function renderRow(site) {
  const row = document.createElement('li')
  row.className = 'site'

  const name = document.createElement('span')
  name.className = 'site-name'
  name.textContent = titleOf(site)

  const domains = document.createElement('span')
  domains.className = 'site-domains'
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

async function onGranted(granted) {
  if (!granted) {
    setStatus(TEXTS.declined)
    return
  }
  await render()
}

function onFailed(error) {
  console.warn('[Quizlab Panel] The permission could not be requested:', errorMessage(error))
  setStatus(TEXTS.failed)
}

async function renderSites() {
  const targets = await readTargets()
  if (targets === null) {
    clearList()
    updateSessionsBadge(0)
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
  updateSessionsBadge(missingCount)
  if (sites.length === 0) setStatus(TEXTS.noSite)
  else if (missingCount === 0) setStatus(TEXTS.allGranted)
  else setStatus(TEXTS.someMissing)
}

function isPairingCode(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim())
}

async function readPairingCode() {
  try {
    const stored = await chrome.storage.local.get(['bridgeSecret'])
    const code = stored ? stored.bridgeSecret : null
    return isPairingCode(code) ? code.trim().toLowerCase() : null
  } catch {
    return null
  }
}

const DEFAULT_PROFILE_NAME = 'Chrome'
const MAX_PROFILE_NAME_LENGTH = 60

function normalizeProfileName(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replaceAll(/\s+/g, ' ').slice(0, MAX_PROFILE_NAME_LENGTH)
}

function applyProfileLabel(name) {
  const label = document.getElementById('profile-label')
  if (label) label.textContent = `Bu Chrome profili: ${name}`
  document.title = `QuizLab — ${name}`
}

function setSettingsDrawerOpen(open) {
  const drawer = document.getElementById('settings-drawer')
  const toggle = document.getElementById('settings-toggle')
  if (!drawer || !toggle) return
  drawer.hidden = !open
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function initNavigation() {
  const tabSelector = document.getElementById('tab-selector')
  const tabSessions = document.getElementById('tab-sessions')
  const panelSelector = document.getElementById('panel-selector')
  const panelSessions = document.getElementById('panel-sessions')
  const toggle = document.getElementById('settings-toggle')
  const drawer = document.getElementById('settings-drawer')

  if (toggle && drawer && !toggle.dataset.initialized) {
    toggle.dataset.initialized = 'true'
    toggle.addEventListener('click', () => {
      setSettingsDrawerOpen(drawer.hidden)
    })
  }

  if (!tabSelector || !tabSessions || !panelSelector || !panelSessions) return
  if (tabSelector.dataset.initialized) return
  tabSelector.dataset.initialized = 'true'

  const activate = (which) => {
    const isSelector = which === 'selector'
    tabSelector.setAttribute('aria-selected', isSelector ? 'true' : 'false')
    tabSessions.setAttribute('aria-selected', isSelector ? 'false' : 'true')
    tabSelector.tabIndex = isSelector ? 0 : -1
    tabSessions.tabIndex = isSelector ? -1 : 0
    panelSelector.hidden = !isSelector
    panelSessions.hidden = isSelector
  }

  tabSelector.addEventListener('click', () => activate('selector'))
  tabSessions.addEventListener('click', () => activate('sessions'))

  const handleKey = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const next = event.currentTarget === tabSelector ? 'sessions' : 'selector'
      activate(next)
      ;(next === 'selector' ? tabSelector : tabSessions).focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      activate('selector')
      tabSelector.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      activate('sessions')
      tabSessions.focus()
    }
  }
  tabSelector.addEventListener('keydown', handleKey)
  tabSessions.addEventListener('keydown', handleKey)
}

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
    // Default name still works.
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

async function initPairingControls() {
  const input = document.getElementById('pairing-code-input')
  const button = document.getElementById('pair-btn')
  const state = document.getElementById('pair-state')
  const feedback = document.getElementById('pair-feedback')
  const settingsToggle = document.getElementById('settings-toggle')
  if (!input || !button || button.dataset.initialized) return
  button.dataset.initialized = 'true'

  const existing = await readPairingCode()
  const rejected = await readPairingRejected()
  const needsPairing = !existing || rejected

  if (existing && !rejected && state) {
    state.textContent = 'Eşleştirildi'
    state.dataset.paired = 'true'
  }
  if (settingsToggle) {
    settingsToggle.dataset.attention = needsPairing ? 'true' : 'false'
  }
  if (needsPairing) {
    setSettingsDrawerOpen(true)
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
          if (settingsToggle) {
            settingsToggle.dataset.attention = 'false'
          }
          if (typeof document.dispatchEvent === 'function') {
            try {
              document.dispatchEvent(new CustomEvent('quizlab:paired'))
            } catch {
              // Ignore in restricted contexts.
            }
          }
          if (response.settingsSaved === false) {
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
            setSettingsDrawerOpen(false)
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
          auto.checked = savedAutoSync
          showFeedback('Eşitleme ayarı kaydedilemedi.', false)
          return
        }
        applyAutoSync(next)
        if (!response.success) {
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
          showFeedback('Bu siteler için izin eksik. Aşağıdaki site listesinden izin verin.', false)
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
  missing: 'Ayarlanmadı',
  unknown: 'Durum bilinmiyor'
}

/** Statuses that count as having a registered selector (separate from verified health). */
const REGISTERED_STATUSES = new Set(['ready', 'migrated', 'repaired'])

const SELECTOR_TEXTS = {
  checking: 'Kontrol ediliyor',
  connected: 'Bağlı',
  unpaired: 'Eşleştirilmedi',
  unreachable: 'QuizLab kapalı',
  unsupported: 'Desteklenmiyor',
  emptyUnsupportedSite: 'Bu sekme Sihirli Seçici ile uyumlu değil. Desteklenen bir AI sitesini aç.',
  emptyUnreachable: 'QuizLab uygulamasını aç ve tekrar dene.',
  emptyUnpaired: 'Selektör göndermek için QuizLab ile eşleştir.',
  emptyPermission: 'Bu sitede seçim yapabilmek için tarayıcı izni gerekiyor.',
  emptyAmbiguous: 'Bu site birden fazla QuizLab hedefiyle eşleşiyor.',
  emptyUnsupportedVersion: 'QuizLab sürümü Sihirli Seçici’yi desteklemiyor.',
  unknownTab: 'Bu sekmede seçim yapılamaz.',
  unknownField: 'Bu site bu alanı desteklemiyor.',
  permissionDeclined: 'İzin verilmedi. Seçim başlatılamadı.',
  cannotInject: 'Bu sayfaya erişilemedi. Sayfayı yenileyip tekrar deneyin.',
  startedInput: 'Seçim modu açıldı: Mesaj giriş alanı. Sayfada elementi seçin; ESC ile iptal edin.',
  startedButton: 'Seçim modu açıldı: Gönderme butonu. Sayfada elementi seçin; ESC ile iptal edin.',
  startedPair:
    'Tam kurulum açıldı: Önce mesaj giriş alanını seçin, deneme metni yazın, sonra gönderme butonunu seçin.',
  savedInput: 'Mesaj giriş alanı kaydedildi.',
  savedButton: 'Gönderme butonu kaydedildi.',
  savedPair: 'Mesaj giriş alanı ve gönderme butonu doğrulandı ve kaydedildi.',
  siteNotOpen: 'Bu siteyi QuizLab’da aç ve tekrar dene.',
  verificationFailed: 'Bu element QuizLab’da doğrulanamadı. Önceki selektör korunuyor.',
  verificationEmptyComposer:
    'QuizLab’daki mesaj alanı boş olduğu için gönderme butonu henüz DOM’da görünmüyor. QuizLab’daki mesaj kutusuna deneme metni yazıp (göndermeden) tekrar deneyin.',
  verificationNotFound:
    'Seçilen element QuizLab’daki sayfada bulunamadı. Önceki selektör korunuyor.',
  verificationMismatch:
    'Chrome’daki seçim QuizLab’daki elementle uyuşmuyor (farklı buton/mikrofon/ekleme kontrolü olabilir). Önceki selektör korunuyor.',
  verificationInsufficient:
    'Elementin kimliği QuizLab’da yeterince doğrulanamadı. Daha belirgin bir alan seçin.',
  verificationAmbiguous: 'QuizLab’da birden fazla benzer element eşleşti; seçim ayırt edilemedi.',
  verificationNavigated: 'Doğrulama sırasında QuizLab sayfası değişti. Tekrar deneyin.',
  verificationCleanupFailed:
    'Doğrulama güvenli biçimde tamamlanamadı. QuizLab’daki mesaj alanını kontrol edip yeniden deneyin. Önceki selektörleriniz korundu.',
  verificationSiteMismatch: 'QuizLab’da açık sayfa bu siteyle eşleşmiyor.',
  rejected: 'Aktarım reddedildi. Site ve hedef alanı kontrol edin.',
  retry: 'QuizLab bağlantısı kurulamadı.'
}

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

function statusToneOf(status) {
  if (status === 'ready' || status === 'migrated') return 'ready'
  if (status === 'repaired' || status === 'needs_repick') return 'warn'
  return 'idle'
}

async function initSelectorControls() {
  const pickPairBtn = document.getElementById('pick-pair-btn')
  const guidedCard = document.getElementById('selector-guided-card')
  const pickInputBtn = document.getElementById('pick-input-btn')
  const pickButtonBtn = document.getElementById('pick-button-btn')
  if (!pickInputBtn || !pickButtonBtn || pickInputBtn.dataset.initialized) return
  pickInputBtn.dataset.initialized = 'true'

  const connectionPill = document.getElementById('connection-pill')
  const siteContext = document.getElementById('selector-site-context')
  const siteLabel = document.getElementById('selector-site')
  const hostLabel = document.getElementById('selector-host')
  const progressPill = document.getElementById('selector-progress')
  const activeBanner = document.getElementById('selector-active-banner')
  const activeText = document.getElementById('selector-active-text')
  const emptyState = document.getElementById('selector-empty-state')
  const emptyTitle = document.getElementById('selector-empty-title')
  const emptyDesc = document.getElementById('selector-empty-desc')
  const emptyAction = document.getElementById('selector-empty-action')
  const targetsWrap = document.getElementById('selector-targets')
  const inputStatus = document.getElementById('selector-input-status')
  const buttonStatus = document.getElementById('selector-button-status')
  const feedback = document.getElementById('selector-feedback')
  const nextStepCard = document.getElementById('selector-next-step')
  const nextStepText = document.getElementById('selector-next-text')
  const nextStepBtn = document.getElementById('selector-next-btn')
  const techDetails = document.getElementById('selector-tech-details')
  const preview = document.getElementById('selector-preview')

  const setConnection = (text, tone) => {
    if (!connectionPill) return
    connectionPill.textContent = text
    connectionPill.dataset.tone = tone
  }

  let emptyActionHandler = null
  const showEmptyState = (title, desc, actionLabel, onAction) => {
    if (!emptyState || !emptyTitle || !emptyDesc || !emptyAction) return
    emptyTitle.textContent = title
    emptyDesc.textContent = desc
    emptyActionHandler = typeof onAction === 'function' ? onAction : null
    if (actionLabel && emptyActionHandler) {
      emptyAction.textContent = actionLabel
      emptyAction.hidden = false
    } else {
      emptyAction.hidden = true
    }
    emptyState.hidden = false
  }

  if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
    pickInputBtn.disabled = true
    pickButtonBtn.disabled = true
    setConnection(SELECTOR_TEXTS.unreachable, 'error')
    showEmptyState('QuizLab kapalı', SELECTOR_TEXTS.emptyUnreachable, null, null)
    return
  }

  let tabId = null
  let currentHost = null
  let currentPermission = true
  let currentSite = null
  let currentConnection = 'idle'
  let pickStartInFlight = false
  let refreshRevision = 0

  const showFeedback = (text, tone) => {
    if (!feedback) return
    feedback.textContent = text
    feedback.dataset.state = tone
  }

  const clearFeedback = () => {
    if (!feedback) return
    feedback.textContent = ''
    delete feedback.dataset.state
  }

  const setTechPreview = (text) => {
    if (!techDetails || !preview) return
    if (text) {
      preview.textContent = text
      techDetails.hidden = false
    } else {
      preview.textContent = ''
      techDetails.hidden = true
      techDetails.open = false
    }
  }

  const hideNextStep = () => {
    if (nextStepCard) nextStepCard.hidden = true
  }

  const hideEmptyState = () => {
    if (emptyState) emptyState.hidden = true
    emptyActionHandler = null
  }

  emptyAction?.addEventListener('click', () => {
    if (emptyActionHandler) void emptyActionHandler()
  })

  const renderFieldBadge = (element, status, supported) => {
    if (!element) return
    if (!supported) {
      element.textContent = 'Desteklenmiyor'
      element.dataset.tone = 'idle'
      return
    }
    element.textContent = status
      ? SELECTOR_STATUS_TEXTS[status] || SELECTOR_STATUS_TEXTS.missing
      : SELECTOR_STATUS_TEXTS.missing
    element.dataset.tone = statusToneOf(status)
  }

  const updateTargetCards = (site, connectionOk) => {
    const fields = Array.isArray(site?.fields) ? site.fields : []
    const inputSupported = fields.includes('input')
    const buttonSupported = fields.includes('button')
    const inputState = site?.status?.input || 'missing'
    const buttonState = site?.status?.button || 'missing'

    renderFieldBadge(inputStatus, inputState, inputSupported)
    renderFieldBadge(buttonStatus, buttonState, buttonSupported)

    const inputCard = pickInputBtn.closest('.target-card')
    const buttonCard = pickButtonBtn.closest('.target-card')
    if (inputCard) inputCard.dataset.disabled = inputSupported ? 'false' : 'true'
    if (buttonCard) buttonCard.dataset.disabled = buttonSupported ? 'false' : 'true'

    pickInputBtn.textContent = REGISTERED_STATUSES.has(inputState)
      ? 'Alanı Yeniden Seç'
      : 'Alanı Seç'
    pickButtonBtn.textContent = REGISTERED_STATUSES.has(buttonState)
      ? 'Butonu Yeniden Seç'
      : 'Butonu Seç'

    pickInputBtn.disabled = !connectionOk || !inputSupported || pickStartInFlight
    pickButtonBtn.disabled = !connectionOk || !buttonSupported || pickStartInFlight

    const pairSupported = inputSupported && buttonSupported
    if (guidedCard) guidedCard.hidden = !pairSupported
    if (pickPairBtn) {
      pickPairBtn.textContent =
        REGISTERED_STATUSES.has(inputState) && REGISTERED_STATUSES.has(buttonState)
          ? 'Tam Kurulumu Yeniden Yap'
          : 'Tam Kurulumu Başlat'
      pickPairBtn.disabled = !connectionOk || !pairSupported || pickStartInFlight
    }

    if (progressPill) {
      const total = fields.length || 0
      const registered = fields.filter((f) => REGISTERED_STATUSES.has(site?.status?.[f])).length
      progressPill.textContent = `${registered}/${total} alan kayıtlı`
      progressPill.dataset.complete = total > 0 && registered === total ? 'true' : 'false'
    }
  }

  const renderActiveSession = (activeSession) => {
    if (!activeBanner || !activeText) return
    if (activeSession && activeSession.sessionId) {
      const label =
        activeSession.field === 'pair'
          ? 'Tam kurulum (Giriş + Deneme yazımı + Gönder)'
          : activeSession.field === 'button'
            ? 'Gönderme butonu'
            : 'Mesaj giriş alanı'
      activeText.textContent = `Seçim modu aktif: ${label}. Sayfada adımları izleyin veya ESC ile iptal edin.`
      activeBanner.hidden = false
    } else {
      activeBanner.hidden = true
    }
  }

  const formatVerificationFailure = (lastOutcome) => {
    const failedField =
      lastOutcome.failedField === 'input'
        ? '[Mesaj giriş alanı] '
        : lastOutcome.failedField === 'button'
          ? '[Gönderme butonu] '
          : ''
    const reason = typeof lastOutcome.reason === 'string' ? lastOutcome.reason : ''
    if (reason === 'button_not_rendered_empty_composer') {
      return `${failedField}${SELECTOR_TEXTS.verificationEmptyComposer}`
    }
    if (reason === 'not_found') return `${failedField}${SELECTOR_TEXTS.verificationNotFound}`
    if (reason === 'identity_mismatch')
      return `${failedField}${SELECTOR_TEXTS.verificationMismatch}`
    if (reason === 'identity_insufficient') {
      return `${failedField}${SELECTOR_TEXTS.verificationInsufficient}`
    }
    if (reason === 'ambiguous') return `${failedField}${SELECTOR_TEXTS.verificationAmbiguous}`
    if (reason === 'view_navigated') return SELECTOR_TEXTS.verificationNavigated
    if (reason === 'probe_cleanup_failed')
      return `${failedField}${SELECTOR_TEXTS.verificationCleanupFailed}`
    if (reason === 'view_site_mismatch') return SELECTOR_TEXTS.verificationSiteMismatch
    return `${failedField}${SELECTOR_TEXTS.verificationFailed}`
  }

  const renderOutcome = (lastOutcome, hostname, site) => {
    hideNextStep()
    if (!lastOutcome || typeof lastOutcome !== 'object') return
    if (!hostname || !lastOutcome.hostname || lastOutcome.hostname !== hostname) return
    if (lastOutcome.state === 'cancelled') return

    const techParts = []
    if (typeof lastOutcome.selector === 'string' && lastOutcome.selector) {
      const fieldText =
        lastOutcome.field === 'pair'
          ? 'Tam kurulum'
          : lastOutcome.field === 'button'
            ? 'Gönderme butonu'
            : 'Mesaj giriş alanı'
      techParts.push(`${lastOutcome.hostname} · ${fieldText}: ${lastOutcome.selector}`)
    }
    if (typeof lastOutcome.reason === 'string' && lastOutcome.reason) {
      techParts.push(`Neden: ${lastOutcome.reason}`)
    }
    if (techParts.length > 0) setTechPreview(techParts.join('\n'))

    if (lastOutcome.state === 'saved') {
      const savedText =
        lastOutcome.field === 'pair'
          ? SELECTOR_TEXTS.savedPair
          : lastOutcome.field === 'button'
            ? SELECTOR_TEXTS.savedButton
            : SELECTOR_TEXTS.savedInput
      showFeedback(savedText, 'success')

      // Guide to the remaining unconfigured field if applicable (never auto-starts).
      if (lastOutcome.field === 'input' || lastOutcome.field === 'button') {
        const otherField = lastOutcome.field === 'button' ? 'input' : 'button'
        const fields = Array.isArray(site?.fields) ? site.fields : []
        const otherStatus = site?.status?.[otherField]
        if (
          fields.includes(otherField) &&
          (!otherStatus || otherStatus === 'missing' || otherStatus === 'needs_repick') &&
          nextStepCard &&
          nextStepText &&
          nextStepBtn
        ) {
          nextStepText.textContent =
            otherField === 'button'
              ? 'Mesaj giriş alanı kaydedildi. Şimdi gönderme butonunu seç.'
              : 'Gönderme butonu kaydedildi. Şimdi mesaj giriş alanını seç.'
          nextStepBtn.textContent =
            otherField === 'button' ? 'Gönderme butonunu seç' : 'Mesaj giriş alanını seç'
          nextStepBtn.dataset.field = otherField
          nextStepCard.hidden = false
        }
      }
    } else if (lastOutcome.state === 'site_not_open') {
      showFeedback(SELECTOR_TEXTS.siteNotOpen, 'error')
    } else if (lastOutcome.state === 'verification_failed') {
      showFeedback(formatVerificationFailure(lastOutcome), 'error')
    } else if (lastOutcome.state === 'unpaired') {
      showFeedback(SELECTOR_TEXTS.unpaired, 'error')
    } else {
      showFeedback(SELECTOR_TEXTS.retry, 'error')
    }
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
      currentConnection = 'unreachable'
      currentSite = null
      currentHost = null
      setConnection(SELECTOR_TEXTS.unreachable, 'error')
      if (siteContext) siteContext.hidden = true
      if (targetsWrap) targetsWrap.hidden = true
      renderActiveSession(null)
      hideNextStep()
      clearFeedback()
      setTechPreview('')
      showEmptyState('QuizLab kapalı', SELECTOR_TEXTS.emptyUnreachable, 'Yeniden Dene', () =>
        refresh()
      )
      return
    }

    const nextHost = typeof response.host === 'string' ? response.host : null
    if (currentHost !== nextHost) {
      clearFeedback()
      setTechPreview('')
      hideNextStep()
    }
    currentHost = nextHost
    currentPermission = response.permission !== false
    currentSite = response.site || null
    currentConnection = response.connection || 'unreachable'

    if (currentConnection === 'ok') setConnection(SELECTOR_TEXTS.connected, 'ok')
    else if (currentConnection === 'unpaired') setConnection(SELECTOR_TEXTS.unpaired, 'warn')
    else if (currentConnection === 'unsupported') setConnection(SELECTOR_TEXTS.unsupported, 'error')
    else setConnection(SELECTOR_TEXTS.unreachable, 'error')

    renderActiveSession(response.activeSession)

    const supported = response.supported !== 'none'
    const site = response.site

    if (site && !response.ambiguous && siteContext && siteLabel && hostLabel) {
      siteLabel.textContent = site.displayName
      hostLabel.textContent = nextHost || site.hostname || ''
      siteContext.hidden = false
    } else if (siteContext) {
      siteContext.hidden = true
    }

    // Determine empty/error states vs ready target cards
    if (currentConnection === 'unpaired') {
      if (targetsWrap) targetsWrap.hidden = true
      showEmptyState('Eşleştirme gerekli', SELECTOR_TEXTS.emptyUnpaired, 'Eşleştirmeyi Aç', () => {
        setSettingsDrawerOpen(true)
        document.getElementById('pairing-code-input')?.focus()
      })
      return
    }

    if (currentConnection === 'unsupported' || !supported) {
      if (targetsWrap) targetsWrap.hidden = true
      showEmptyState('Sürüm desteklenmiyor', SELECTOR_TEXTS.emptyUnsupportedVersion, null, null)
      return
    }

    if (currentConnection !== 'ok') {
      if (targetsWrap) targetsWrap.hidden = true
      showEmptyState('QuizLab kapalı', SELECTOR_TEXTS.emptyUnreachable, 'Yeniden Dene', () =>
        refresh()
      )
      return
    }

    if (response.ambiguous) {
      if (targetsWrap) targetsWrap.hidden = true
      showEmptyState('Belirsiz site', SELECTOR_TEXTS.emptyAmbiguous, null, null)
      return
    }

    if (!site) {
      if (targetsWrap) targetsWrap.hidden = true
      showEmptyState('Desteklenmeyen site', SELECTOR_TEXTS.emptyUnsupportedSite, null, null)
      return
    }

    if (currentPermission === false && currentHost) {
      if (targetsWrap) targetsWrap.hidden = true
      const hostSnapshot = currentHost
      showEmptyState('İzin gerekli', SELECTOR_TEXTS.emptyPermission, 'Site İzni Ver', async () => {
        try {
          const granted = await chrome.permissions.request({
            origins: [`https://${hostSnapshot}/*`, `https://*.${hostSnapshot}/*`]
          })
          if (!granted) {
            showFeedback(SELECTOR_TEXTS.permissionDeclined, 'error')
            return
          }
          await refresh()
        } catch (error) {
          console.warn('[Quizlab Panel] Permission request failed:', errorMessage(error))
          showFeedback(SELECTOR_TEXTS.permissionDeclined, 'error')
        }
      })
      return
    }

    hideEmptyState()
    if (targetsWrap) targetsWrap.hidden = false
    updateTargetCards(site, true)
    renderOutcome(response.lastOutcome, nextHost, site)
  }

  const startPick = async (field) => {
    if (pickStartInFlight) return
    if (field !== 'input' && field !== 'button' && field !== 'pair') return

    pickStartInFlight = true
    updateTargetCards(currentSite, currentConnection === 'ok')

    try {
      const activeId = await readActiveTabId()
      if (activeId === null) {
        showFeedback(SELECTOR_TEXTS.unknownTab, 'error')
        return
      }

      // If the active tab changed since the last refresh, refresh first so we
      // never request permissions or start a pick against stale host state.
      if (activeId !== tabId) {
        await refresh()
        if (tabId !== activeId || currentConnection !== 'ok' || !currentSite) {
          return
        }
      }

      if (currentPermission === false && currentHost) {
        try {
          const granted = await chrome.permissions.request({
            origins: [`https://${currentHost}/*`, `https://*.${currentHost}/*`]
          })
          if (!granted) {
            showFeedback(SELECTOR_TEXTS.permissionDeclined, 'error')
            return
          }
          currentPermission = true
        } catch (error) {
          console.warn(
            '[Quizlab Panel] The picker permission could not be requested:',
            errorMessage(error)
          )
        }
      }

      clearFeedback()
      hideNextStep()
      const response = await sendWorkerMessage({ type: 'selector_start', tabId: activeId, field })
      if (response && response.success === true) {
        showFeedback(
          field === 'pair'
            ? SELECTOR_TEXTS.startedPair
            : field === 'button'
              ? SELECTOR_TEXTS.startedButton
              : SELECTOR_TEXTS.startedInput,
          'info'
        )
        renderActiveSession({ sessionId: response.sessionId, field })
        return
      }

      const error = response && typeof response.error === 'string' ? response.error : ''
      if (error === 'unsupported_site') showFeedback(SELECTOR_TEXTS.emptyUnsupportedSite, 'error')
      else if (error === 'ambiguous_site') showFeedback(SELECTOR_TEXTS.emptyAmbiguous, 'error')
      else if (error === 'unsupported_tab') showFeedback(SELECTOR_TEXTS.unknownTab, 'error')
      else if (error === 'unsupported_field') showFeedback(SELECTOR_TEXTS.unknownField, 'error')
      else if (error === 'unpaired') showFeedback(SELECTOR_TEXTS.emptyUnpaired, 'error')
      else if (error === 'unsupported')
        showFeedback(SELECTOR_TEXTS.emptyUnsupportedVersion, 'error')
      else if (error === 'permission_missing') showFeedback(SELECTOR_TEXTS.emptyPermission, 'error')
      else {
        showFeedback(SELECTOR_TEXTS.cannotInject, 'error')
        if (response && typeof response.detail === 'string' && response.detail) {
          setTechPreview(response.detail)
        }
      }
    } finally {
      pickStartInFlight = false
      updateTargetCards(currentSite, currentConnection === 'ok')
    }
  }

  pickPairBtn?.addEventListener('click', () => {
    void startPick('pair')
  })
  pickInputBtn.addEventListener('click', () => {
    void startPick('input')
  })
  pickButtonBtn.addEventListener('click', () => {
    void startPick('button')
  })
  nextStepBtn?.addEventListener('click', () => {
    const field = nextStepBtn.dataset.field
    if (field === 'input' || field === 'button') {
      void startPick(field)
    }
  })

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('quizlab:paired', () => {
      void refresh()
    })
  }

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
    initNavigation()
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
