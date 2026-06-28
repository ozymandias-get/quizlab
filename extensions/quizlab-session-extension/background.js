const BRIDGE_HOST = '127.0.0.1'
const PORT_START = 51999
const PORT_END = 52009
const SCAN_INTERVAL_MS = 30000
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
const HEARTBEAT_INTERVAL_MIN = 1

const GOOGLE_COOKIE_DOMAINS = ['.google.com', '.gemini.google.com', '.aistudio.google.com']

let currentPort = PORT_START
let connected = false
let cookieDebounceTimer = null
let bridgeSecret = null

// --- Alarm-based reconnect (survives SW termination in MV3) ---
// RULE: At least one alarm is always active so the SW can be woken.
//   - Not connected: SCAN_ALARM fires every 30s to check for bridge
//   - Connected:     HEARTBEAT_ALARM fires every 1min to keep alive

chrome.storage.session.get('bridgeSecret', (result) => {
  if (result.bridgeSecret) {
    bridgeSecret = result.bridgeSecret
  }
})

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

  await fetchBridgeSecret(currentPort)

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
      return true
    } else {
      console.warn('[Quizlab Bridge] App rejected cookies, status:', response.status)
      return false
    }
  } catch (error) {
    const errMsg = error && typeof error.message === 'string' ? error.message : String(error)
    console.warn('[Quizlab Bridge] Failed to send cookies:', errMsg)
    connected = false
    enterScanMode()
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

function enterScanMode() {
  // RULE: Always keep a scan alarm active when disconnected.
  // This ensures the SW can be woken by the alarm system.
  connected = false
  chrome.alarms.create(SCAN_ALARM, { delayInMinutes: SCAN_INTERVAL_MS / 60000 })
}

function setupHeartbeat() {
  // RULE: Always keep a heartbeat alarm active when connected.
  connected = true
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_INTERVAL_MIN })
}

async function scanForBridge() {
  // RULE: Every SW wake-up (any reason) checks for the bridge server.
  for (let port = PORT_START; port <= PORT_END; port++) {
    try {
      const response = await fetch(`http://${BRIDGE_HOST}:${port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        currentPort = port
        await fetchBridgeSecret(port)
        await sendCookiesToApp()
        setupHeartbeat()
        chrome.alarms.clear(SCAN_ALARM).catch(() => {})
        return
      }
    } catch {}
  }

  // Bridge not found — enter scan mode if not already scanning
  if (!connected) {
    enterScanMode()
  }
}

// === Event listeners registered synchronously at top level (MV3 requirement) ===

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    scanForBridge()
  } else if (alarm.name === HEARTBEAT_ALARM) {
    if (connected) {
      sendCookiesToApp()
    }
  }
})

chrome.runtime.onInstalled.addListener(() => {
  scanForBridge()
})

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!connected || !changeInfo.cookie) return
  if (!isGoogleDomain(changeInfo.cookie.domain)) return

  if (cookieDebounceTimer) clearTimeout(cookieDebounceTimer)
  cookieDebounceTimer = setTimeout(() => {
    sendCookiesToApp()
  }, 2000)
})

// Triggers on Chrome startup and whenever the SW is spun up
scanForBridge()

// Wake up the service worker when the user navigates to Gemini or AI Studio
chrome.webNavigation.onCompleted.addListener(
  () => {
    scanForBridge()
  },
  {
    url: [{ hostSuffix: 'gemini.google.com' }, { hostSuffix: 'aistudio.google.com' }]
  }
)
