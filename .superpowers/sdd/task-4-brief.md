### Task 4: Harden CSP — Replace `unsafe-inline` with Nonce-Based Policy

**Files:**

- Create: `electron/core/csp.ts`
- Modify: `src/index.html:7-9`
- Modify: `electron/app/window/rendererLoader.ts`

- [ ] **Step 1: Create CSP utility file `electron/core/csp.ts`**

```typescript
import crypto from 'crypto'

export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64')
}

export function getStrictCsp(nonce: string): string {
  return [
    "default-src 'self' blob: local-pdf:",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    'frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:',
    'child-src blob:',
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: local-pdf:"
  ].join('; ')
}

export function getDevCsp(): string {
  // Dev mode needs unsafe-inline for React Fast Refresh / HMR
  return [
    "default-src 'self' blob: local-pdf:",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    'frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:',
    'child-src blob:',
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: local-pdf:"
  ].join('; ')
}
```

- [ ] **Step 2: Update `src/index.html` CSP meta tag — remove `unsafe-inline` from script-src**

Change the current CSP meta tag (line 7-9) to remove `'unsafe-inline'` from `script-src`:

```html
<!-- Current: has 'unsafe-inline' in script-src -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self' blob: local-pdf: https://cdnjs.cloudflare.com https://unpkg.com; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:; child-src blob:; worker-src 'self' blob: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' blob: local-pdf:"
/>

<!-- After: remove 'unsafe-inline' from script-src -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self' blob: local-pdf: https://cdnjs.cloudflare.com https://unpkg.com; script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:; child-src blob:; worker-src 'self' blob: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' blob: local-pdf:"
/>
```

- [ ] **Step 3: Update `electron/app/window/rendererLoader.ts` to inject nonce-based CSP**

Add the CSP injection at the start of `loadRenderer`. The current file structure is:

```typescript
import { app, type BrowserWindow, dialog } from 'electron'
import path from 'path'
// ... other imports ...
import { generateCspNonce, getDevCsp, getStrictCsp } from '../../core/csp'

export async function loadRenderer(window: BrowserWindow) {
  // SECURITY: Inject a nonce-based CSP for production builds.
  // Dev mode still uses unsafe-inline for React Fast Refresh.
  const nonce = generateCspNonce()
  const csp = isDev ? getDevCsp() : getStrictCsp(nonce)

  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  if (!isDev) {
    window.setMenu(null)
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    await window.loadFile(indexPath).catch(() => {
      dialog.showErrorBox('Load Error', `Index not found: ${indexPath}`)
    })
    return
  }
  // ... rest unchanged ...
```

Note: The CSP header injected via `onHeadersReceived` overrides the `<meta>` tag in index.html, so the nonce-based policy takes effect.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --force`
Expected: Exit code 0 (ignore pre-existing normalizePdfText.ts error)

- [ ] **Step 5: Commit**

Run: `git add src/index.html electron/core/csp.ts electron/app/window/rendererLoader.ts && git commit -m "fix(security): replace unsafe-inline CSP with nonce-based policy"`
