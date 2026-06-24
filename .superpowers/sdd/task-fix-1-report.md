# Task Fix Report: Fix 18 Test Failures from Security Hardening

## What Was Fixed

### Failure Group 1: CSP injection in rendererLoader (3 failures)

- **File:** `electron/app/window/rendererLoader.ts:51`
- **Fix:** Added null guard `if (window.webContents.session?.webRequest)` around the `onHeadersReceived` call so tests (and edge cases) without `session.webRequest` don't crash.

### Failure Group 2: Native messaging bridge config test (1 failure)

- **File:** `electron/__tests__/features/native-messaging/nativeMessagingHandlers.test.ts:200`
- **Fix:** Removed `secret: 'abc123'` from the expected `NATIVE_MESSAGING_BRIDGE_CONFIG` handler result, matching the security hardening removal of `secret` from the bridge config response.

### Failure Group 3: Session import .enc validation (14 failures)

- **File:** `electron/__tests__/features/gemini-web-session/sessionExportImport.test.ts:8`
- **Fix:** Changed `testExportPath` from `export.json` to `export.enc`, since the new `importSession` code rejects files that don't end with `.enc`.

## Test Results After Fix

All 33 tests across 4 test files pass:

- `electron/__tests__/app/window/rendererLoader.test.ts` — 2 tests ✓
- `electron/__tests__/app/windowManager.test.ts` — 1 test ✓
- `electron/__tests__/features/native-messaging/nativeMessagingHandlers.test.ts` — 10 tests ✓
- `electron/__tests__/features/gemini-web-session/sessionExportImport.test.ts` — 20 tests ✓

## Files Changed

1. `electron/app/window/rendererLoader.ts` — Added null guard for `session?.webRequest`
2. `electron/__tests__/features/native-messaging/nativeMessagingHandlers.test.ts` — Removed `secret` from expected bridge config
3. `electron/__tests__/features/gemini-web-session/sessionExportImport.test.ts` — Changed test export path to `.enc` extension
