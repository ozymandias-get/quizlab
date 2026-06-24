# Task 3: Fix `executeJavaScript` Injection in Webview Event Handler

## What was implemented

Removed the `executeJavaScript` fallback in the `handleNewWindow` callback in `src/shared/hooks/webview/useWebviewEventHandlers.ts`.

The previous code wrapped `loadURL` in a try/catch — if `loadURL` threw, it fell back to `executeJavaScript(window.location.href = ...)`, which is equivalent to `eval()` in the guest context. The fix replaces this with a single `loadURL` call with `.catch(() => {})` to silently ignore navigation failures.

## What was tested

- `npm run typecheck` passed with zero errors

## Files changed

- **Modified:** `src/shared/hooks/webview/useWebviewEventHandlers.ts`
  - Lines 160-168: replaced try/catch with loadURL-only approach

## Self-review findings

- The `.catch(() => {})` pattern preserves the original behavior of silently ignoring navigation failures (as the old `.catch(() => {})` on `executeJavaScript` did), so no change in error-handling semantics.
- Other uses of `executeJavaScript` in the codebase (e.g., `webviewSendReadiness`, `useElementPicker`, `pipelineUtils`) are for legitimate script execution in controlled contexts — these were not affected.

## Issues or concerns

None.
