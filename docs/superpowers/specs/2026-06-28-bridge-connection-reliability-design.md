# Bridge Connection Reliability Design

## Problem

The Quizlab Chrome extension (MV3) fails to connect to the Quizlab desktop app when the extension was already installed before the app started. This is caused by the MV3 service worker lifecycle: Chrome terminates the SW after ~30s of inactivity, and the extension's reconnect mechanism gives up after 20 attempts (`MAX_RECONNECT_ATTEMPTS`), clearing all alarms — meaning the SW may never wake again.

## Architecture

Three layers need improvement:

### 1. Extension (`background.js`) — Indefinite Reconnect + Wake Guarantee

**Rules (enforced at all times):**

- At least one alarm is always active (heartbeat when connected, scan when disconnected)
- Every SW wake-up (any reason) triggers a bridge server check
- Reconnection is indefinite (no max attempt limit)
- Exponential backoff: 5s → 30s → 60s max, never stops

**Flow:**

```
SW wakes up → check bridge → found? → connect + heartbeat alarm (1min)
                           → not found? → scan alarm (30s-60s)

Heartbeat fails → clear heartbeat → enter reconnect mode → scan alarm
Scan succeeds → clear scan → connect → heartbeat alarm
```

**Changes:**

- Remove `MAX_RECONNECT_ATTEMPTS` (reconnect runs forever)
- `tryReconnect()` always sets a scan alarm on failure (no early exit)
- `saveState()` no longer needed (no max attempts to track)
- Top-level call: `ensureConnection()` runs on every SW wake

### 2. App (`nativeMessagingManager.ts`) — Smart State Management

**Status transitions:**

```
disconnected → connecting (server starts)
connecting → connected (first cookie POST received)
connected → connecting (120s no extension activity)
connecting + !bridgeInfoExists → disconnected (no point waiting)
connecting + bridgeInfoExists + >60s → keep connecting, flag for UI
```

**`getExtensionInfo()` additions:**

- `waitingSince: number | null` — timestamp when `connecting` started
- `userHint: string | null` — localized suggestion for the user

**Health check enhancements:**

- Track how long we've been in `connecting` state
- If `_bridgeInfoExists && connecting > 60s` → set `userHint`
- If `!_bridgeInfoExists && connecting` → downgrade to `disconnected`

### 3. UI (`ExtensionStatusCard.tsx`) — Accurate Feedback

**States displayed:**
| `installed` | `status` | `waitingSince` | Display |
|---|---|---|---|
| true | connected | - | 🟢 "Eklentiye bağlandı" |
| true | connecting | < 30s | 🟡 "Chrome eklentisi bekleniyor..." |
| true | connecting | > 30s | 🟡 "Eklenti bekleniyor. Chrome'un açık olduğundan ve eklentinin etkin olduğundan emin olun." |
| true | error | - | 🔴 "Köprü hatası" |
| false | \* | - | ⚪ "Eklenti yüklü değil" |

## Files Changed

| File                                                                           | Change                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `extensions/quizlab-session-extension/background.js`                           | Remove max attempts, always-active alarm, ensureConnection() top-level |
| `electron/features/native-messaging/nativeMessagingManager.ts`                 | Smart state transitions, waitingSince, userHint, health check logic    |
| `shared/types/native-messaging.ts`                                             | Add `waitingSince`, `userHint` to `NativeMessagingExtensionInfo`       |
| `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx` | Display new states and hints                                           |

## Testing

- Extension: Manual test in Chrome dev mode — install, start/stop app, verify reconnect
- `nativeMessagingManager.test.ts`: New test cases for state transitions
- `ExtensionStatusCard.test.tsx`: New test cases for all state displays
