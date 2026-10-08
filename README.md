# Quizlab Reader

<p align="center">
  A local-first desktop workspace for reading PDFs side by side with AI assistants.
</p>

<p align="center">
  <a href="README_TR.md">Türkçe</a>
  &nbsp;•&nbsp;
  <a href="https://github.com/ozymandias-get/quizlab/releases">Releases</a>
  &nbsp;•&nbsp;
  <a href="CONTRIBUTING.md">Contributing</a>
  &nbsp;•&nbsp;
  <a href="SECURITY.md">Security</a>
  &nbsp;•&nbsp;
  <a href="docs/ARCHITECTURE.md">Architecture</a>
  &nbsp;•&nbsp;
  <a href="docs/ROADMAP.md">Roadmap</a>
  <br>
  <img alt="Version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json&query=%24.version&label=version&color=blue">
</p>

---

## Overview

Quizlab Reader keeps a PDF reader and a set of AI assistants in one window. The
left panel is a multi-tab PDF workspace; the right panel holds tabbed AI
sessions, each hosted in a main-owned `WebContentsView` with a persistent
Chromium session partition. Selected text, page images and cropped screenshots are collected in a
floating send composer and delivered into the active AI tab through DOM
automation, so you never have to leave the document you are reading.

It is built for people who read papers, lecture notes and textbooks and want to
ask an AI about them. The app bundles no analytics and never uploads your
documents: everything it writes stays under its own user-data folder on your
machine. Network traffic only happens where you point it — the AI sites you
open, the model providers you configure, the localhost cookie bridge, and a
GitHub Releases lookup for the update notifier.

## Screenshots

**Workspace home** — every registered model and site in one launchpad, next to
the PDF panel and the tool hub:

![Workspace home with AI models, the PDF panel and the tool hub](docs/images/workspace-home-ai-models.png)

**Reading and sending** — a PDF page on the left, ChatGPT on the right, and the
send composer with quick prompts ready:

![PDF page next to ChatGPT, with the send composer and quick prompts](docs/images/pdf-chatgpt-send-composer.png)

**Focus mode** — the same document expanded to full width, without the AI panel:

![Focus mode showing the PDF at full width](docs/images/pdf-focus-mode.png)

**Settings** — the settings modal groups its tabs into AI & Workspace,
Automation & Integrations, Interface & Appearance, and System & Diagnostics.

Prompts — quick commands and the prompt library:

![Settings - Prompts tab with quick commands and prompt library](docs/images/settings-prompts.png)

Models — enable, reorder and pin the models you use, or add your own:

![Settings - Models tab with per-model toggles](docs/images/settings-models.png)

About — version, update check, Windows right-click menu, cache cleaning and
diagnostics:

![Settings - About tab with version, updates, shell integration and cache](docs/images/settings-about.png)

## Features

- **Multi-tab PDF workspace** — open, rename and close documents, search, zoom,
  page navigation, reading-progress history, drag and drop, plus a Google Drive
  tab. `Ctrl/Cmd+O` opens a file, `Ctrl/Cmd+F` focuses search.
- **Split-screen layout** — a draggable divider sets the PDF/AI ratio, and a
  focus mode expands either side to full width.
- **Tabbed AI sessions** — ChatGPT, Gemini, AI Studio, YouTube, DeepSeek, Qwen,
  Claude, Kimi and M365 Copilot are registered out of the box, and custom sites
  can be added. Each site runs in its own persistent session, so logins survive
  restarts. An `API Chat` tab provides a native, renderer-drawn chat surface.
  Gemini, AI Studio and YouTube are only listed while their Google session is
  enabled in **Settings → Google AI Web Session**.
- **Send composer** — selected text, a whole page as an image, a selection
  rectangle, or a cropped screenshot are queued and then delivered in order.
  Auto Send is a global preference: with it off, the app only stages content and
  you press send on the site yourself.
- **Quick prompts** — eight built-in presets (explain, summarize, quiz,
  flashcard, terms, mechanism, clinical, review) that prepend a prompt to the
  outgoing message; labels and prompt text are user-editable.
