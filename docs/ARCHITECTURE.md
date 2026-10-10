# Quizlab Reader — Architecture

This document describes how the codebase is actually put together: components,
process boundaries, the PDF.js runtime, the AI session surface, the build, and
the rules that changes must respect. Every claim cites the file it comes from.

It is the structural half of a pair — [CODING_STANDARD.md](CODING_STANDARD.md)
is the stylistic half (naming, import order, error handling, test conventions).
History is kept elsewhere: the completed PDF.js migration is recorded in
[pdfjs-migration-plan.md](pdfjs-migration-plan.md), the installer story in
[windows-installer.md](windows-installer.md). Neither is restated here.
[AGENT_HANDOFF.md](AGENT_HANDOFF.md) is the agent working memory — current
state, decisions and next step — and cites this file rather than repeating it.

---

## A. System overview

Quizlab Reader is an Electron desktop app: a multi-tab PDF workspace on the
left, tabbed AI sessions on the right, and a floating composer that moves
selected text, page images and screenshots from the document into the active AI
tab.

| Component               | Lives in                        | Responsibility                                                                                                                |
| ----------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Renderer shell          | `src/app/`                      | Composition root: `main.tsx` bootstrap, `App.tsx`, providers, effects, the floating send composer, focus overlay              |
| Renderer features       | `src/features/`                 | `ai`, `automation`, `onboarding`, `pdf`, `screenshot`, `settings` — one barrel per feature                                    |
| Renderer shared layer   | `src/shared/`                   | UI primitives, hooks, i18n, styles, Zustand stores, TanStack Query keys, `logger`                                             |
| Platform adapters       | `src/platform/electron/`        | The only renderer code that talks to `window.electronAPI`; browser fallback for `dev:web`                                     |
| Cross-process contracts | `shared/`                       | IPC channel names, the invoke/event contract, shared domain types, selector-repair policy — no Electron, no DOM               |
| Main process            | `electron/`                     | `app/` (entry, window, security, IPC wiring), `core/` (config, logging, cache, updater, IPC plumbing), `features/` (handlers) |
| Preload                 | `electron/preload/`             | `contextBridge` surface: one explicit method per allowed channel                                                              |
| PDF.js engine           | `src/features/pdf/engine/`      | React-free, DOM-free PDF.js wrapper: document, pages, rendering, worker                                                       |
| Native PDF viewer       | `src/features/pdf/native/`      | The shipped viewer: controller, canvas render, text/annotation/search layers, links, zoom                                     |
| Remote view manager     | `electron/features/ai-view/`    | Owns every `WebContentsView` the app embeds (AI sites, Google Drive panel)                                                    |
| Automation runtime      | `electron/features/automation/` | Script generators injected into managed views, Magic Picker, selector recovery                                                |

Two design points that shape everything below:

- **Navigation is state, not routing.** There is no router. PDF tabs live in a
  Zustand store (`src/features/pdf/store/usePdfTabStore.ts`); AI tabs live in
  `useState` behind split contexts (`src/app/providers/ai-context/`). The two
  are independent.
- **Remote content is main-owned.** AI sites run in `WebContentsView`s created
  by the main process. The renderer owns only a placeholder rectangle and a
  host token; it can neither name a partition nor address a `WebContents`.

---

## B. Layer architecture

### B.1 Layers

| Layer         | Path            | Alias                | Purpose                                                                 |
| ------------- | --------------- | -------------------- | ----------------------------------------------------------------------- |
| App shell     | `src/app/`      | `@app/*`             | Composition root, providers, app-level effects, composer, focus overlay |
| Features      | `src/features/` | `@features/*`        | Domain features (see `FEATURE_NAMES` below)                             |
| Platform      | `src/platform/` | `@platform/*`        | Adapters between the app and `window.electronAPI`                       |
| Shared (UI)   | `src/shared/`   | `@shared/*`, `@ui/*` | Renderer-shared UI, hooks, constants, i18n, styles, stores, lib         |
| Shared core   | `shared/`       | `@shared-core/*`     | Runtime-agnostic cross-process contracts                                |
| Electron main | `electron/`     | `@electron/*`        | Main-process entry, security, config, feature handlers                  |

`@ui/*` is an alias into the shared layer (`src/shared/ui/*`), not a layer of
its own — it exists so UI primitives get their own import-sort group.

The feature set is fixed by `FEATURE_NAMES` in `.dependency-cruiser.cjs:15`:
`ai`, `automation`, `onboarding`, `pdf`, `screenshot`, `settings`.
A new feature directory must be added there (and to `FEATURE_DIRS` in
`src/__tests__/architecture/feature-privacy-gate.test.ts`) or its cross-feature
edges are not policed.

### B.2 Alias and path policy

The same seven aliases are declared in four places and must stay in sync:

| Alias            | Path              | Declared in                                                                                        |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `@app/*`         | `src/app/*`       | `tsconfig.json:5`, `tsconfig.app.json:27`, `tsconfig.node.json:19`, `vite.aliases.mts:7`           |
| `@shared/*`      | `src/shared/*`    | same four files                                                                                    |
| `@shared-core/*` | `shared/*`        | same four files                                                                                    |
| `@electron/*`    | `electron/*`      | same four files (currently used only by `electron/__tests__/`)                                     |
| `@ui/*`          | `src/shared/ui/*` | same four files                                                                                    |
| `@features/*`    | `src/features/*`  | same four files                                                                                    |
| `@platform/*`    | `src/platform/*`  | same four files                                                                                    |
| `@src/*`         | —                 | **forbidden**: `legacySrcAliasPattern`, `eslint.config.mjs:16`, applied at `eslint.config.mjs:135` |

> Write aliases in backticks (`` `@features/*` ``) so GitHub does not render
> them as user mentions.

Import sort order is part of the alias policy: `simple-import-sort/imports`
(`eslint.config.mjs:138`) groups the file as side-effect → `node:` →
`@shared-core` → `@electron`/`@platform` → `@features` → `@app`/`@ui`/`@shared`
→ packages → relatives. The group order is the layer order written as a
linter rule.

Main-process and `shared/` files import each other **relatively**
(`../../shared/...`); `@shared-core/*` is a renderer-side spelling. This is
documented as a rule in `docs/CODING_STANDARD.md` §3 ("Import Path Politikası")
and is why `electron/` production code contains zero `@electron/` imports.

### B.3 Import Boundary Rules

**1. Feature internals are private.** Outside `src/features/<feature>/`, a
feature may be reached only through its barrel `@features/<feature>` or through
one of the five documented sub-entrypoints:

```
ai/aiViewSurface   lazy chunk — AI panel chrome + host placeholders
ai/viewState       AI tab liveness state
pdf/viewer         lazy chunk — PdfViewer + tab strip
pdf/types          type-only, zero runtime cost
screenshot/tool    lazy chunk — ScreenshotTool
```

