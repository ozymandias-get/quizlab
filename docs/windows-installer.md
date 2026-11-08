# Windows Installer (QuizLab Reader)

This document describes the Windows install story: identity, install mode,
artifact naming, Native Messaging registration, and code-signing readiness.

## Identity lock (do not rename)

Existing installations are keyed off these values. Renaming any of them
makes Windows treat the next release as a _second_ application (duplicate
"Installed Apps" entries, orphaned shortcuts, stale registry keys).

| Field          | Value                                    | Source                         |
| -------------- | ---------------------------------------- | ------------------------------ |
| `appId`        | `com.quizlab.reader`                     | `package.json` → `build.appId` |
| `productName`  | `Quizlab Reader`                         | `package.json` → `build`       |
| executable     | `Quizlab Reader.exe`                     | `build.win.executableName`     |
| default folder | `%LocalAppData%\Programs\Quizlab Reader` | NSIS per-user default          |

Cosmetic casing fixes (e.g. `QuizLab.exe`) were deliberately **rejected**:
the upgrade cost for existing users outweighs the cosmetic gain.

## Install mode: per-user

- `nsis.perMachine: false`, `allowElevation: false`,
  `win.requestedExecutionLevel: asInvoker`.
- No UAC prompt. "Launch QuizLab" on the finish page starts the app in the
  normal user context (additionally enforced by electron-builder, which
  launches the app via `ExecShellAsUser`).
- Users may change the install folder
  (`allowToChangeInstallationDirectory: true`); Unicode paths are supported
  by the Unicode NSIS build electron-builder ships.

## Installer artifact

```
QuizLab-Setup-<version>-x64.exe   (NSIS, x64, per-user)
```

- Built with `npm run build:win` (renderer + backend + `electron-builder --win`).
- `latest.yml` next to the `.exe` is emitted by electron-builder; the app's
  in-app updater is a GitHub-Releases notifier (see
  `electron/core/updater.ts`) and does not consume it — the file is kept for
  CI/release-tooling compatibility.

## Shortcuts and Apps & Features

- Start Menu: `Quizlab Reader` (`createStartMenuShortcut`, `shortcutName`).
- Desktop: `Quizlab Reader` (`createDesktopShortcut: true`, existing UX kept).
- electron-builder keys shortcuts and the uninstall registry entry off the
  stable `appId`, so upgrades/reinstalls never duplicate them.
- "Installed Apps" shows product name, version and icon from the build
  metadata; no `Electron` / `electron-builder` strings are user-visible.

## Upgrade / reinstall / uninstall behavior

- **Same-version reinstall**: in-place overwrite, no duplicates.
- **Upgrade (vN → vN+1)**: in-place upgrade. If the app is running,
  electron-builder's assisted installer detects the lock and asks the user
  to close the app first — there is intentionally no silent process kill,
  so open work is never destroyed.
- **Downgrade**: not blocked by a custom version gate (custom gates are a
  reliability risk); installing an older build overwrites in place under the
  same registry identity, so no duplicate entries appear.
- **Uninstall**: removes binaries, installer-owned shortcuts and the
  installer registry entries. `deleteAppDataOnUninstall: false`, so
  `%AppData%\Quizlab Reader` (settings, caches, bridge info) is preserved.
  User documents are never touched.

## Chrome session bridge

The bridge is a loopback HTTP server (`127.0.0.1:51999–52009`) plus a Chrome
extension that is distributed and installed separately. It does **not** use
Chrome Native Messaging:

- No `NativeMessagingHosts` registry key is written by the installer or by
  the app. Older installs that still carry the legacy
  `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader` key
  have it removed on uninstall.
- The app does **not** bundle or copy the extension. Settings → Site Sessions
  links to the extension release; the user unzips it and loads it unpacked in
  `chrome://extensions`.
- The user pairs the extension by copying the code from Settings → Site
  Sessions and pasting it into the extension popup. The code is the HMAC
  secret; it is stored in the extension's `chrome.storage.local` and is never
  returned by the HTTP health endpoint or written into the extension package.
- The app keeps its own copy of the secret in
  `%AppData%\Quizlab Reader\bridge-secret.json`.

The allowed HTTP origin
(`chrome-extension://follalbajmbjmkejipfikekdiodbkggp`) is the id derived from
the extension key pinned in
`extensions/quizlab-session-extension/manifest.json`. The id is pinned in
`shared/constants/extensionRelease.ts` and checked against the manifest by the
extension contract test. If the extension key rotates, both must be updated.

## Explorer right-click menu ("QuizLab ile Aç")

The installer adds a per-user Explorer context-menu entry for `.pdf`
files — right-click → `QuizLab ile Aç` / `Open with QuizLab`. On
Windows 10 it appears directly; on Windows 11 it lives under
**"Show more options"** — that is the expected behavior for an
unpackaged (NSIS, no MSIX identity) app.

