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

## Chrome Native Messaging bridge

The Google-session bridge extension is registered via a single HKCU key:

```
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quizlab.reader
```

Two writers, one key (last writer wins):

1. **Installer** (`installer/installer.nsh` → `customInstall`): writes the
   manifest next to the installed app and points the key at it. The write is
   guarded — if the manifest cannot be created, the registry key is left
   alone instead of pointing Chrome at a missing file.
2. **App runtime** (Settings → session bridge → `NativeMessagingInstaller`):
   copies the extension to `%AppData%` and re-points the same key at a
   UTF-8 manifest it generates with Node (also used to repair a broken
   registration, e.g. non-ASCII install paths).

**Uninstall** deletes the registry key (whichever side wrote it) plus the
installer-owned manifest copy. The `%AppData%` bridge copy is intentionally
kept (user-data preservation); it is inert without the key and is re-used
by a later reinstall.

The allowed origin (`chrome-extension://follalbajmbjmkejipfikekdiodbkggp/`)
is derived from the extension key pinned in
`extensions/quizlab-session-extension/manifest.json`
(see `electron/features/native-messaging/nativeMessagingOrigin.ts`).
If the extension key ever rotates, `installer/installer.nsh` must be
updated with it.

Known limitation: NSIS writes the manifest in the system ANSI codepage, so
an install path with non-ASCII characters (e.g. a username like
`Umut Üstün`) produces a manifest Chrome cannot parse as UTF-8. File
extraction, shortcuts and the registry are fully Unicode-safe — only the
out-of-box bridge manifest is affected, and Settings → session bridge →
"install extension" rewrites it as proper UTF-8. Deliberately not worked
around with PowerShell/encoding hacks: installer reliability first.

## Explorer right-click menu ("QuizLab ile Aç")

The installer adds a per-user Explorer context-menu entry for `.pdf`
files — right-click → `QuizLab ile Aç` / `Open with QuizLab`. On
Windows 11 the entry appears in the **top-level (sade) menu** via a
minimal `IExplorerCommand` COM extension; on Windows 10 (and under
"Show more options" on Windows 11) the same verb works as a classic
menu entry.

Classic verb (always registered):

```
HKCU\Software\Classes\SystemFileAssociations\.pdf\shell\QuizlabReader
  (Default) = "<label>"
  Icon      = "$INSTDIR\Quizlab Reader.exe,0"
  command   = '"$INSTDIR\Quizlab Reader.exe" "%1"'
```

Top-level menu (Windows 11, registered when the DLL is packaged):

```
HKCU\Software\Classes\CLSID\{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}
  (Default) = "QuizLab Shell Extension"
  InprocServer32
    (Default)     = "$INSTDIR\resources\shell\QuizLabShellExt.dll"
    ThreadingModel = "Apartment"
HKCU\...\shell\QuizlabReader
  ExplorerCommandHandler = "{C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}"
```

Rules:

- **No default-handler hijacking.** Double-click still opens the user's
  previous PDF app. Only the extra right-click entry is added.
- **Per-user (HKCU), no UAC** — same install model as the rest of the
  installer. COM registration is manual (registry writes, no `regsvr32`).
- **CLSID is identity-locked** (`{C7D9E4A1-...}`): it is hardcoded in
  `shell-ext/src/lib.rs`, `installer/installer.nsh` and
  `electron/features/shell-open/shellIntegrationManager.ts`. Never change
  it — old installs would be left with a dead entry.
- **The DLL is intentionally dumb** (see `shell-ext/`): it only returns a
  localized title/icon and launches the exe next to it with the selected
  PDF paths. No network, no disk writes, no settings reads. `Invoke` is
  wrapped in `catch_unwind` so a bug surfaces as `E_FAIL`, never as an
  Explorer crash. Kill switch: Settings → About → right-click menu →
  remove.
- **Label follows the UI language at click time** (`GetUserDefaultUI-
Language`: Turkish → `QuizLab ile Aç`, otherwise `Open with QuizLab`).
  The classic verb label follows the installer language and can be
  relabeled from Settings (repair).
- **Shell → app flow:** Explorer (or the DLL) launches
  `"Quizlab Reader.exe" "%1"`. The main process parses `process.argv`
  (`parseShellPdfPaths`), forwards each path to the running window via
  `second-instance` (or queues it when the window isn't ready yet), and
  the renderer opens every PDF in a new tab (`openPdfInTab`) — the
  split-screen / AI panel is untouched.
- **Build:** `npm run build:shell-ext` compiles `shell-ext/` (Rust) and
  copies the DLL to `resources/shell/` (git-ignored, packaged via
  `extraResources`). It no-ops off Windows. CI installs the Rust
  toolchain on the Windows job. `cargo test` in `shell-ext/` covers
  command-line building and extension checks.
- **Upgrade** rewrites the keys idempotently (no duplicate entries).
  **Uninstall** deletes the `QuizlabReader` verb key and the CLSID key.
- Out of scope on purpose: no default `.pdf` association, no custom URL
  protocol.

## Package contents

- `files: ["dist/**/*"]` — only the built app goes into `app.asar`.
- `extraResources`: `resources/icon.{ico,png}` (window/taskbar icon resolved
  from `<resources>/resources/` at runtime) and the `extensions/` bridge
  source. Tight filters keep stray dev files out of the installer.

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