The list is duplicated on purpose in two configs that must be kept in sync:
`PUBLIC_FEATURE_ENTRYPOINTS` in `.dependency-cruiser.cjs:7` and in
`eslint.config.mjs:41`. Everything else under a feature root (`ui/`, `model/`,
`api/`, `hooks/`, `lib/`, `store/`, `queries/`, `constants/`, `capture/`,
`text/`, `viewport/`, `interaction/`, `errors/`, …) is an implementation detail
and must be re-exported from the barrel instead.

Enforced twice, because each tool is blind where the other is not:

- **dependency-cruiser** — `app-no-feature-internals` (`.dependency-cruiser.cjs:68`)
  covers `src/app/**`, `src/shared/**` and `shared/**`; the generated
  `no-cross-feature-internals:<from>-><to>` rules
  (`.dependency-cruiser.cjs:38`, one per ordered feature pair) cover feature →
  feature. Both allow the target's `index.ts` barrel.
- **ESLint** — `featureInternalImportPattern` (`eslint.config.mjs:58`) plus the
  matching `no-restricted-syntax` selector for dynamic `import()`
  (`eslint.config.mjs:66`). The rule is declared in two flat-config blocks
  (`:256`, `:287`) because flat config replaces `no-restricted-imports` rather
  than merging it; `src/__tests__/architecture/feature-privacy-gate.test.ts`
  asserts that both blocks still carry it.

Deep imports from **tests** are allowed: the `src/**` block ignores
`src/features/**` and `src/__tests__/` (`eslint.config.mjs:257`).

**2. `src/shared` sits below `src/app`.** The order is
**App → Features → Shared**, and shared code may not reach back up:

- `shared-no-app` (`.dependency-cruiser.cjs:82`) — `^src/shared/` → `^src/app/`
  is an error.
- `sharedToAppPattern` (`eslint.config.mjs:78`) — `@app/*` is banned in
  `src/shared/**`, repeated in the `no-restricted-syntax` selector at
  `:318`.

Both are asserted for wiring, not presence, in
`src/__tests__/architecture/layer-boundaries.test.ts`.

**3. Renderer code must not import Electron.**

- `renderer-no-electron-direct` (`.dependency-cruiser.cjs:106`) — `^src/` →
  `^electron/` is an error.
- ESLint bans the bare `electron` package in `src/**` (`eslint.config.mjs:266`)
  with the message "Use the preload bridge via `@platform/electron`."

`src/platform/electron/` is the seam: `useElectron.ts` wraps
`window.electronAPI` in `useElectronQuery` / `useElectronMutation`, and
`createBrowserElectronApi.ts` supplies a browser stub for `npm run dev:web`.

**4. `shared/` stays platform-agnostic.** No Electron, no DOM globals:

- `shared-core-no-electron` (`.dependency-cruiser.cjs:94`) — `^shared/` →
  `electron` is an **error**.
- ESLint warns on `electron`, `electron/*`, `@electron/*` and on the `window`
  / `document` globals in `shared/**` (`eslint.config.mjs:327-358`). ESLint
  warnings still fail the build because lint runs with `--max-warnings=0`
  (`package.json:21`).

**5. `electron/` must not import renderer aliases.**
`electron-no-renderer` (`.dependency-cruiser.cjs:118`) and the ESLint block at
`eslint.config.mjs:367` both forbid `@features/*`, `@shared/*`, `@app/*`,
`@platform/*`, `@ui/*` from main. dependency-cruiser marks this one `warn`
(advisory); the ESLint half is blocking because of `--max-warnings=0`.

**6. Browser code must not import Node built-ins.**
`no-nodejs-from-browser` (`.dependency-cruiser.cjs:129`) — `^src/` may not
import `fs`, `path`, `child_process`, … (tests exempted).

### B.4 Do / Don't

```ts
// Do
import { PdfViewer } from '@features/pdf'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import type { AiRegistryResponse } from '@shared-core/types'
import { useElectronQuery } from '@platform/electron/useElectron'

// Don't
import PdfViewer from '@features/pdf/ui/components/PdfViewer' // feature internals are private
import { Something } from '@src/utils/something' // alias forbidden
import { app } from 'electron' // renderer never imports Electron
import { useConfirmDialog } from '@app/hooks/useConfirmDialog' // from src/shared: layer inversion
```

---

## C. Electron process architecture

### C.1 Main process — `electron/`

Entry point is `package.json:6` → `dist/electron/electron/app/index.js`, built
from `electron/app/index.ts`.

Startup order (`electron/app/index.ts`):

1. `resolveUserDataProfile()` (`:31`) relocates the user-data directory before
   anything else reads it, so `stable` / `dev` / custom profiles never mix.
2. Command-line switches, single-instance lock (`:84`), `open-file` handler for
   macOS, `registerPdfScheme()` (`:107`).
3. `app.whenReady()` (`:180`) → `initializeApp()` (`:124`):
   `initLogger` → `registerGeneralHandlers()` (`:126`) → cleanup chain →
   `registerPdfProtocol()` / `registerPdfProtocolHandlers()` →
   `initializeNativeMessaging()` → `createWindow()` (`electron/app/windowManager.ts:24`).
4. `createWindow()` hardens the window's `WebContents`
   (`electron/app/window/security.ts:73`), loads the renderer
   (`electron/app/window/rendererLoader.ts:73`) and installs session/permission
   policy (`electron/app/window/sessions.ts:173`).

Directory responsibilities:

- `electron/app/` — entry point, window creation (`window/windows.ts:32`),
  session partitions and permission handlers (`window/sessions.ts`),
  CSP header rewrite (`window/rendererLoader.ts:60`), remote-content policy
  (`window/remoteContentSecurity.ts`), permission policy
  (`window/permissionPolicy.ts`), the IPC aggregator (`ipcHandlers.ts:17`), and
  the display-media picker window (`displayMediaPicker.ts`).
- `electron/core/` — `ConfigManager.ts` (serialized JSON store with
  prototype-pollution protection), `logger.ts`, `encryption.ts`, CSP builder,
  cache accounting/cleanup, `updater.ts`, and the IPC plumbing:
  `typedIpcMain.ts`, `ipcSecurity.ts`, `ipcPayloadGuards.ts`,
  `systemHandlers/`.
- `electron/features/` — one handler module per domain: `ai`, `ai-view`,
  `automation`, `gemini-web-session`, `native-messaging`, `pdf`, `screenshot`,
  `settings`, `shell-open`. Each exports `register<Domain>Handlers()`; all of
  them are called from the single aggregator
  `electron/app/ipcHandlers.ts:17` (guarded against double registration).

`electron/app/ipcHandlers.ts` is the only place that wires handlers. Direct
`ipcMain.handle(...)` calls exist in exactly one file —
`electron/core/typedIpcMain.ts:29`. The five `ipcMain.on(...)` sites
(`core/systemHandlers/systemHandlers.ts:71`,
`features/ai-view/aiViewHandlers.ts:211`, `features/pdf/pdfHandlers.ts:14`,
and the two per-picker-instance listeners in `app/displayMediaPicker.ts:188-189`)
each verify the sender first. Three call `requireTrustedIpcSender(event)`; the two
picker listeners compare `event.sender` against the picker window's own
`webContents` directly (`app/displayMediaPicker.ts:164`, `:180`), which is the
equivalent check for a window that is not the main window.

