# Bridge Connection Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the "extension installed but never connects" bug by making the Chrome extension reconnect indefinitely and the Quizlab app manage connection state intelligently.

**Architecture:** Three-layer fix: (1) Extension always keeps an alarm active so MV3 SW stays wakeable, removes max-attempt limit. (2) App tracks `waitingSince`/`userHint` and transitions state smartly based on `_bridgeInfoExists`. (3) UI surfaces accurate status with user guidance.

**Tech Stack:** Chrome MV3 extension (vanilla JS), Electron + TypeScript (app), React (UI)

## Global Constraints

- `extensions/quizlab-session-extension/background.js` is plain JS (no TS), keep it that way
- Follow existing patterns in `nativeMessagingManager.ts` and `ExtensionStatusCard.tsx`
- i18n keys: add to both `en/gws.json` and `tr/gws.json`
- All new test cases follow existing vitest patterns in the test files
- `NativeMessagingExtensionInfo` type in `shared/types/native-messaging.ts`

---

### Task 1: Update shared types + i18n

**Files:**

- Modify: `shared/types/native-messaging.ts`
- Modify: `src/shared/i18n/locales/en/gws.json`
- Modify: `src/shared/i18n/locales/tr/gws.json`

**Interfaces:**

- Consumes: none (foundation task)
- Produces: updated `NativeMessagingExtensionInfo` with `waitingSince` + `userHint`; new i18n keys

- [ ] **Step 1: Add `waitingSince` and `userHint` to the shared type**

Edit `shared/types/native-messaging.ts`:

```typescript
export interface NativeMessagingExtensionInfo {
  status: NativeMessagingConnectionStatus
  installed: boolean
  error?: string
  /** Timestamp (ms) when the connecting state began, or null. */
  waitingSince: number | null
  /** Localized hint text shown to the user when waiting. */
  userHint: string | null
}
```

- [ ] **Step 2: Add i18n keys for EN locale**

Edit `src/shared/i18n/locales/en/gws.json` — add after line 79 (after `gws_extension_status_error`):

```json
  "gws_extension_status_waiting": "Waiting for Chrome extension connection... Make sure Chrome is running and the extension is enabled.",
  "gws_extension_status_waiting_long": "Still waiting. Open chrome://extensions and verify the Quizlab extension is enabled and loaded.",
  "gws_extension_status_not_installed": "Extension not installed.",
```

- [ ] **Step 3: Add i18n keys for TR locale**

Edit `src/shared/i18n/locales/tr/gws.json` — add after line 79:

```json
  "gws_extension_status_waiting": "Chrome eklentisi bekleniyor... Chrome'un açık olduğundan ve eklentinin etkin olduğundan emin olun.",
  "gws_extension_status_waiting_long": "Hala bekleniyor. chrome://extensions sayfasını açıp Quizlab eklentisinin etkin olduğunu kontrol edin.",
  "gws_extension_status_not_installed": "Eklenti yüklü değil.",
```

- [ ] **Step 4: Verify with typecheck**

