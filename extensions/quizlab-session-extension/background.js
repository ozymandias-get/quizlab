const BRIDGE_HOST = '127.0.0.1'
const PORT_START = 51999
const PORT_END = 52009
const RECONNECT_INTERVAL_MS = 5000
const MAX_RECONNECT_ATTEMPTS = 20
const RECONNECT_ALARM = 'quizlabReconnect'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
const HEARTBEAT_INTERVAL_MIN = 1

const GOOGLE_COOKIE_DOMAINS = [
  '.google.com',
  'accounts.google.com',
  '.youtube.com',
  '.drive.google.com',
  '.gemini.google.com',
  '.aistudio.google.com',
  '.googleapis.com'
]

let currentPort = PORT_START
let connected = false
let reconnectAttempts = 0
let cookieDebounceTimer = null
let bridgeSecret = null

// Alarm-based reconnect state (survives SW termination in MV3)
let persistentState = { reconnectAttempts: 0 }

chrome.storage.session.get('bridgeState', (result) => {
  if (result.bridgeState) {
    persistentState = result.bridgeState
    reconnectAttempts = persistentState.reconnectAttempts || 0
  }
})

chrome.storage.session.get('bridgeSecret', (result) => {
  if (result.bridgeSecret) {
    bridgeSecret = result.bridgeSecret
  }
})

function saveState() {
  persistentState.reconnectAttempts = reconnectAttempts
  chrome.storage.session.set({ bridgeState: persistentState }).catch(() => {})
}

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

async function sendCookiesToApp() {
  if (!connected) return

  try {
    const allCookies = []
    for (const domain of GOOGLE_COOKIE_DOMAINS) {
      const cookies = await chrome.cookies.getAll({ domain })
      allCookies.push(...cookies)
    }

    const uniqueCookies = new Map()
    for (const cookie of allCookies) {
      const key = `${cookie.name}:${cookie.domain}:${cookie.path}`
      if (!uniqueCookies.has(key)) {
        uniqueCookies.set(key, cookie)
      }
    }

    const cookies = [...uniqueCookies.values()].map(normalizeCookie)

    const secure1psid = cookies.find((c) => c.name === '__Secure-1PSID')
    let accountHash = null
    if (secure1psid) {
      const encoder = new TextEncoder()
      const data = encoder.encode(secure1psid.value)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = [...new Uint8Array(hashBuffer)]
      accountHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    const payload = {
      cookies,
      accountHash,
      timestamp: new Date().toISOString()
    }

    const body = JSON.stringify(payload)

    // SECURITY: HMAC sign the request body so the bridge can verify
    // this request comes from the paired extension, not an impostor.
    const headers = { 'Content-Type': 'application/json' }
    if (bridgeSecret) {
      headers['x-hmac-signature'] = await computeHmac(body, bridgeSecret)
    }

    const response = await fetch(`http://${BRIDGE_HOST}:${currentPort}/api/cookies`, {
      method: 'POST',
      headers: headers,
      body: body
    })

    if (response.ok) {
      const result = await response.json()
      return true
    } else {
      console.warn('[Quizlab Bridge] App rejected cookies, status:', response.status)
      return false
    }
  } catch (error) {
    const errMsg = error && typeof error.message === 'string' ? error.message : String(error)
    console.warn('[Quizlab Bridge] Failed to send cookies:', errMsg)
    connected = false
    tryReconnect()
    return false
  }
}

function normalizeCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain || '',
    path: cookie.path || '/',
    secure: cookie.secure || false,
    httpOnly: cookie.httpOnly || false,
    sameSite: cookie.sameSite || 'unspecified',
    expires:
      typeof cookie.expirationDate === 'number' ? Math.floor(cookie.expirationDate) : undefined
  }
}

function isGoogleDomain(domain) {
  return GOOGLE_COOKIE_DOMAINS.some((d) => domain === d || domain.endsWith(d))
}

async function fetchBridgeSecret(port) {
  try {
    const response = await fetch(`http://${BRIDGE_HOST}:${port}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (response.ok) {
      const data = await response.json()
      if (data && data.secret) {
        bridgeSecret = data.secret
        chrome.storage.session.set({ bridgeSecret: data.secret }).catch(() => {})
        return true
      }
    }
  } catch {}
  return false
}

async function tryReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    chrome.alarms.clear(RECONNECT_ALARM).catch(() => {})
    return
  }

  reconnectAttempts++
  saveState()

  for (let port = PORT_START; port <= PORT_END; port++) {
    try {
      const response = await fetch(`http://${BRIDGE_HOST}:${port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        currentPort = port
        connected = true
        reconnectAttempts = 0
        saveState()
        chrome.alarms.clear(RECONNECT_ALARM).catch(() => {})
        await fetchBridgeSecret(port)
        await sendCookiesToApp()
        setupHeartbeatAlarm()
        return
      }
    } catch {}
  }

  const delay = Math.min(RECONNECT_INTERVAL_MS * Math.pow(1.5, reconnectAttempts - 1), 30000)
  chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes: delay / 60000 })
}

async function attemptInitialConnection() {
  for (let port = PORT_START; port <= PORT_END; port++) {
    try {
      const response = await fetch(`http://${BRIDGE_HOST}:${port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500)
      })
      if (response.ok) {
        currentPort = port
        connected = true
        reconnectAttempts = 0
        saveState()
        chrome.alarms.clear(RECONNECT_ALARM).catch(() => {})
        await fetchBridgeSecret(port)
        await sendCookiesToApp()
        setupHeartbeatAlarm()
        return
      }
    } catch {}
  }

  chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes: 0.1 })
}

function setupHeartbeatAlarm() {
  try {
    chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_INTERVAL_MIN })
  } catch {}
}

// === All event listeners registered synchronously at top level (MV3 requirement) ===

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) {
    tryReconnect()
  } else if (alarm.name === HEARTBEAT_ALARM && connected) {
    sendCookiesToApp()
  }
})

chrome.runtime.onInstalled.addListener((details) => {
  attemptInitialConnection()
})

// Cookie change listener registered at top level so MV3 event queue delivers it
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!connected || !changeInfo.cookie) return
  if (!isGoogleDomain(changeInfo.cookie.domain)) return

  if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer)
  cookieDebounceTimer = setTimeout(() => {
    sendCookiesToApp()
  }, 2000)
})

// Triggers on Chrome startup and whenever the SW is spun up
attemptInitialConnection()