### C.2 Preload — `electron/preload/`

| File                           | Loaded by                                                             | Exposes                                     |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------- |
| `index.ts`                     | `window/windows.ts:47` → `…/preload/index.js`                         | `window.electronAPI` (`:190`)               |
| `displayMediaPickerPreload.ts` | `displayMediaPicker.ts:76` → `…/preload/displayMediaPickerPreload.js` | `window.displayMediaPicker` (`:26`)         |
| `typedIpcPreload.ts`           | imported by `index.ts` — not a preload itself                         | `typedInvoke`, `onEvent`, `unwrapIpcResult` |

`index.ts` builds one `ElectronApi` object with exactly one method per allowed
channel and calls `contextBridge.exposeInMainWorld('electronAPI', electronApi)`.
There is no generic `invoke(channel)` in the surface; the renderer cannot name
a channel the preload did not bind. `displayMediaPickerPreload.ts` is a
separate, per-window preload: its channel names arrive through
`--picker-ch-…` additional arguments so concurrent picker windows cannot
collide.

### C.3 Renderer — `src/`

`src/index.html` → `src/app/main.tsx`. `bootstrap()` (`:35`):

1. installs the browser stub `window.electronAPI` when running outside Electron
   (`createBrowserElectronApi.ts`, used by `npm run dev:web`);
2. `hydrateSettingsFromMain()` (`main.tsx:47`) — pulls the main-process
   preference mirror into `localStorage` **before** React mounts, so stores that
   read synchronously see the saved values;
3. `installSettingsSync()` — keeps the two copies in step while running
   (`src/app/lib/settingsSync.ts`);
4. `hydratePreferenceStores()`, global error handlers, then `createRoot(...).render`.

From there: `AppProviders` → `App` → `MainWorkspace` / `FocusOverlay`, with
`src/platform/electron/api/use*Api.ts` as the only route to IPC.

### C.4 How the three talk

```
renderer (src/)                     preload (electron/preload/)        main (electron/)
window.electronAPI  ─────────────►  typedInvoke(channel, ...args)  ──►  registerIpcHandler(channel, …)
  typed by ElectronApi                typed by IpcInvokeRequestMap       typed by IpcInvokeRequestMap
  (shared/types/electronApi.ts)       (shared/types/ipcContract.ts)      requireTrustedIpcSender(event)
                                                                        → handler → IpcResult<T>

main ──► webContents.send(channel, …) ──► onEvent(channel, cb) ──► renderer subscription
        (IpcEventMap, shared/types/ipcContract.ts:376)
```

### C.5 Build outputs

| Output                                                        | Produced by                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `dist/index.html`, `dist/assets/*`                            | `vite build` — `root: './src'`, `outDir: '../dist'` (`vite.config.mts:116,120`)                    |
| `dist/pdfjs/{cmaps,standard_fonts,wasm,iccs}`                 | `pdfjsAssets()` `closeBundle` hook (`vite.config.mts:73`)                                          |
| `dist/electron/**`                                            | `tsc -b tsconfig.node.json` — `outDir: dist/electron`, `rootDir: '.'` (`tsconfig.node.json:27-28`) |
| `dist/electron/electron/preload/index.js`                     | esbuild bundle over the tsc output (`package.json:42`)                                             |
| `dist/electron/electron/preload/displayMediaPickerPreload.js` | tsc output only (esbuild bundles `index.ts` exclusively)                                           |

`npm run build` = `tsc -b` (all three projects) + `build:renderer:electron`
(`scripts/build-electron.mjs` → `vite build` with `ELECTRON=1`) +
`build:backend` (`package.json:46`). The packaged app loads
`dist/index.html` over `file://` (`rendererLoader.ts:82`); in dev it waits for
the Vite server and loads that instead (`rendererLoader.ts:96`). The URL comes
from `DEV_SERVER_URL` in `electron/app/window/environment.ts:4`, which reads the
`APP_RENDERER_URL` environment variable and falls back to
`http://localhost:5173`; `APP_RENDERER_URL` is the variable name, not the
constant, and `environment.ts` also derives `DEV_SERVER_ORIGIN` from it for the
navigation allowlist.

---

## D. IPC security boundaries

### D.1 The contract (single source of truth)

Adding a channel means touching three files together
(`docs/CODING_STANDARD.md` §9):

| File                                | Holds                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `shared/constants/ipcChannels.ts:1` | `IPC_CHANNELS` — every channel name (`as const`)                                                  |
| `shared/types/ipcContract.ts:54`    | `IpcInvokeRequestMap` — args tuple → result type; `IpcEventMap` (`:376`) for `on`/`send` channels |
| `shared/types/electronApi.ts:79`    | `ElectronApi` — the surface `window.electronAPI` exposes                                          |

Derived types: `IpcInvokeChannel` / `IpcEventChannel`
(`ipcContract.ts:416-417`), `IpcResult<T>` (`shared/lib/typedIpc.ts:15`) — a
`{ ok: true, data } | { ok: false, error }` discriminated union that every
handler resolves with (never a rejected promise, because Electron's
serialization of a rejected `ipcMain.handle` is lossy).

The contract is type-checked at runtime from the test side too:
`electron/__tests__/core/ipcContract.test.ts`.

### D.2 Preload: the allow-list

`electron/preload/typedIpcPreload.ts`:

- `typedInvoke<C extends IpcInvokeChannel>` (`:51`) only accepts a channel
  that exists in `IpcInvokeRequestMap`; a typo does not compile.
- `safeInvoke` (`:23`) enforces payload caps **before** the message leaves the
  renderer: `MAX_IPC_ARG_SIZE = 512 KB` (`:6`) and
  `MAX_IMAGE_IPC_ARG_SIZE = 50 MB` (`:7`) for the two image-carrying channels
  in `LARGE_PAYLOAD_CHANNELS` (`:9`). Oversized payloads are rejected with a
  structured `failure('internal_error', 'Payload too large')` instead of being
  sent.
- `unwrapIpcResult` (`:58`) turns a failed `IpcResult` into a thrown `Error`
  carrying the `code`, so callers never receive a raw error object.
- `onEvent` (`:68`) subscribes and returns its own unsubscribe function.

`electron/__tests__/preload/preload.test.ts` pins the surface: the exposed API
matches `ElectronApi`, and no extra channel is reachable.

### D.3 Main: sender validation and payload validation

1. **Trusted sender.** `requireTrustedIpcSender` (`electron/core/ipcSecurity.ts:41`)
   is passed to `registerIpcHandler` as the `trustedCheck` argument. It requires
   all of: the sender is the main window's `WebContents` (`:7`), the current
   URL passes `isAllowedMainFrameUrl` (`electron/app/window/security.ts:39`) so
   an XSS-redirected main window loses its privileges, and `event.senderFrame`
   is the window's main frame — so an iframe or a managed remote view cannot
   invoke privileged handlers at all.
