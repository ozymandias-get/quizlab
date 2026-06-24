# Task 4 Report: Harden CSP — Replace `unsafe-inline` with Nonce-Based Policy

## What Was Implemented

1. **Created `electron/core/csp.ts`** — CSP utility module with three exports:
   - `generateCspNonce()` — generates a 16-byte random nonce (base64)
   - `getStrictCsp(nonce)` — production CSP string using `'nonce-<value>'`
   - `getDevCsp()` — dev CSP string using `'unsafe-inline'` for React Fast Refresh

2. **Modified `src/index.html`** — removed `'unsafe-inline'` from `script-src` in the CSP meta tag

3. **Modified `electron/app/window/rendererLoader.ts`** — added CSP injection at the start of `loadRenderer`:
   - Generates a nonce
   - Selects dev vs strict CSP based on `isDev`
   - Injects `Content-Security-Policy` header via `webRequest.onHeadersReceived`

## Testing

- `npx tsc -b --force` — only pre-existing error in `normalizePdfText.ts:57`, no new type errors introduced

## Files Changed

| File                                    | Action                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `electron/core/csp.ts`                  | Created (new)                                        |
| `src/index.html`                        | Modified (removed `'unsafe-inline'` from script-src) |
| `electron/app/window/rendererLoader.ts` | Modified (added CSP header injection)                |

## Self-Review

- CSP header from `onHeadersReceived` correctly overrides the `<meta>` tag CSP, so nonce-based policy takes effect in production
- Dev mode still gets `'unsafe-inline'` for React Fast Refresh compatibility
- Nonce is generated fresh each time `loadRenderer` is called
- The `frame-src` directive has a comprehensive allowlist for AI chat platforms

## Issues / Concerns

- None