Registry verb (the only mechanism; always registered):

```
HKCU\Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader
  (Default) = "<label>"
  Icon      = "$INSTDIR\Quizlab Reader.exe,0"
  command   = '"$INSTDIR\Quizlab Reader.exe" "%1"'
```

> Windows 11 top-level note: promoting this entry to the new (sade)
> top-level menu requires **package identity** (MSIX packaging or a
> Sparse Package with `windows.fileExplorerContextMenus`, see "Grant
> package identity to unpackaged apps"). That is not implemented, so
> "Show more options" is the correct/expected home. Do not "fix" this by
> duplicating verbs — one verb only.

Rules:

- **No default-handler hijacking.** Double-click still opens the user's
  previous PDF app. Only the extra right-click entry is added.
- **Per-user (HKCU), no UAC** — same install model as the rest of the
  installer.
- **Label follows the installer language**, and the app can relabel it
  later from Settings ("Onar / Dili Güncelle"), which writes the label
  from the current UI locale.
- **Multi-select** starts one process per selected file (Explorer
  behavior for a plain verb). Each instance forwards its path to the
  running window via `second-instance`, so every selected PDF still
  opens in its own tab — see "Shell → app flow" below.
- **Shell → app flow:** Explorer launches
  `"Quizlab Reader.exe" "%1"`. The main process parses `process.argv`
  (`parseShellPdfPaths`), forwards each path to the running window via
  `second-instance` (or queues it when the window isn't ready yet), and
  the renderer opens every PDF in a new tab (`openPdfInTab`) — the
  split-screen / AI panel is untouched.
- **Runtime manager:** `electron/features/shell-open/shellIntegrationManager.ts`
  (status / install / remove) and the Settings → About card. It only
  writes and deletes the verb key above.
- **Upgrade** rewrites the keys idempotently (no duplicate entries).
  **Uninstall** deletes the `QuizlabReader` verb key.
- Out of scope on purpose: no default `.pdf` association, no custom URL
  protocol, no COM shell extension.

### Removed: `IExplorerCommand` COM extension (≤ v6.0.4)

Up to v6.0.4 the build also compiled `shell-ext/` (a Rust
`IExplorerCommand` in-proc DLL) and registered it under
`HKCU\...\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}` as the verb's
`ExplorerCommandHandler`. It was removed because:

- it did **not** achieve its goal — an `ExplorerCommandHandler` alone
  does not promote the entry to the Windows 11 top-level menu (package
  identity is required, see the note above);
- its only remaining benefit was starting a single process for a
  multi-selection, which the plain verb already achieves functionally
  through `second-instance`;
- it forced a Rust toolchain on every Windows build.

The PDF-only filter and the localized title are both covered by the
plain verb (it lives under `SystemFileAssociations\.pdf`, and Settings
writes the label from the current locale).

The CLSID is **not** reused. Both the installer (`customUnInstall`) and
the runtime `removeShellIntegration()` still delete that key so
machines upgraded from ≤ v6.0.4 do not keep a live handler pointing at a
DLL that is no longer shipped.

## Package contents

- `files: ["dist/**/*"]` — only the built app goes into `app.asar`.
- `extraResources`: `resources/icon.{ico,png}` (window/taskbar icon resolved
  from `<resources>/resources/` at runtime). The session extension is not
  bundled; it is its own release artifact.

## Code signing readiness

Local/CI builds are **unsigned** (`signExecutable: false`,
`forceCodeSigning: false`) so nothing breaks without a certificate.
No SmartScreen/Defender bypasses exist or will be added — the correct fix
for SmartScreen reputation is a real certificate, not a hack.

To ship signed production builds, no config change is needed — provide secrets:

| Secret / variable             | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `CSC_LINK`                    | pfx/.p12 certificate (path or base64) |
| `CSC_KEY_PASSWORD`            | certificate password                  |
| `CSC_LINK` alt `WIN_CSC_LINK` | Windows-only cert override            |

electron-builder picks these up automatically (`win.signtoolOptions` only
if a custom timestamp/digest is ever required). Recommended CI step: export
the secrets in the Windows `Build and Package` job of
`.github/workflows/build.yml`; unsigned PR/local builds keep working.
EV-cert USB tokens need a different CI approach (token-local signing host)
and are out of scope until a certificate is procured.

## Verification checklist (per release)

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build:win` → `release/QuizLab-Setup-<version>-x64.exe`
3. Confirm NSIS (`Nullsoft` magic), filename, size, SHA-256.
4. Clean install → launch → Start Menu/Desktop shortcuts → Installed Apps →
   uninstall → reinstall.