2. **Single choke point.** `registerIpcHandler` (`electron/core/typedIpcMain.ts:23`)
   is the only `ipcMain.handle` call site. It runs the trusted check, casts
   args to the contract's tuple, and converts any thrown value into
   `failure('internal_error', …)` after logging the full error in main.
3. **Payload guards.** Renderer input is `unknown` at the boundary:
   `electron/core/ipcPayloadGuards.ts` (`toStrictBoolean`), per-feature
   `sanitize*` functions (`electron/features/ai/aiConfigSanitize.ts:30`), and —
   for the whole remote-view surface — `electron/features/ai-view/aiViewContract.ts`,
   which range-checks ids, host tokens, rectangles (`MAX_VIEW_RECT_EDGE`,
   `MAX_VIEW_BORDER_RADIUS`), scripts and input events before anything reaches
   `WebContents`.
4. **Event channels.** All five `ipcMain.on` sites verify the sender themselves
   (see C.1) - three through `requireTrustedIpcSender`, the two picker listeners
   by comparing against the picker window's `webContents`. A fire-and-forget
   message gets no automatic protection from `registerIpcHandler`.

### D.4 What the renderer can never ask for

`electron/features/ai-view/aiViewTargets.ts:13` inverts the request: the
renderer sends an `AiViewSource` **key**; partition, entry URL and label are
resolved from main-process registries and re-validated against
`isAllowedManagedViewPartition` / `isHostTrustedForPartition`
(`electron/app/window/permissionPolicy.ts`). The same inversion applies to PDF
bytes: `electron/features/pdf/pdfProtocol.ts` serves `local-pdf://` from an
in-process id registry behind an allowlist and byte-range support, so a
renderer never hands main a filesystem path to read.

---

## E. PDF.js architecture

**One runtime, one version, one worker, one viewer.** `pdfjs-dist` is pinned
exactly at **6.4.299** (`package.json:238`), there is no `overrides` entry for
it, no `@react-pdf-viewer` package in the tree, and no second copy on disk.
All of that — plus the absence of a feature flag and of any legacy viewer
markup — is asserted by `src/__tests__/architecture/pdfjs-single-runtime.test.ts`
(`PDFJS_VERSION` at `:43`). The migration history behind this is in
[pdfjs-migration-plan.md](pdfjs-migration-plan.md); nothing described there is
current code.

### E.1 The engine boundary

`src/features/pdf/engine/` is React-free, DOM-free and viewer-free; its
dependency direction is `UI → engine → pdfjs-dist` (`engine/index.ts:1-8`).
Only four files may import it (`ENGINE_IMPORTERS`,
`pdfjs-single-runtime.test.ts:96`):

```
src/features/pdf/native/useNativePdfEngine.ts          (manager + renderer instances)
src/features/pdf/native/useNativePdfRender.ts          (isRenderCancelled)
src/features/pdf/native/useNativePdfCaptureDocument.ts (capture handle)
src/features/pdf/lib/renderPageToImage.ts              (temporary capture document)
```

Engine modules: `documentManager.ts`, `pageCache.ts`, `pageRenderer.ts`,
`pdfDocumentOptions.ts`, `pdfWorker.ts`, `captureDocument.ts`, re-exported
through `engine/index.ts`. Outside `engine/`, `pdfjs-dist` is imported in
exactly three production files — `native/useNativePdfTextLayer.ts:79`
(`TextLayer`), `native/useNativePdfAnnotationLayer.ts:77` (`AnnotationLayer`)
and `native/nativePdfLinkService.ts:83` (a type only) — because those classes
need the DOM, which the engine is forbidden to touch.

### E.2 Document lifecycle

`createPdfDocumentManager()` (`engine/documentManager.ts:78`) owns the
`PDFLoadingTask` / `PDFDocumentProxy` pair:

- `load(source)` (`:95`) calls `initializeNativePdfWorker()` (`:100`), then
  disposes the previous task, then `getDocument(createPdfDocumentOptions(source))`
  (`:107`).
- A **generation counter** plus immediate disposal make a superseded load
  resolve to `null` instead of publishing; a rejected `task.promise` is
  destroyed in place (`:123`) because a rejected load still holds a live
  `PDFWorker`.
- Teardown always goes through `PDFDocumentLoadingTask#destroy()` — PDF.js 6
  removed `PDFDocumentProxy#destroy()`. `disposeActiveDocument()` (`:86`) is the
  single owner of that call.
- `getPage(n)` is served from `pageCache.ts`, so page proxies are reused.

React side: `useNativePdfEngine.ts:56` creates **one** manager and **one**
page renderer per mounted viewer (created in an effect, destroyed in its
cleanup — StrictMode-safe), and `useNativePdfDocument.ts:82` turns
`(pdfUrl, reloadKey)` into a `ready` document with a per-effect `cancelled` guard
so nothing publishes after unmount.

The controller that orders all of it is
`useNativePdfController.ts:198`; its module comment documents the hook-call
order (engine → document → capture → render → text/annotation/search) and which
three orderings are load-bearing.

### E.3 Worker lifecycle

`src/features/pdf/engine/pdfWorker.ts` is the only place in the codebase that
assigns `GlobalWorkerOptions.workerSrc` — the architecture test sweeps for a
second writer and fails if one appears
(`pdfjs-single-runtime.test.ts:227-236`).

- The URL comes from the same dependency the engine uses:
  `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`
  (`pdfWorker.ts:33`), so engine and worker can never be different majors.
- `initializeNativePdfWorker()` (`:51`) is idempotent behind a `configured`
  flag; callers invoke it before every load, so the flag is what makes
  "assigned exactly once" observable to the test.
- `workerSrc` is deliberate over `workerPort`: pdf.js then lazily creates and
  reuses a single `PDFWorker` itself (`pdfWorker.ts:15-23`).

### E.4 `getDocument` options

`createPdfDocumentOptions()` (`engine/pdfDocumentOptions.ts:115`) is the one
builder for `getDocument` parameters anywhere in the app:

- `enableScripting: false` (`:122`) — PDF JavaScript actions never run.
- `isEvalSupported` does not exist in 6.x and is asserted absent everywhere
  (`pdfjs-single-runtime.test.ts:305`).
- Asset URLs come from `pdfAssetUrl()` (`:103`) over the four declared
  subdirectories `PDFJS_ASSET_SUBDIRS` (`:74`) — `cmaps`, `standard_fonts`,
  `wasm`, `iccs` — relative to `import.meta.env.BASE_URL`, so no absolute path
  is ever embedded.
- `useWorkerFetch` is intentionally **not** set: PDF.js 6 derives it correctly
  for both `http://localhost:5173` (dev) and `file://` (packaged) bases
  (module comment, `:27-39`).

### E.5 Rendering

