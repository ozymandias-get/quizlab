### Task 7: Self-Host Fonts, Remove External CDN Dependencies

**Files:**

- Modify: `src/index.html`
- Modify: `electron/core/csp.ts`

**Context:** Inter font is already self-hosted via `@fontsource-variable/inter` (imported in `src/shared/styles/index.css:15`). Playfair Display is only loaded via CDN but not used in the codebase. CDN URLs (cdnjs.cloudflare.com, unpkg.com, cdn.jsdelivr.net, fonts.googleapis.com, fonts.gstatic.com) are in the CSP but no actual source code fetches from these URLs. They can be removed.

- [ ] **Step 1: Remove external font links from `src/index.html`**

Remove:

1. The two `<link rel="preconnect">` tags for fonts.googleapis.com and fonts.gstatic.com (lines 12-13)
2. The external font stylesheet `<link>` (lines 15-20)
3. The `<noscript>` fallback link (lines 22-27)

Also clean up the CSP meta tag: 4. Remove `https://cdnjs.cloudflare.com` and `https://unpkg.com` from `default-src` 5. Remove `https://cdn.jsdelivr.net` from `script-src` and `worker-src` 6. Keep `https://cdn.cloudflare.com` and `https://challenges.cloudflare.com` in `frame-src` (needed for Cloudflare Turnstile) 7. Remove `https://fonts.googleapis.com` from `style-src` 8. Remove `https://unpkg.com` from `style-src` 9. Remove `https://fonts.gstatic.com` from `font-src`

The resulting CSP should be:

```
default-src 'self' blob: local-pdf:; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src https://chatgpt.com https://*.chatgpt.com https://claude.ai https://*.claude.ai https://gemini.google.com https://aistudio.google.com https://www.youtube.com https://drive.google.com https://chat.deepseek.com https://chat.qwenlm.ai https://chat.qwen.ai https://kimi.com https://kimi.moonshot.cn https://copilot.microsoft.com https://grok.com https://huggingface.co https://manus.im https://chat.mistral.ai https://perplexity.ai https://accounts.google.com https://myaccount.google.com https://auth.openai.com https://auth0.openai.com https://platform.openai.com https://login.microsoftonline.com https://login.live.com https://login.x.com https://challenges.cloudflare.com https://cdn.cloudflare.com blob:; child-src blob:; worker-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self' blob: local-pdf:
```

- [ ] **Step 2: Clean up CSP in `electron/core/csp.ts`**

Apply the same CDN URL removal to both `getStrictCsp()` and `getDevCsp()` functions. The font-src and style-src no longer need external CDN entries.

`getStrictCsp` should become:

```
default-src 'self' blob: local-pdf:
script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob:
style-src 'self' 'unsafe-inline'
font-src 'self'
frame-src (same as above, unchanged)
child-src blob:
worker-src 'self' blob:
img-src 'self' data: blob:
connect-src 'self' blob: local-pdf:
```

Same changes for `getDevCsp`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --force`
Expected: Exit code 0 (ignore pre-existing normalizePdfText.ts error)

- [ ] **Step 4: Commit**

Run: `git add src/index.html electron/core/csp.ts && git commit -m "fix(security): self-host fonts, remove CDN dependencies from CSP"`
