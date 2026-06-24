### Task 2: Harden PDF Protocol — Remove `bypassCSP` & Restrict CORS

**Files:**

- Modify: `electron/features/pdf/pdfProtocol.ts`

**Interfaces:**

- Consumes: `registerPdfScheme()`, `registerPdfProtocol()`, `PDF_STREAM_HEADERS`
- Produces: CSP-safe PDF streaming, CORS restricted to `local-pdf:` and `file:` origins

- [ ] **Step 1: Remove `bypassCSP` from protocol registration**

In `electron/features/pdf/pdfProtocol.ts`, in `registerPdfScheme()` (~line 188-201):
Remove `bypassCSP: true` from the privileges object.

```typescript
// BEFORE:
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-pdf',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true // ← REMOVE THIS
    }
  }
])

// AFTER:
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-pdf',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])
```

- [ ] **Step 2: Restrict CORS headers to safe origins only**

In `electron/features/pdf/pdfProtocol.ts`, the `PDF_STREAM_HEADERS` constant (~line 39-46):
Remove `Access-Control-Allow-Origin: '*'` and `Access-Control-Allow-Headers: '*'`.

```typescript
// BEFORE:
const PDF_STREAM_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes',
  'Access-Control-Allow-Origin': '*', // ← REMOVE
  'Access-Control-Allow-Headers': '*' // ← REMOVE
} as const

// AFTER:
const PDF_STREAM_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes'
} as const
```

- [ ] **Step 3: Set CORS origin dynamically from request in `registerPdfProtocol` handler**

In `electron/features/pdf/pdfProtocol.ts`, inside `registerPdfProtocol()` (~line 204-238), before the `return createPdfStreamResponse(...)` line (line 233), add an origin check and conditional CORS header:

```typescript
// Inside registerPdfProtocol(), add BEFORE return createPdfStreamResponse:
const requestOrigin = request.headers.get('origin')
const allowedOrigins = ['local-pdf://', 'file://', 'http://localhost', 'http://127.0.0.1']
if (requestOrigin && !allowedOrigins.some((o) => requestOrigin.startsWith(o))) {
  return new Response('Forbidden', { status: 403 })
}

// Then wrap the response with CORS origin header:
const response = createPdfStreamResponse(filePath, stats, request.headers.get('range'))
if (requestOrigin) {
  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Access-Control-Allow-Origin', requestOrigin)
  responseHeaders.set('Vary', 'Origin')
  return new Response(response.body, { status: response.status, headers: responseHeaders })
}
return response
```

- [ ] **Step 4: Verify PDF streaming still works**

Run: `npm run typecheck`
Expected: No type errors from this file

- [ ] **Step 5: Commit**

Run: `git add electron/features/pdf/pdfProtocol.ts && git commit -m "fix(security): remove bypassCSP and restrict CORS on PDF protocol"`