`useNativePdfRender.ts:95` — **one page, one canvas**. The effect depends on
`(document, page, scale)`; cleanup calls `renderer.cancel()`, a superseded
render rejects with PDF.js's typed `RenderingCancelledException` and is
recognised through `isRenderCancelled` (never by message text), and a real
failure surfaces as `renderError`. `onRenderCommitted` fires after a live
render has painted, which is the signal the page transition waits on.
`pageRenderer.ts` sizes the canvas only when the size actually changes, so a
same-size page turn keeps the outgoing pixels on screen until the new render
lands.

### E.6 Text layer

`useNativePdfTextLayer.ts:140` mounts PDF.js's own `TextLayer` class
(`import { type PDFPageProxy, TextLayer } from 'pdfjs-dist'`, `:79`) — the
pre-4.x `renderTextLayer()` function does not exist in 6.x and is asserted
gone (`pdfjs-single-runtime.test.ts:277`). The layer is built from the _same_
viewport call the canvas used, so geometry cannot drift. `TextLayer#update()`
exists but is deliberately unused: a full rebuild per scale change is preferred
over a second correctness surface.

### E.7 Search

- `native/nativePdfSearch.ts` — literal, case-insensitive matching over the
  **rendered page's** text layer, producing one rectangle per touched run.
  It is not `PDFFindController`: that class lives in `pdfjs-dist/web/pdf_viewer.mjs`
  and needs the whole web viewer (event bus, page views, history), so it is
  never imported (`pdfjs-single-runtime.test.ts:175`).
- `native/useNativePdfSearch.ts:132` implements exactly the surface the
  toolbar uses: `highlight(keyword)` / `clearHighlights()`. No match count, no
  next/previous, no auto page jump — synchronous and generation-free by
  design; the effect's dependency list _is_ the invalidation.
- Geometry overlay: the host element is
  `ui/components/NativePdfViewer.tsx:230` (`<div ref={searchLayerRef} data-native-pdf-search-layer />`),
  always mounted so the DOM contract does not
  change shape with the search state, styled by `nativePdfSearchLayer.css`;
  `native/nativePdfSearch.ts` only computes and injects the rectangles into it.
  The highlight keyframe `pdf-highlight-fadein` is defined once in
  `src/shared/styles/modules/_pdf-viewer.css`.

### E.8 Capture

Capture never decodes a second copy of a document:

1. The mounted viewer publishes a handle — `useNativePdfCaptureDocument.ts:64`
   registers it in `lib/activePdfDocumentRegistry.ts:128` (`setActivePdfDocument`),
   keyed on `(pdfUrl, reloadKey, status)`, with **token-scoped** withdrawal
   (`clearActivePdfDocument`, `:154`) so `LeftPanel` and `FocusOverlay` viewers
   cannot evict each other.
2. The handle carries an `isAlive()` that asks the manager, not the proxy —
   PDF.js 6 has no `PDFDocumentProxy#destroyed`
   (`activePdfDocumentRegistry.ts`, module comment).
3. When nothing is mounted, `lib/renderPageToImage.ts:73`
   (`renderPageToImageFallback`) loads a temporary document **through the
   engine's** `captureDocument.ts` adapter — it imports no `pdfjs-dist` of its
   own, which is asserted at `pdfjs-single-runtime.test.ts:407-421`.
4. Consumers: `capture/findPageCanvas.ts`, `capture/captureCanvasAsBlob.ts`,
   `capture/usePdfCaptureActions.ts:65`, plus GPU cleanup in
   `capture/useCanvasGpuCleanup.ts`.

### E.9 Navigation

Page state is 1-based and clamped by `native/nativePdfBounds.ts` (pure
functions, so the contract is testable); `native/useNativePdfPageState.ts`
owns `currentPage`, and `initialPage` is applied once per
`(pdfUrl, reloadKey)` so a persisted reading position cannot reset the viewer
mid-read. Surfaces:

- toolbar: `ui/components/PdfPageNav.tsx` (prev / next / typed jump);
- wheel: `viewport/usePdfWheelNavigation.ts` (no modifier → page turn; the
  gesture idle window and opposite-direction lock are constants in that file);
- links: `native/nativePdfLinkService.ts` implements only the surface
  `AnnotationLayer` calls, and routes external targets through the app's
  `openExternal` bridge rather than `window.open` or `location.href`
  (asserted at `pdfjs-single-runtime.test.ts:315`);
- opening: `hooks/usePdfOpenActions.ts` (file dialog, drag-drop, register
  path), `hooks/useShellOpenPdf.ts` (right-click "Open with"),
  `hooks/useReadingProgressPersistence.ts` + `hooks/readingHistoryRepository.ts`
  for resume.

### E.10 Zoom

The scale domain is **numeric** — there is no `SpecialZoomLevel`-style keyword
on this runtime, and "fit" is a computed number, not a name.

- Constants: `constants/pdfZoom.ts` — `PDF_ZOOM_STEP = 0.1`,
  `PDF_ZOOM_MIN_SCALE = 0.1`, `PDF_ZOOM_MAX_SCALE = 5.0`,
  `PDF_RESIZE_REFIT_DEBOUNCE_MS = 150`. Zoom-level persistence is explicitly
  not implemented: resize refit always returns to the fit scale.
- State: `native/useNativePdfScaleState.ts` (numeric, clamped, fit applied once
  per document identity to avoid a fit→render→resize→fit loop).
- Inputs, all landing on one coalesced `zoomTo` channel:
  `viewport/usePdfZoomShortcuts.ts` (`Ctrl/Cmd -` / `=` / `0`),
  `viewport/usePdfCtrlWheelZoom.ts` (capture phase, 40 ms throttle),
  `viewport/usePdfResizeRefit.ts` (debounced refit),
  `viewport/usePdfViewerZoomIpc.ts` (context-menu zoom items arriving over
  `TRIGGER_PDF_VIEWER_ZOOM` — renderer PDF zoom, never `webContents` zoom).
- Toolbar binding: `native/nativeZoomControls.tsx` adapts native scale state to
  the render-prop contract `PdfToolbar` already has, so the shared toolbar needs
  no native-specific branch.

### E.11 Assets

`vite.config.mts:42` (`pdfjsAssets()`) stages the four PDF.js asset
directories: in dev a middleware serves them from `node_modules/pdfjs-dist`
under `/pdfjs/` with a path-escape check; on build `closeBundle` copies them
into `dist/pdfjs/`. `PDFJS_ASSET_SUBDIRS` is duplicated between
`vite.config.mts:18` and `pdfDocumentOptions.ts:74` and pinned by
`pdfjs-single-runtime.test.ts:327`. `pdfjs-dist` is forced into a single
`vendor-pdf` chunk (`vite.config.mts:99` and `:148`).

---

## F. AI session architecture

### F.1 Hosting — `WebContentsView` in main

`electron/features/ai-view/aiWebContentsViewManager.ts` owns every embedded
remote surface. A `WebContentsView` is not in any DOM tree, so its lifetime,
geometry and visibility are decided there, not by React:

- `ManagedAiView` records `viewId`, `sourceKey`, `partition`, the resolved
  `target`, mirrored `currentUrl` / `isLoading` / `loadError`.
- `aiViewTargets.ts` resolves the renderer's `AiViewSource` key into
  partition + entry URL + label from main-process registries.
