# Task 2: Harden PDF Protocol — Remove `bypassCSP` & Restrict CORS

## What I implemented

1. **Removed `bypassCSP: true`** from the `protocol.registerSchemesAsPrivileged` privileges object in `registerPdfScheme()`.
2. **Removed wildcard CORS headers** (`Access-Control-Allow-Origin: '*'` and `Access-Control-Allow-Headers: '*'`) from `PDF_STREAM_HEADERS`.
3. **Added origin validation** in `registerPdfProtocol()`:
   - Extracts `origin` from the incoming request
   - Rejects requests from origins not starting with `local-pdf://`, `file://`, `http://localhost`, or `http://127.0.0.1` with a 403 response
   - Dynamically sets `Access-Control-Allow-Origin` to the validated request origin (only when origin is present)
   - Adds `Vary: Origin` header to enable proper caching behavior

## What I tested

- Ran `npm run typecheck` — only the pre-existing error in `normalizePdfText.ts:57` remains; no new type errors from this file.

## Files changed

- `electron/features/pdf/pdfProtocol.ts` — 16 insertions, 6 deletions

## Self-review findings

- The `createPdfResponseHeaders` function still spreads `PDF_STREAM_HEADERS` — this is correct since the headers object is now CSP-safe.
- The origin check runs before the file system operations (stat, stream), which is good for performance — we reject unauthorized origins early without disk I/O.
- The `Vary: Origin` header is correctly set so that HTTP caches treat responses from different origins as separate cached entries.

## Any issues or concerns

None.
