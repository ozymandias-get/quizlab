### Task 9: Zeroize API Keys from Memory After Use

**Files:**

- Modify: `electron/features/ai/apiChatHandlers/handlers.ts`

- [ ] **Step 1: Zeroize API key reference after HTTP request**

In `electron/features/ai/apiChatHandlers/handlers.ts`, inside the `SEND_API_CHAT_REQUEST` handler, after the `try/catch/finally` block where the API request is made, clear the `Authorization` header reference.

Find the section around lines 94-101 where `safeApiKey` and `headers` are set up:

```typescript
const safeApiKey = sanitizeApiKey(provider.apiKey || '')
const headers: Record<string, string> = {
  'Content-Type': 'application/json'
}
if (safeApiKey) {
  headers['Authorization'] = `Bearer ${safeApiKey}`
}

// ... the fetch call happens inside try/catch ...

// After the finally block (after clearTimeout), add:
// SECURITY: Clear API key reference from memory after the request completes
headers['Authorization'] = ''
```

Look for the exact location — after the `finally` block ends and before the next return statement. The code flow is:

```typescript
try {
  const response = await fetch(...)
  // ... response handling ...
} catch (err: unknown) {
  // ... error handling ...
} finally {
  clearTimeout(timeoutId)
  if (activeRequestController === controller) {
    activeRequestController = null
  }
}
// ADD HERE: headers['Authorization'] = ''
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --force`
Expected: Exit code 0 (ignore pre-existing normalizePdfText.ts error)

- [ ] **Step 3: Commit**

Run: `git add electron/features/ai/apiChatHandlers/handlers.ts && git commit -m "fix(security): zeroize API key from memory after HTTP request"`