- `aiViewContract.ts` validates every request coming the other way.
- `aiViewEventBridge.ts` translates `WebContents` lifecycle/console events into
  typed `AiViewEvent`s carrying the view's **generation**, so a destroyed view
  can never write state into its replacement.
- `aiViewHandlers.ts:51` (`registerAiViewHandlers`) binds the typed channels
  (`AI_VIEW_ATTACH` … `AI_VIEW_FOCUS`), plus the fire-and-forget
  `ipcMain.on(AI_VIEW_SYNC_HOST)` (`:211`) for host geometry.
- Remote-content policy (HTTPS-only main-frame navigation, popup denial,
  clipboard protection, `will-navigate` rules) is applied by
  `electron/app/window/remoteContentSecurity.ts`; per-partition web permissions
  by `electron/app/window/permissionPolicy.ts`.

### F.2 Renderer side — controller and host ownership

- `src/features/ai/aiViewSurface.ts` is the lazy public entry;
  `ui/AiViewSurface.tsx` renders the tab strip, the home page and **one host
  placeholder per alive tab** — only the DOM shell, never the remote page.
  Exactly one mounted surface (`isSurfaceActive`) may position views, which is
  what turns a focus-mode switch into a reposition instead of a rebuild.
- `src/shared/hooks/aiContent/createAiContentController.ts:51` is the
  renderer-side handle: it mirrors URL/loading/readiness locally so the send
  pipeline's synchronous `getURL()` / `isDestroyed()` need no round trip, and
  every mutation is typed IPC keyed by `viewId`.
- `src/shared/hooks/aiContent/managedViewLifecycle.ts:10` states the two-owner
  rule: a **lifecycle owner** (the content identity — an open tab, the Drive
  panel) creates/destroys views; a **host owner** (whatever placeholder is
  mounted) only attaches/detaches geometry. React unmount is a host event and
  must never destroy a view; `retireManagedView()` is what closes one, driven
  from the identity owner. `useManagedContentView.ts` reconciles the live-id
  set against the manager so the view count stays bounded.
- `src/shared/hooks/aiContent/useAiContentLifecycle.ts:5` owns loading / error /
  crash-recovery state per view, including `MAX_CRASH_RETRIES = 3` and the
  stale-content detection probe shipped in
  `src/features/ai/constants/aiContentLifecycle.ts`.

### F.3 Session lifecycle

| Phase      | What happens                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------- |
| attach     | renderer `controller.attach(restoredUrl)` → `AI_VIEW_ATTACH` → main resolves target, creates view |
| first load | the native view stays hidden until `settleFirstLoad`; focus mode reuses the same generation       |
| run        | `AI_VIEW_SYNC_HOST` keeps bounds current; `AI_VIEW_EVENT` streams load/console/crash events back  |
| sleep      | view destroyed after `AI_SLEEP_TIMEOUT_MS`; a placeholder shows instead                           |
| wake       | a new generation is created and waits for its first load before anything is sent to it            |
| evict      | `maxAliveTabs` LRU (`useAiLifecycleSettings`, `STORAGE_KEYS.AI_MAX_ALIVE_TABS`) retires the view  |
| close      | tab close retires the view via `retireManagedView()`                                              |

Liveness settings live in `src/features/ai/hooks/useAiLifecycleSettings.ts`
(`AI_MAX_ALIVE_TABS`, `AI_SLEEP_TIMEOUT_MS`, `AI_NEVER_SLEEP_SITES`).

### F.4 Persistence

| What                                                                                        | Where it is written                                    | Owner                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Preferences (theme, prompts, pinned AI tabs, model list, layout, language, reading history) | `localStorage` **and** mirrored to `app_settings.json` | `src/app/lib/settingsSync.ts:17` (`SETTINGS_SYNC_KEYS`) ↔ `electron/features/settings/appSettingsHandlers.ts:33`        |
| API Chat sessions                                                                           | `localStorage` key `quizlab_api_chat_sessions_v2`      | `src/features/ai/store/apiChatPersistence.ts:17` (`LOCAL_STORAGE_KEY`), debounced save, quota-aware                     |
| Per-host AI selectors + automation config                                                   | JSON under the user-data folder                        | `electron/features/ai/aiConfigHandlers.ts:21` + `aiConfigSanitize.ts:30` / `aiConfigDomain.ts`, through `ConfigManager` |
| Google AI web session                                                                       | encrypted export/import, profile health metadata       | `electron/features/gemini-web-session/`                                                                                 |
| PDF allowlist / reading resume                                                              | `pdf-allowlist.json`, `STORAGE_KEYS.LAST_PDF_READING`  | `electron/features/pdf/pdfProtocol.ts`, `src/features/pdf/hooks/readingHistoryRepository.ts`                            |

The renderer is the source of truth while running (fast, reactive); the
main-process copy guarantees preferences survive a cache/profile wipe.
`hydrateSettingsFromMain()` runs before React mounts so a stale in-memory copy
can never overwrite a fresh value.

### F.5 Automation and selector self-healing

The flow: `pendingAiItems` (the composer queue,
`src/app/providers/app-tool/useAiDraftQueue.ts:25`) → `planBulkAiSend()`
(`src/app/providers/ai/planBulkAiSend.ts:37`, which preserves text/image order
and merges consecutive text excerpts) → `useDraftSendOrchestration` → the
feature's send pipeline → DOM automation inside the managed view.

Selector repair turns a runtime recovery into persistent configuration,
deterministically and without an LLM:

```
saved selector
  → normal resolve (cache → primary/candidates → fingerprint → fallback)
  → recovered? (candidate | fingerprint | semantic | provider | heuristic)
  → confidence gate (score, ambiguity gap, stability, send-control blocklist)
  → real pipeline success (text inserted / submit clicked) required
  → staged SelectorRepairCandidate (consecutive success counter)
  → threshold reached → promote (old primary kept as first fallback)
  → sanitizeConfig → disk
```

Ownership:

| Concern                                              | Owner                                                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy (thresholds, confidence, promotion, flapping) | `shared/selectorRepair/` — `policyThresholds.ts`, `repairEvidence.ts`, `selectorPromotion.ts`, `selectorValidation.ts`, `strategyVocabulary.ts` |
| Selector/config shape and hostname canonicalisation  | `shared/selectorConfig.ts` (`canonicalizeHostname`, `normalizeSubmitMode`, `toAutomationConfig`)                                                |
| Runtime evidence + stable selector re-derivation     | `electron/features/automation/automationScripts/lib/selectorRepairRuntime.ts` (constants mirrored from the policy, parity-tested)               |
| Stable CSS selector generation                       | `electron/features/automation/lib/dom/pickerDomRuntime.ts` — reused verbatim, never re-implemented                                              |
| Sanitisation / persistence                           | `electron/features/ai/aiConfigSanitize.ts`, `aiConfigDomain.ts`                                                                                 |
| Staging / promotion decisions                        | `src/features/ai/lib/selectorRepair/evaluateRepairEvidence.ts:254`                                                                              |
| Write + cache invalidation                           | `src/features/ai/lib/selectorRepair/applySelectorRepair.ts:44`                                                                                  |
| Reporting + serialized queue                         | `src/features/ai/lib/selectorRepair/reportSelectorRepair.ts:125`, `repairQueue.ts`                                                              |