Run: `npx tsc -b --noEmit` — expected: no errors (the new fields are optional so existing consumers don't break).

---

### Task 2: Extension background.js — Indefinite Reconnect + Wake Guarantee

**Files:**

- Modify: `extensions/quizlab-session-extension/background.js`

**Interfaces:**

- Consumes: `http://127.0.0.1:{port}/api/health` and `/api/cookies` (unchanged API)
- Produces: Extension connects to bridge server and stays reconnect-capable forever

- [ ] **Step 1: Rewrite `background.js` with the new approach**

Replace the entire file content:

```javascript
const BRIDGE_HOST = '127.0.0.1'
const PORT_START = 51999
const PORT_END = 52009
const SCAN_INTERVAL_MS = 30000
const SCAN_ALARM = 'quizlabScan'
const HEARTBEAT_ALARM = 'quizlabHeartbeat'
const HEARTBEAT_INTERVAL_MIN = 1

const GOOGLE_COOKIE_DOMAINS = ['.gemini.google.com', '.aistudio.google.com']

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
  // This is called from:
  //   - SCAN_ALARM fires (periodic scan while disconnected)
  //   - HEARTBEAT_ALARM fires (periodic heartbeat while connected)
  //   - chrome.runtime.onInstalled
  //   - top-level (SW warm start)

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
      // Re-enter scan mode if heartbeat fails (sendCookiesToApp transitions on failure)
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
```

- [ ] **Step 2: Verify extension loads in Chrome**
      Manual: Open `chrome://extensions` → Load unpacked → select `extensions/quizlab-session-extension/` → verify no errors in the service worker console.

---

### Task 3: nativeMessagingManager.ts — Smart State Management

**Files:**

- Modify: `electron/features/native-messaging/nativeMessagingManager.ts`

**Interfaces:**

- Consumes: `NativeMessagingExtensionInfo` type with new fields from Task 1
- Produces: `getExtensionInfo()` returns updated info with `waitingSince` + `userHint`; health check transitions state based on `_bridgeInfoExists`

- [ ] **Step 1: Add `_waitingSince` field and update `getExtensionInfo()`**

Add to the class body (after `_bridgeInfoExists`):

```typescript
private _waitingSince: number | null = null
```

Update `getExtensionInfo()`:

```typescript
getExtensionInfo(): NativeMessagingExtensionInfo {
  return {
    status: this._connectionStatus,
    installed: this._bridgeInfoExists,
    error: this._connectionStatus === 'error' ? 'Bridge server not running' : undefined,
    waitingSince: this._waitingSince,
    userHint: this.computeUserHint()
  }
}
```

- [ ] **Step 2: Add `computeUserHint()` method**

Add after `broadcastExtensionDisconnected()`:

```typescript
private computeUserHint(): string | null {
  if (!this._bridgeInfoExists) return null
  if (this._connectionStatus !== 'connecting') return null
  if (!this._waitingSince) return null

  const elapsed = Date.now() - this._waitingSince
  if (elapsed > 30000) {
    return 'waiting_long'
  }
  return 'waiting'
}
```

- [ ] **Step 3: Update health check with smart state transitions**

Replace the `startHealthCheck()` method:

```typescript
private startHealthCheck(): void {
  if (this.healthCheckInterval) clearInterval(this.healthCheckInterval)

  this.healthCheckInterval = setInterval(() => {
    const now = Date.now()
    const elapsed = now - this._extensionLastSeenAt

    if (this._connectionStatus === 'connected' && elapsed > 120000) {
      this._connectionStatus = 'connecting'
      this._waitingSince = now
      this.broadcastExtensionDisconnected()
    }

    // If we're connecting but extension was never installed, go to disconnected
    if (this._connectionStatus === 'connecting' && !this._bridgeInfoExists) {
      this._connectionStatus = 'disconnected'
      this._waitingSince = null
    }
  }, 30000)
}
```

- [ ] **Step 4: Set `_waitingSince` on server start (connecting state)**

In `startServer()`, after `this._connectionStatus = 'connecting'`, add:

```typescript
this._waitingSince = Date.now()
```

- [ ] **Step 5: Reset `_waitingSince` on successful cookie POST**

In `handleCookiePost()`, inside the `if (this._connectionStatus !== 'connected')` block (line 278-282), add:

```typescript
this._waitingSince = null
```

So the block becomes:

```typescript
if (this._connectionStatus !== 'connected') {
  this._connectionStatus = 'connected'
  this._waitingSince = null
  this._extensionLastSeenAt = Date.now()
  this.broadcastExtensionConnected()
}
```

- [ ] **Step 6: Reset `_waitingSince` on stop/dispose**

In `stopServer()`, after `this._connectionStatus = 'disconnected'`, add:

```typescript
this._waitingSince = null
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit` — expected: no errors.

---

### Task 4: ExtensionStatusCard.tsx — Updated UI

**Files:**

- Modify: `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx`

**Interfaces:**

- Consumes: Updated `NativeMessagingExtensionInfo` with `waitingSince` + `userHint` from Task 1 + Task 3
- Produces: UI showing accurate connection state with user guidance

- [ ] **Step 1: Update the status key logic and add waiting state display**

Replace the `EXTENSION_STATUS_KEYS` mapping and add a `getStatusText` helper.

Replace the component with:

```typescript
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { LoaderIcon, SettingsIcon } from '@ui/components/Icons'

import { memo, useEffect, useState } from 'react'

interface ExtensionStatusCardProps {
  t: (key: string) => string
  onInstallExtension: () => void
  onRemoveExtension: () => void
}

function ExtensionStatusCard({
  t,
  onInstallExtension,
  onRemoveExtension
}: ExtensionStatusCardProps) {
  const [extensionInfo, setExtensionInfo] = useState<NativeMessagingExtensionInfo | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.nativeMessaging) return

    const updateStatus = () => {
      api.nativeMessaging
        .getStatus()
        .then(setExtensionInfo)
        .catch(() => {})
    }

    updateStatus()
    const interval = setInterval(updateStatus, 5000)

    const unsubConnected = api.nativeMessaging.onExtensionConnected(() => {
      updateStatus()
    })
    const unsubDisconnected = api.nativeMessaging.onExtensionDisconnected(() => {
      updateStatus()
    })

    return () => {
      clearInterval(interval)
      unsubConnected()
      unsubDisconnected()
    }
  }, [])

  const handleInstallClick = async () => {
    if (installing) return
    setInstalling(true)
    try {
      await onInstallExtension()
    } finally {
      setInstalling(false)
    }
  }

  const statusKey = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'gws_extension_status_disconnected'

    if (info.status === 'connected') {
      return 'gws_extension_status_connected'
    }

    if (info.status === 'error') {
      return 'gws_extension_status_error'
    }

    if (info.status === 'connecting' && info.installed) {
      const hint = info.userHint
      if (hint === 'waiting_long') {
        return 'gws_extension_status_waiting_long'
      }
      if (hint === 'waiting') {
        return 'gws_extension_status_waiting'
      }
      return 'gws_extension_status_connecting'
    }

    if (info.status === 'connecting' && !info.installed) {
      return 'gws_extension_status_not_installed'
    }

    return 'gws_extension_status_disconnected'
  }

  const dotColor = (info: NativeMessagingExtensionInfo | null): string => {
    if (!info) return 'bg-white/30'
    if (info.status === 'connected') return 'bg-emerald-400'
    if (info.status === 'connecting' && info.installed) return 'bg-amber-400'
    return 'bg-white/30'
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 backdrop-blur-sm">
      <div className="text-ql-12 mb-3 font-bold text-white/85">{t('gws_extension_title')}</div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${dotColor(extensionInfo)}`} />
          <span className="text-ql-12 text-white/70">
            {t(statusKey(extensionInfo))}
          </span>
        </div>

        {extensionInfo?.installed ? (
          <button
            type="button"
            onClick={onRemoveExtension}
            className="text-ql-11 text-red-400 hover:text-red-300"
          >
            {t('gws_extension_remove_btn')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="text-ql-11 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 font-semibold text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
          >
            {installing ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SettingsIcon className="h-3.5 w-3.5" />
            )}
            {t('gws_extension_install_btn')}
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(ExtensionStatusCard)
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/features/automation/usePickerConsoleBridge.test.tsx` (or check if there are tests for ExtensionStatusCard).

Check: `npx tsc -b --noEmit` — expected: no errors.

---

### Task 5: Update Tests

**Files:**

- Modify: `electron/__tests__/features/native-messaging/nativeMessagingManager.test.ts`

**Interfaces:**

- Consumes: Same imports, same mock structure
- Produces: Test coverage for new state transitions

- [ ] **Step 1: Add test for initial getExtensionInfo with new fields**

Add inside `describe('getters')`:

```typescript
it('getExtensionInfo includes waitingSince and userHint', () => {
  const info = manager.getExtensionInfo()
  expect(info).toHaveProperty('waitingSince')
  expect(info).toHaveProperty('userHint')
  expect(info.waitingSince).toBeNull()
  expect(info.userHint).toBeNull()
})
```

- [ ] **Step 2: Add tests for new state fields**

Add after the `stopServer` describe block:

```typescript
describe('getExtensionInfo new fields', () => {
  it('includes waitingSince and userHint (null by default)', () => {
    const info = manager.getExtensionInfo()
    expect(info).toHaveProperty('waitingSince')
    expect(info).toHaveProperty('userHint')
    expect(info.waitingSince).toBeNull()
    expect(info.userHint).toBeNull()
  })

  it('sets waitingSince after initialize (connecting state)', async () => {
    await manager.initialize()
    const info = manager.getExtensionInfo()
    expect(info.waitingSince).toBeTypeOf('number')
  })

  it('sets userHint to null when extension is installed but not yet waiting', async () => {
    // Simulate bridge info exists but still connecting
    mockFsStat.mockResolvedValue(undefined) // bridgeInfo exists
    await manager.initialize()
    const info = manager.getExtensionInfo()
    expect(info.installed).toBe(true)
    expect(info.userHint).toBe('waiting')
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run electron/__tests__/features/native-messaging/nativeMessagingManager.test.ts`
Expected: all tests pass, including the new ones.
