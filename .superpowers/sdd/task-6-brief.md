### Task 6: Restrict Native Messaging Shared Secret Scope

**Files:**

- Modify: `electron/features/native-messaging/nativeMessagingHandlers.ts:42-57`
- Modify: `shared/types/ipcContract.ts:268-276`

- [ ] **Step 1: Remove `secret` from bridge config IPC response**

In `electron/features/native-messaging/nativeMessagingHandlers.ts`, change the NATIVE_MESSAGING_BRIDGE_CONFIG handler:

```typescript
// BEFORE (lines 42-57):
registerIpcHandler(
  IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG,
  async () => {
    return success({
      port: nativeMessagingManager.port,
      host: '127.0.0.1',
      secret: nativeMessagingManager.sharedSecret,
      endpoints: {
        cookies: '/api/cookies',
        health: '/api/health'
      }
    })
  },
  requireTrustedIpcSender,
  failure('unauthorized', 'Not authorized')
)

// AFTER (remove secret):
registerIpcHandler(
  IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG,
  async () => {
    return success({
      port: nativeMessagingManager.port,
      host: '127.0.0.1',
      endpoints: {
        cookies: '/api/cookies',
        health: '/api/health'
      }
    })
  },
  requireTrustedIpcSender,
  failure('unauthorized', 'Not authorized')
)
```

- [ ] **Step 2: Update IPC contract type**

In `shared/types/ipcContract.ts`, remove `secret` from the type:

```typescript
// BEFORE:
[IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG]: {
  args: []
  result: IpcResult<{
    port: number
    host: string
    secret: string
    endpoints: { cookies: string; health: string }
  }>
}

// AFTER:
[IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG]: {
  args: []
  result: IpcResult<{
    port: number
    host: string
    endpoints: { cookies: string; health: string }
  }>
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --force`
Expected: Exit code 0 (ignore pre-existing normalizePdfText.ts error)

- [ ] **Step 4: Commit**

Run: `git add electron/features/native-messaging/nativeMessagingHandlers.ts shared/types/ipcContract.ts && git commit -m "fix(security): remove native messaging shared secret from renderer-accessible IPC"`