Rules that are easy to break and are therefore covered by tests
(`src/__tests__/shared/selectorRepair.test.ts`,
`src/__tests__/features/ai/selectorRepair/*`):

- The injected script never persists anything. Only serializable metadata
  (selector, strategy, score, counters) crosses IPC — never an `Element`.
- "Found in the DOM" is **not** a success. Only a completed pipeline operation
  counts, and input and send button are credited independently.
- Medium/low confidence, an ambiguous score gap, a blocklisted send control, a
  build-generated class and a runtime marker selector all refuse promotion.
- Button repairs are strictly more conservative than input repairs
  (`BUTTON_MIN_SELECTOR_PRIORITY` in `selectorRepairRuntime.ts`).
- A promoted selector keeps the old primary as its first fallback, and a repair
  that flaps inside `REPAIR_FLAP_WINDOW_MS` (`shared/selectorRepair/policyThresholds.ts:37`)
  is refused.
- Config writes happen only on a material transition; the runtime `ConfigCache`
  is dropped after a promotion so the next send uses the new selector.

---

## G. Build and release

### G.1 Renderer — Vite

`vite.config.mts`: `root: './src'`, `base: './'` (so `file://` works),
`outDir: '../dist'`, `emptyOutDir: true`. Aliases come from
`vite.aliases.mts`. `manualChunks` (`:92`) and the matching `rolldownOptions`
groups (`:138`) split vendor chunks — `vendor-pdf` for `pdfjs-dist` among them.
The `pdfjsAssets()` plugin serves/stages the PDF.js assets (§E.11).
`npm run dev:web` runs Vite alone against the browser API stub.

### G.2 Main and preload — `tsc` + esbuild

- `typecheck` / `build` use `tsc -b` over three project references declared in
  `tsconfig.json:15`: `tsconfig.app.json` (renderer, `noEmit`, includes
  `src` + `shared`), `tsconfig.node.json` (main, emits to `dist/electron`),
  `tsconfig.node.test.json` (`noEmit`, `Bundler` resolution for tests).
- `build:backend` (`package.json:42`) = `tsc -b tsconfig.node.json --force`
  **and** an esbuild bundle of `electron/preload/index.ts` to
  `dist/electron/electron/preload/index.js` (`--platform=node --format=cjs
--external:electron`), so the preload ships as one CJS file with `shared/`
  inlined.

### G.3 Packaging — electron-builder

The `build` block in `package.json:53`: `appId com.quizlab.reader`,
`files: ["dist/**/*"]`, icons and `extensions/` as `extraResources`, output to
`release/`, publish to GitHub Releases. Targets: NSIS x64 (per-user,
`requestedExecutionLevel: asInvoker`), dmg/zip for macOS, AppImage/deb for
Linux; `npmRebuild: false`. Install-time customisation is in
`installer/installer.nsh` — the full installer story, including the Explorer
context-menu entry and signing, is [windows-installer.md](windows-installer.md).

### G.4 `scripts/*.mjs`

| Script                          | Gates                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `dev.mjs`                       | dev orchestrator: starts/reuses Vite on 5173, launches Electron                                           |
| `build-electron.mjs`            | `vite build` with `ELECTRON=1` (used by `build:renderer:electron`)                                        |
| `check-repo-hygiene.mjs`        | no tracked `dist/`, `release/`, `coverage/`, `.cache/`, `*.tsbuildinfo` (`ci:check-hygiene`)              |
| `check-version-consistency.mjs` | version badge format in both READMEs + `v*` tag ↔ `package.json` (`ci:check-version`)                     |
| `check-audit.mjs`               | production-only (`npm ls --omit=dev`) high/critical advisories; exception list cannot rot (`check:audit`) |
| `check-electron-security.mjs`   | Electronegativity CSV parsed for HIGH/CRITICAL (`check:electron-security`)                                |
| `check-semgrep.mjs`             | Semgrep on production sources, `--error` (`analyze:semgrep`)                                              |
| `check-type-coverage.mjs`       | type-coverage ≥ 98% for `tsconfig.app` and `tsconfig.node` (`analyze:types:ci`)                           |
| `check-file-sizes.mjs`          | 700 lines general / 650 for hooks and components (advisory in CI)                                         |

### G.5 CI — `.github/workflows/build.yml`

Three jobs:

1. **`quality`** (job `quality`) — `ubuntu-latest`, on push/PR to `main`/`master`,
   Node 24, blocking except where noted: `ci:check-hygiene`, `ci:check-version`,
   `lint`, `format:check`, `typecheck`, `analyze:architecture`, `analyze:css`,
   `analyze:knip`, `test:coverage`, `analyze:types:ci`, `analyze:duplicates`,
   `analyze:circular`, `build`, `analyze:semgrep`, `check:audit`,
   `check:electron-security`. **Advisory** (`continue-on-error: true`):
   `analyze:file-sizes` (step `File Size Check`) and `analyze:spell:ci`.

   Two of these are blocking by design rather than by accident, and the
   workflow tests pin both:

   - **`analyze:knip`** runs bare `knip` — no `--max-issues` ceiling, so any
     unused export, type, file or dependency fails the build rather than
     merely being reported. `knip-dead-code-gate.test.ts` asserts the command
     carries no tolerance and that no _other_ script reintroduces one.
   - **`build`** is in this job, not only in the tag-driven `build` job: without
     it a pull request could be green while the renderer or the Electron backend
     produced no artifact on Linux.

   Shell portability is not implicit here. npm runs scripts through `cmd.exe`
   on Windows and `bash` on Linux, so a single-quoted npm argument arrives at
   the tool with its quotes attached and silently matches nothing — which is how
   `analyze:architecture` once validated the wrong graph, and how
   `analyze:types` once excluded no test files at all. Double quotes are correct
   in both shells; `knip-dead-code-gate.test.ts` rejects any script that uses a
   single-quoted argument.

2. **`build`** (job `build`) — `needs: quality`, runs only on `v*` tags (or manual
   dispatch), matrix `windows-latest` → `win` and `ubuntu-22.04` → `linux`;
   `npm run build && npx electron-builder --<platform> --publish never`, then
   uploads `release/*` artifacts.
3. **`release`** (job `release`) — `needs: build`, tags only; downloads the
   artifacts and attaches them to a GitHub Release with generated notes.

Jobs are named rather than line-numbered here on purpose: a sibling commit that
adds a step shifts every line below it, and a stale line number reads as a
factual claim about the file.

Tags must match `package.json`'s version; `npm run ci:check-version` is what
enforces that.

---

## H. Architecture rules

### H.1 Allowed and forbidden directions

