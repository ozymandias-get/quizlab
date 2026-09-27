# Security Policy

## Supported Versions

Security updates go to the current major line only. Older lines do not receive
backported fixes.

| Version  | Supported |
| -------- | --------- |
| **6.x**  | Yes       |
| 5.x, 4.x | No        |
| ≤ 3.x    | No        |

The current major is whatever `package.json` declares — see
[Releases](https://github.com/ozymandias-get/quizlab/releases) for what is
published.

## Reporting a Vulnerability

Do **not** open a public GitHub issue for a security vulnerability.

Report it through GitHub Security Advisories:

- https://github.com/ozymandias-get/quizlab/security/advisories/new

### What to Include

- Description — a clear explanation of the issue
- Impact — what an attacker could achieve
- Steps to reproduce
- Affected versions
- Suggested mitigation (optional)
- A minimal proof of concept, if you have one

### Response Timeline

| Phase              | Timeline                  |
| ------------------ | ------------------------- |
| Acknowledgment     | Within 48 hours           |
| Initial Assessment | Within 5 business days    |
| Fix Development    | Depends on severity       |
| Public Disclosure  | After the fix is released |

## Hardening in This Repository

The Electron layer enforces the following, and CI fails the build if it is
regressed:

- **Window isolation** — `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true` in
  `electron/app/window/windows.ts`. On `will-attach-webview`,
  `electron/app/window/security.ts` strips renderer-supplied preloads and
  forces the same preferences on every `<webview>`.
- **Narrow preload bridge** — `electron/preload/index.ts` exposes one explicit
  method per allowed channel through `contextBridge`; nothing else crosses.
- **IPC sender validation** — `electron/core/ipcSecurity.ts` requires both that
  the sender is the main window's web contents and that the frame is its main
  frame, so subframes and webviews cannot invoke main-process handlers.
- **Content Security Policy** — a nonce-based policy is injected into the main
  frame (`electron/core/csp.ts`); the document also declares a `frame-src`
  allowlist.
- **PDF delivery** — `local-pdf://` (`electron/features/pdf/pdfProtocol.ts`)
  resolves opaque in-process ids only, requires the file to be on a persistent
  allowlist, validates the request origin, and serves byte ranges. It never
  accepts a raw filesystem path from the renderer.
- **Outbound request hardening** — API chat endpoints must be HTTPS (or
  localhost), are rejected for private and reserved address space, are pinned to
  the resolved IP with TLS SNI preserved
  (`electron/features/ai/apiChatHandlers/ssrf.ts`), and drop the
  `Authorization` header across redirects.
- **Extension bridge** — a loopback HTTP server that requires an exact
  extension origin, verifies an HMAC-SHA256 signature over the request body in
  constant time, caps the body at 512 KB, and only accepts cookies for
  `.google.com` and `.youtube.com`
  (`electron/features/native-messaging/`).
- **Secret storage** — API keys are written with mode `0600` and encrypted with
  Electron `safeStorage` where the OS keychain is available, falling back to
  AES-256-GCM under a PBKDF2-derived machine key. The fallback obfuscates the
  value at rest; it is not a substitute for a keychain.
- **Automated scanning** — Electronegativity, Semgrep, `npm audit` and
  dependency-cruiser all run in the `quality` CI job. The Electronegativity
  baseline (12 MEDIUM, 1 LOW) is documented in
  `scripts/check-electron-security.mjs`; the gate fails on HIGH/CRITICAL.
- **Dependency exceptions** — accepted advisories live in
  `security/audit-exceptions.json` with an id, installed version and expiry, and
  the checker fails when an exception no longer justifies itself.

## Known Limits

- Live AI web session cookies are stored by Chromium in its own partition
  directory under the user-data folder. The application does not encrypt them.
- Windows installers are unsigned
  (`signExecutable: false`, `forceCodeSigning: false`).
- The machine-derived AES fallback key is derived from publicly readable machine
  identifiers, so it protects against casual inspection, not against someone
  with access to your user profile.
- The Google AI web session uses ordinary web sign-in and browser-profile
  persistence, not an official API. Google's own terms apply to that use.

## For Contributors

- Never commit secrets or credentials.
- Keep `shared/` (`@shared-core/*`) platform-agnostic — no Electron, no DOM.
- Keep Node.js APIs out of the renderer; go through the preload bridge.
- Start every IPC handler with `requireTrustedIpcSender(event)` and validate
  payloads.
- Prefer `shared/constants/ipcChannels.ts` + `shared/types/ipcContract.ts` +
  `shared/types/electronApi.ts` as the single place a new channel is declared.

## Disclosure Policy

1. We confirm receipt and begin investigating.
2. We develop and test a fix.
3. We release the fix in a new version.
4. We disclose the issue publicly, with credit if you want it.

---

Last reviewed: 2026-09-28