- **Magic Picker** — pick a chat input and send button on any AI site with the
  mouse instead of writing CSS. Selectors are stored per hostname and
  self-heal: when a saved selector breaks, the runtime recovers a replacement
  and promotes it after the pipeline actually succeeds, subject to confidence
  and flapping checks.
- **Direct API chat** — bring your own API key and talk to models over an
  OpenAI-compatible `/chat/completions` and `/models` endpoint. Provider
  templates ship for OpenAI, Anthropic, Google and NVIDIA, and `custom` covers
  any compatible gateway. Requests are made from the main process with SSRF
  validation and DNS pinning.
- **Google AI web session** — Gemini, AI Studio and YouTube share one Google
  sign-in held in a dedicated session partition, with periodic health checks
  and encrypted export/import. A bundled Chrome extension can hand over existing
  Google cookies over a localhost bridge.
- **Appearance** — animated or solid backgrounds, glass scaling, selection
  colour, accent colour, and a configurable hub/dock for the tools you actually
  use.
- **Language** — English and Turkish, selectable on first run and changeable in
  settings. 19 per-domain JSON bundles per language.
- **Storage and cache management** — measured cache totals, a scheduled cleanup
  routine and a warning toast at 80% of the 500 MB budget.
- **Update notifier** — checks the GitHub Releases API about five seconds after
  start, compares semver and offers a link to the release page. It never
  downloads or installs anything.
- **Guided tours** — five built-in tours (general, PDF, AI, settings, Magic
  Picker) plus a Usage Guide page in settings.
- **Windows shell integration** — an optional "Open with QuizLab" entry in the
  Explorer right-click menu for `.pdf` files, without taking over your default
  PDF handler.

## Tech Stack

| Area             | Choice                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Desktop runtime  | Electron 42                                                                        |
| UI               | React 19, no router (custom state-driven workspace)                                |
| Language         | TypeScript 5.9                                                                     |
| Build            | Vite 8 (renderer), `tsc` + esbuild (main/preload), electron-builder (packaging)    |
| PDF engine       | `pdfjs-dist@6.4.299` with QuizLab's own native viewer, worker `pdf.worker.min.mjs` |
| Styling          | Tailwind CSS 4 (`@theme` tokens), plus a small number of CSS modules               |
| State            | Zustand 5 for cross-component state, TanStack React Query 5 for IPC-backed reads   |
| UI primitives    | Radix UI, Headless UI, shadcn/ui, Lucide icons                                     |
| Motion / effects | Motion, tsParticles, Inter Variable (Fontsource)                                   |
| i18n             | i18next + react-i18next                                                            |
| Tests            | Vitest 4 + Testing Library                                                         |
| Lint / format    | ESLint 10, Prettier, Stylelint, cspell, dependency-cruiser                         |
| Security tooling | Electronegativity, Semgrep, `npm audit`                                            |
| Packaging        | electron-builder 26 — NSIS (Windows), dmg/zip (macOS), AppImage/deb (Linux)        |

## Requirements

**To run the app**

- Windows 10/11 (x64) — the published installer is a per-user NSIS package. The
  Explorer right-click entry and the Chrome extension bridge are Windows-only.
- macOS — `dmg`/`zip` targets are configured, but the release workflow does not
  build macOS; produce it locally with `npm run build:mac`.
- Linux — AppImage and `deb` are built in CI.
- A network connection is required for AI features. Nothing else is needed to
  read PDFs.

**To build from source**

- Node.js `20.19+`, `22.12+` or `24+` (CI uses 24; Vite and Vitest publish
  `engines` ranges that exclude some intermediate releases)
- npm — the lockfile is `package-lock.json` and CI uses `npm ci`
- Git
- A Google account, only if you want the Google AI web session
- API keys, only if you want the direct API chat
- Google Chrome, only if you want the session-bridge extension

## Installation