| Direction                                                                          | Verdict   | Enforced by                                                                                       |
| ---------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `src/app` → `src/features` → `src/shared`                                          | allowed   | the intended order; `shared-no-app` stops the reverse (`.dependency-cruiser.cjs:82`)              |
| `src/*` → `@shared-core/*` (`shared/`)                                             | allowed   | contracts are shared deliberately                                                                 |
| `shared/*` → `@shared-core/*` via **relative** paths                               | allowed   | main/shared import relatively; `@shared-core` is the renderer spelling                            |
| feature → feature **barrel**                                                       | allowed   | `pathNot: index.ts` in the generated cross-feature rules                                          |
| feature → feature **internals**                                                    | error     | `no-cross-feature-internals:*` (`.dependency-cruiser.cjs:38`) + ESLint pattern                    |
| `src/app`, `src/shared`, `shared/` → feature internals                             | error     | `app-no-feature-internals` (`.dependency-cruiser.cjs:68`) + ESLint                                |
| `src/shared` → `src/app`                                                           | error     | `shared-no-app` + `sharedToAppPattern`                                                            |
| `src/**` → `electron/**`                                                           | error     | `renderer-no-electron-direct` (`.dependency-cruiser.cjs:106`) + ESLint `^electron(/`              |
| `src/**` → bare `electron` package                                                 | error     | ESLint `no-restricted-imports` (`eslint.config.mjs:266`)                                          |
| `shared/**` → `electron` / `@electron/*` / DOM globals                             | lint-warn | `shared-core-no-electron` (error in depcruise) + ESLint (`eslint.config.mjs:327-358`)             |
| `electron/**` → `@features` / `@shared` / `@app` / `@platform` / `@ui`             | lint-warn | `electron-no-renderer` (warn) + ESLint (`eslint.config.mjs:367`), blocking via `--max-warnings=0` |
| `src/**` → Node built-ins                                                          | error     | `no-nodejs-from-browser` (`.dependency-cruiser.cjs:129`)                                          |
| `src/**` → `@src/*`                                                                | error     | `legacySrcAliasPattern` (`eslint.config.mjs:16`)                                                  |
| `engine/` → React, DOM, zustand, `@features/pdf/{native,ui}`, `@app`, `@shared/ui` | forbidden | `pdfjs-single-runtime.test.ts:260`                                                                |

dependency-cruiser runs with `tsPreCompilationDeps: true`
(`.dependency-cruiser.cjs:149`) so `import type` edges are in the graph — type
-only cycles count as cycles.

### H.2 Circular-dependency control

Two independent gates:

- **madge** — `npm run analyze:circular`
  (`package.json:30`) over `src/ electron/ shared/`. It only resolves the
  aliases because `.madgerc:8` supplies `tsConfig: tsconfig.json`; without it
  every aliased import lands in madge's `skipped` list and the gate passes on a
  fraction of the tree. Coverage of that fact (skipped must not contain
  first-party aliases) is asserted in
  `src/__tests__/architecture/circular-import-gate.test.ts`.
- **dependency-cruiser** — the `no-circular` rule
  (`.dependency-cruiser.cjs:52`), scoped away from `node_modules` on purpose so
  a cycle inside a third-party package cannot fail the build.

Currently both report clean (`1143 modules / 4158 dependencies` cruised,
`1092 files` scanned by madge).

### H.3 Shared-layer rules

- `shared/` is runtime-agnostic: no Electron, no `window`, no `document`
  (§B.3.4). It holds contracts (`constants/`, `types/`, `lib/typedIpc.ts`,
  `selectorRepair/`, `selectorConfig.ts`).
- `src/shared/` is renderer-only and sits **below** `src/app` (§B.3.2). If a
  shared module needs an app-owned capability, the capability is passed in as
  an option or the consumer moves down — the dependency is never inverted.
- A primitive used by `src/shared` lives in
  `src/shared/ui/components/primitives/`; a primitive used only by the app
  shell lives in `src/app/components/ui/`. (Rule and rationale:
  `docs/CODING_STANDARD.md` §5.)
- `electron/core/logger.ts` is a deliberate re-export shim of
  `src/shared/lib/logger.ts` across the project-reference boundary; the planned
  merge into `shared/lib/logger.ts` is tracked in `docs/CODING_STANDARD.md` §11.

### H.4 Test and quality gates

Structural regressions are caught by tests, not by review alone —
`src/__tests__/architecture/`:

| File                             | Guards                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `layer-boundaries.test.ts`       | `shared-no-app` exists **and** is wired in both ESLint blocks                         |
| `feature-privacy-gate.test.ts`   | feature-internal patterns survive in both flat-config blocks; depcruise rules present |
| `circular-import-gate.test.ts`   | madge resolves every first-party alias; type-only vs runtime cycles split             |
| `pdfjs-single-runtime.test.ts`   | one PDF.js, one worker, one viewer, engine purity, security posture, assets           |
| `electron-security-gate.test.ts` | the Electronegativity report parser reaches the same verdict either shape             |
| `security-gate-wiring.test.ts`   | audit / Semgrep / Electronegativity gates are blocking in CI, not decorative          |
| `knip-dead-code-gate.test.ts`    | knip entries/ignores reflect real entry points and real reasons                       |

Scripts, by what they gate (`package.json:11-52`):

| Command                        | Gates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`            | `tsc -b` across app, node and node.test projects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run lint`                 | ESLint with `--max-warnings=0` — architecture warnings are blocking here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run format:check`         | Prettier over the repo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm test`                     | Vitest: `src/__tests__/` in jsdom; `electron/__tests__/` in Node **only** where `environmentMatchGlobs` (`vitest.config.mts:26-36`) matches. It lists 9 subtrees (`app/`, `core/`, `features/pdf`, `features/screenshot`, `features/ai`, `features/gemini-web-session`, `features/native-messaging`, `features/shell-open`, `preload/`); every other `electron/__tests__` file — all of `features/ai-view/**`, `features/automation/**` and `features/settings/**` — runs under jsdom. An electron test added outside those subtrees must not assume Node globals or a missing `document` |
| `npm run test:coverage`        | same suite plus per-scope coverage thresholds (`vitest.config.mts:50`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run analyze:architecture` | dependency-cruiser, `--validate`, `--output-type err` (fails, does not merely report)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run analyze:circular`     | madge over `src/ electron/ shared/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run analyze:duplicates`   | jscpd over `src electron shared`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run analyze:deadcode`     | knip; alias of `analyze:knip`, so both fail on the same finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run analyze:types:ci`     | type-coverage ≥ 98% per project                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run analyze:css`          | Stylelint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run analyze:spell:ci`     | cspell (advisory in CI)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run analyze:security`     | Semgrep + `check:audit` + `check:electron-security`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run analyze:mutation`     | Stryker (`stryker.config.mjs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run analyze:all`          | the blocking analyses above, chained; `analyze:bundle` is deliberately **not** in it (it opens a browser)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Before a structural change lands, the minimum is:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run analyze:architecture
npm run analyze:circular
```

Coding, naming and test-writing rules are **not** repeated here — see
[CODING_STANDARD.md](CODING_STANDARD.md).
