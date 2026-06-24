### Task 3: Fix `executeJavaScript` Injection in Webview Event Handler

**Files:**

- Modify: `src/shared/hooks/webview/useWebviewEventHandlers.ts:160-168`

**Interfaces:**

- Consumes: `webviewElement`, event payload with `url`
- Produces: Safe navigation without `executeJavaScript` fallback

- [ ] **Step 1: Remove the `executeJavaScript` fallback**

In `src/shared/hooks/webview/useWebviewEventHandlers.ts`, in the `handleNewWindow` callback (~lines 160-168):

Current code:

```typescript
if (isSameOrigin) {
  try {
    await activeWebviewRef.current?.loadURL?.(url)
  } catch {
    await activeWebviewRef.current
      ?.executeJavaScript(`window.location.href = ${JSON.stringify(url)}`)
      .catch(() => {})
  }
  return
}
```

Change to:

```typescript
if (isSameOrigin) {
  // SECURITY: Only use loadURL — never executeJavaScript as fallback.
  // executeJavaScript(code) is equivalent to eval() in the guest context.
  await activeWebviewRef.current?.loadURL?.(url).catch(() => {})
  return
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: No type errors from this file

- [ ] **Step 3: Commit**

Run: `git add src/shared/hooks/webview/useWebviewEventHandlers.ts && git commit -m "fix(security): remove executeJavaScript fallback in webview new-window handler"`