Download the installer for your platform from
[Releases](https://github.com/ozymandias-get/quizlab/releases).

| Platform | Artifact                                                     |
| -------- | ------------------------------------------------------------ |
| Windows  | `QuizLab-Setup-<version>-x64.exe` — NSIS, per-user, no admin |
| Linux    | `.AppImage` (run directly) or `.deb` (install with `dpkg`)   |
| macOS    | Not built by CI — run `npm run build:mac` locally            |

The Windows installer is unsigned, so SmartScreen will warn on first run. It
installs per user, never requests elevation, and leaves `%AppData%\Quizlab Reader`
in place on uninstall. See [docs/windows-installer.md](docs/windows-installer.md)
for the full install story, including the Explorer context-menu entry and
code-signing readiness.

## Configuration

Almost everything is configured in the app. There is no config file to edit and
no `.env` loader: the Electron main process reads `process.env` directly, so
variables must be exported in the shell that launches it. `.env.example`
documents the full list with defaults; the ones that matter in development are:

| Variable                        | Effect                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| `APP_RENDERER_URL`              | Dev-server URL the main window loads (default `http://localhost:5173`) |
| `APP_OPEN_DEVTOOLS=1`           | Open DevTools on startup                                               |
| `QUIZLAB_PROFILE`               | Suffix for the user-data directory (see below)                         |
| `QUIZLAB_USER_DATA_DIR`         | Absolute path override for user data                                   |
| `QUIZLAB_DISABLE_GPU=1`         | Disable hardware acceleration                                          |
| `QUIZLAB_EXTENSION_BRIDGE_PORT` | Localhost port for the Chrome cookie bridge (default `51999`)          |
| `GEMINI_WEB_*`                  | Google session health-check intervals and timeouts                     |

Using a `QUIZLAB_PROFILE` other than `stable` also disables the single-instance
lock, which is useful for running two profiles side by side.

**Where data lives.** The app relocates its user-data directory before anything
else runs, so profiles never mix:

| Profile  | Directory                                                          |
| -------- | ------------------------------------------------------------------ |
| `stable` | `<appData>/Quizlab Reader` — `%AppData%\Quizlab Reader` on Windows |
| `dev`    | `<appData>/Quizlab Reader Dev` (unpackaged runs)                   |
| other    | `<appData>/Quizlab Reader <profile>`                               |
| override | `QUIZLAB_USER_DATA_DIR`                                            |

Inside it: JSON configuration files, `Partitions/<name>/` Chromium session and
cache data, `logs/`, and the installed copy of the Chrome extension. There is no
database.

**API keys** are stored in `api_chat_config.json` (mode `0600`) encrypted with
Electron `safeStorage` where the OS keychain is available, and otherwise with
AES-256-GCM under a key derived from a machine fingerprint via PBKDF2. The
fallback obfuscates the value at rest; it is not a substitute for a keychain.

## Usage

1. Launch the app. On first run, pick a language; the general tour then starts.
2. Drop a PDF on the left panel, or press `Ctrl/Cmd+O`. A tab opens per document.
3. Open an AI site from the home panel on the right, or add your own under
   **Settings → Sites**. Sign in once; the session is remembered.
4. Select text in the PDF, or right-click the page for _Add This Page's Text to
   AI_ / _Send Page as Image to AI_ / _Add Area Selection as Image to AI_.
5. Content lands in the send composer. Pick a quick prompt if you want one, then
   press **Send to AI**.
6. Turn on **Auto Send** in the composer if you would rather not press send on
   the site each time.
7. If a site's layout changes, run **Magic Picker** on that tab and re-pick the
   input. Until you do, the app refuses to send rather than typing into the
   wrong element.

## Architecture

```
Renderer (src/)
  React workspace: PDF panel, AI host placeholders, send composer, settings
  AiContentController: remote commands and generation-filtered state
  hooks + TanStack Query over window.electronAPI
        |  typed invoke (channel -> request/result types)
        v
Preload (electron/preload/)
  contextBridge: one explicit method per allowed channel, nothing else
        |  ipcRenderer.invoke
        v
Main (electron/)
  ipcMain handlers, trusted-sender check on every call
  feature modules: ai-view, ai, automation, gemini-web-session, native-messaging,
                   pdf, screenshot, settings, shell-open
  core: config store, encryption, CSP, logging, cache accounting, updater
        |
        +--> local-pdf:// protocol  -> local PDF files (allowlist, byte ranges)
        +--> AiWebContentsViewManager -> WebContentsView / provider partitions
        |                            remote commands and event bridge
        +--> remoteContentSecurity -> navigation, popups, TLS, clipboard
        +--> permissionPolicy      -> partition + registered origin permissions
        +--> model provider HTTP   -> direct API chat (SSRF-validated)
        +--> GitHub Releases API   -> update notifier
```

Shared contracts live in `shared/` and are imported by both sides through the
`@shared-core/*` alias: channel names (`shared/constants/ipcChannels.ts`), the
request/result map (`shared/types/ipcContract.ts`) and shared domain types.

Two design points worth knowing before changing things: navigation is state,
not routing — there is no router, and the PDF tabs (Zustand) and AI tabs
(`useState` behind split contexts) are independent; and web-session automation
uses `AiContentController` and typed IPC to run main-generated scripts in the
managed remote view. API Chat uses provider HTTP requests.

Host ownership and content lifecycle are independent. Unmounting a host
placeholder detaches geometry; focus mode reuses the same generation, URL and
page state without reloading. Tab close, LRU eviction and sleep destroy the
managed view; wake creates a new generation and waits for its first load.
Host bounds are coalesced and native views hide while dialogs or overlays cover them.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for layer boundaries, the
import rules enforced by dependency-cruiser, and the selector self-healing flow.

## Project Structure

```
electron/            Main process
  app/               Entry point, window creation, session/CSP/security, IPC wiring
  core/              Config store, encryption, logging, cache, updater, typed IPC
  features/          Feature handlers (ai, automation, gemini-web-session,
                     native-messaging, pdf, screenshot, settings, shell-open)
  preload/           contextBridge surface
  __tests__/         Main-process tests
shared/              Cross-process contracts: IPC channels, types, constants
src/                 Renderer
  app/               Shell, providers, app effects, floating composer
  features/          ai, automation, onboarding, pdf, screenshot, settings, tutorial
  platform/electron/ Adapters between the app and window.electronAPI
  shared/            Shared UI, hooks, i18n, styles, stores, lib
  __tests__/         Renderer tests
extensions/          Chrome extension for the Google session bridge
installer/           NSIS custom installer logic
scripts/             Dev and build automation
docs/                Architecture, coding standard, terminology, roadmap
```

## Development

```bash
git clone https://github.com/ozymandias-get/quizlab.git
cd quizlab
npm install
npm run dev          # Vite dev server + Electron
```

`npm run dev` builds the main process, starts Vite on port 5173 (reusing it if
this app is already being served there), then launches Electron. It filters known
Chromium noise from Electron's stderr but prints everything else.

Other entry points:

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev:web`      | Vite only; the renderer runs in a browser against a stubbed API    |
| `npm run dev:electron` | Backend build, then Electron against an already-running dev server |

Quality gates — all of these run in CI:

```bash
npm run typecheck     # tsc -b (app, node, node.test projects)
npm run lint          # ESLint, zero warnings tolerated
npm run format:check  # Prettier
npm test              # Vitest, full suite
npm run test:coverage # Vitest with coverage thresholds
```

Analysis tooling:

```bash
npm run analyze:architecture  # dependency-cruiser import rules
npm run analyze:circular      # madge
npm run analyze:duplicates    # jscpd
npm run analyze:deadcode      # knip
npm run analyze:types         # type-coverage
npm run analyze:css           # stylelint
npm run analyze:security      # Semgrep + npm audit + Electronegativity
npm run analyze:all           # all of the above plus the bundle report
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
and are checked by commitlint through a Husky hook.

## Testing

Vitest runs both processes: `src/__tests__/` in jsdom and `electron/__tests__/`
in Node, selected by `environmentMatchGlobs` in `vitest.config.mts`. The current
suite is 309 files / 3106 tests.

Coverage thresholds are enforced per scope in `vitest.config.mts` — globally
50% lines, with separate floors for `electron/features/gemini-web-session`,
`electron/features/automation`, `electron/core`, `electron/features/ai/apiChatHandlers`
and the PDF feature. `npm run analyze:mutation` runs Stryker.

## Build

```bash
npm run build         # renderer + main + preload into dist/
npm run build:web     # renderer only, for browser preview
npm run build:win     # then electron-builder --win  -> release/*.exe
npm run build:mac     # then electron-builder --mac  -> release/*.dmg, *.zip
npm run build:linux   # then electron-builder --linux -> release/*.AppImage, *.deb
```

Packaging output goes to `release/`. Only `dist/**` is packed into `app.asar`;
the icons and the Chrome extension are shipped as extra resources. Windows
builds are unsigned by default — see
[docs/windows-installer.md](docs/windows-installer.md) for the signing variables
if you want to change that.

## CI/CD

`.github/workflows/build.yml` has three jobs:

1. **quality** (ubuntu-latest, on push and pull request) — repository hygiene,
   version consistency, ESLint, Prettier, CSS lint, typecheck, dependency-cruiser,
   tests with coverage, type-coverage guard, duplicate and circular dependency
   detection, Semgrep, production dependency audit, Electronegativity. File size
   and spell checks run but are non-blocking.
2. **build** (windows-latest and ubuntu-22.04, on tags) — produces the Windows
   and Linux installers and uploads them as artifacts.
3. **release** (on tags) — attaches the artifacts to a GitHub Release with
   generated notes.

Tags must match `package.json`'s version; `npm run ci:check-version` enforces
this and also guards the version badge in both READMEs.

## Security and Privacy

Verified properties of this build:

- **Isolated renderer** — `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, and `webviewTag: false`. Main creates
  remote `WebContentsView` instances with secure preferences and no Node access.
- **Main-owned remote views** — `AiViewTarget` resolves sources and partitions
  from main-process registries. Typed IPC accepts bounded view ids, host tokens,
  bounds and commands; renderer requests cannot supply partitions, preloads,
  WebContents ids or security preferences.
- **Remote content policy** — main-frame navigation requires HTTPS; popups are
  denied with validated external handoff. `permissionPolicy` checks the partition
  and registered origin, TLS certificate errors are rejected, and clipboard
  guards preserve trusted user/app paste while blocking programmatic access.
- **Narrow preload bridge** — one explicit method per allowed IPC channel; the
  renderer has no direct Node access.
- **Sender validation** — every IPC handler requires the main frame of the main
  window, so subframes and remote views cannot invoke them.
- **No analytics** — no telemetry or crash-reporting SDK is bundled, and nothing
  is sent anywhere automatically. Crash reports and logs are written to
  `logs/` inside the user-data folder and stay there. Outbound requests are
  limited to the sites you open, the providers you configure, the localhost
  cookie bridge, and the GitHub release lookup.
- **PDF delivery** — `local-pdf://` resolves opaque ids from an in-process
  registry, requires the file to be on the allowlist, validates the request
  origin, and serves byte ranges.
- **Strict CSP** — a nonce-based policy is injected into the main frame; the
  document also declares a `frame-src` allowlist.
- **Outbound hardening** — API chat URLs must be HTTPS (or localhost), are
  checked against private and reserved address space, pinned to a resolved IP
  with TLS SNI preserved, and the `Authorization` header is dropped across
  redirects.
- **Bridge authentication** — the cookie bridge requires an exact extension
  origin, HMAC-SHA256 over the request body with a per-run secret compared in
  constant time, a 512 KB body cap, and a cookie-domain allowlist.
- **Electronegativity and Semgrep** run in CI.

What this does **not** give you: live AI session cookies are stored by Chromium
in its own partition store and are not encrypted by the application; the
machine-derived AES key is obfuscation, not protection against someone with
access to your machine profile; and builds are unsigned.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branch strategy, the pull
request checklist, and the coding rules in
[docs/CODING_STANDARD.md](docs/CODING_STANDARD.md). Please read
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) as well.

## License

[MIT](LICENSE) © Quizlab Reader contributors.
