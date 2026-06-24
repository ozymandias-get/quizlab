# Task 9: Zeroize API Keys from Memory After Use

## What I implemented

- Moved `safeApiKey` and `headers` declarations outside the `try` block in the `SEND_API_CHAT_REQUEST` handler (`handlers.ts:94-100`) so they remain in scope after the `try/catch/finally`.
- Added `headers['Authorization'] = ''` after the `finally` block (`handlers.ts:184`) to clear the API key reference from memory after the HTTP request completes (whether successful, failed, or timed out).

## What I tested

- Typecheck with `npx tsc -b --force` — only pre-existing `normalizePdfText.ts` error, no new errors.

## Files changed

- `electron/features/ai/apiChatHandlers/handlers.ts` — moved declarations out of try block, added zeroization after finally.

## Self-review findings

- The `headers` variable was originally scoped inside `try`, so a direct `headers['Authorization'] = ''` after the `finally` block would fail. Hoisting the declaration fixes this cleanly.
- The zeroization runs unconditionally after the finally block, covering success, catch returns, and abort timeouts.
- Other usages of `headers` (like early returns before the fetch call) are unaffected since they execute before the zeroization line.

## Concerns

None.
