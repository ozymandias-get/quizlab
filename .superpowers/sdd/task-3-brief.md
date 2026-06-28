# Task 3: nativeMessagingManager.ts — computeUserHint + bridgeInfoExists check

**Files:**

- Modify: `electron/features/native-messaging/nativeMessagingManager.ts`

**Interfaces:**

- Consumes: `_waitingSince`, `_userHint`, `_bridgeInfoExists`, `_connectionStatus` (already added in Task 1)
- Produces: `getExtensionInfo()` returns `userHint` via `computeUserHint()` method; health check transitions state based on `_bridgeInfoExists`

## Context

Task 1 already added `_waitingSince`, `_userHint` fields and status transition updates to `nativeMessagingManager.ts`. But two things from the plan are still missing:

1. **`computeUserHint()` method** — currently `_userHint` is set inline with hardcoded strings. Instead, use a computed method that returns `'waiting'`, `'waiting_long'`, or `null` based on elapsed time since `_waitingSince`.

2. **Health check: `_bridgeInfoExists` check** — when connecting but extension was never installed (`!_bridgeInfoExists`), transition to `disconnected` state.

## Changes

### Step 1: Add `computeUserHint()` method and remove inline hints

Replace all instances of inline `_userHint = '...'` string assignments with the computed approach.

Remove these inline assignments:

- In `startServer()`: Remove `this._userHint = 'Waiting for Chrome extension connection...'`
- In `startHealthCheck()`: Remove `this._userHint = 'Still waiting...'`

Instead, update `getExtensionInfo()` to use a new `computeUserHint()`:

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

Remove the `_userHint` private field (since it's now computed), and remove all direct assignments to `this._userHint`.

### Step 2: Add `_bridgeInfoExists` check in health check

In `startHealthCheck()`, after the connected→connecting timeout check, add:

```typescript
if (this._connectionStatus === 'connecting' && !this._bridgeInfoExists) {
  this._connectionStatus = 'disconnected'
  this._waitingSince = null
}
```

### Step 3: Run typecheck

Run: `npx tsc -b --noEmit` — expected: no errors.
