# Task 6: Restrict Native Messaging Shared Secret Scope

## What I implemented

Removed the HMAC `secret` field from the native messaging bridge config IPC response sent to the renderer process. The Chrome extension already reads this secret from the bridge info file on disk, so exposing it via IPC was unnecessary and introduced a risk of secret leakage via XSS.

## Files changed

- `electron/features/native-messaging/nativeMessagingHandlers.ts:48` — removed `secret: nativeMessagingManager.sharedSecret` from the `NATIVE_MESSAGING_BRIDGE_CONFIG` handler response
- `shared/types/ipcContract.ts:273` — removed `secret: string` from the `IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG` result type definition
- `shared/types/ipcContract.ts:445` — removed `secret: string` from the `ElectronApi.nativeMessaging.getBridgeConfig` return type

## What I tested and test results

Ran `npx tsc -b --force` — only pre-existing error in `normalizePdfText.ts` remains (task indicated to ignore this). No new type errors introduced.

## Self-review findings

The `ElectronApi` interface in `ipcContract.ts` also had the `secret` field in its `getBridgeConfig` return type, which caused a type error in `electron/preload/index.ts`. This was not mentioned in the task brief but was necessary to fix for type correctness. All three sites where `secret` appeared in the bridge config type/response have been cleaned up.

## Issues or concerns

None.
