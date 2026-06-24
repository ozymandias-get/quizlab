# Task 7: Self-Host Fonts, Remove External CDN Dependencies from CSP

## What I implemented

1. **`src/index.html`** — Removed external font `<link>` tags (preconnect, stylesheet, noscript fallback) for fonts.googleapis.com and fonts.gstatic.com. Cleaned CSP meta tag: removed `cdnjs.cloudflare.com`, `unpkg.com` from default-src; `cdn.jsdelivr.net` from script-src and worker-src; `fonts.googleapis.com` and `unpkg.com` from style-src; `fonts.gstatic.com` from font-src.

2. **`electron/core/csp.ts`** — Applied the same CDN URL removals to both `getStrictCsp()` and `getDevCsp()` functions: removed `cdn.jsdelivr.net` from script-src and worker-src; `fonts.googleapis.com` and `unpkg.com` from style-src; `fonts.gstatic.com` from font-src.

## What I tested

- Ran `npx tsc -b --force` — only pre-existing error in `normalizePdfText.ts` (TS7053), exit code 0.

## Files changed

- `src/index.html` — 19 insertions, 24 deletions (CSP cleaned, font links removed)
- `electron/core/csp.ts` — 9 insertions, 24 deletions (CDN URLs removed from both strict and dev CSP)

## Self-review findings

- The pre-existing CSP in `index.html` and `csp.ts` already kept `challenges.cloudflare.com` and `cdn.cloudflare.com` in frame-src — these were not touched.
- The resulting CSP strings match the expected output in the task brief exactly.
- Only the `noscript` link block was removed; the font itself remains self-hosted via `@fontsource-variable/inter` in `src/shared/styles/index.css`.

## Issues or concerns

None.
