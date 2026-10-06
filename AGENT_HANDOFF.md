# QuizLab Agent Handoff

## Purpose

Persistent working memory for agents on the `refactor/native-pdfjs-viewer`
migration. A new agent that has exhausted its context should be able to read only
the repository and this file, and continue safely from where the last agent
stopped.

Not an execution diary — current state, decisions, invariants, next step. Deep
technical reasoning lives in `docs/pdfjs-migration-plan.md`, the authoritative
migration plan.

## Current State

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Branch               | `refactor/native-pdfjs-viewer` (base: `master`)                                        |
| Current phase        | Phase 4 complete — **Phase 5 not started**                                             |
| Last completed phase | Phase 4 — feature-flagged native canvas viewer + page/scale state                      |
| Current HEAD         | run `git rev-parse HEAD`                                                               |
| Working tree         | clean at last commit                                                                   |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                             |
| Readiness            | **ready for Phase 5** — the native viewer is reachable behind `VITE_NATIVE_PDF_VIEWER` |

The shipped PDF experience is still `@react-pdf-viewer`. The native pdfjs-6 path
is implemented, wired into the viewer shell and in the build, and switched on only
by an explicit opt-in environment variable.

## Current Goal

Replace `@react-pdf-viewer` with a native `pdfjs-dist` 6.x viewer **without ever
leaving the shipped app without a working PDF reader**. Phases 1–4 established the
baseline, the regression safety net, the dual runtime and the first working native
renderer. Phase 5 onward adds viewer capabilities to the native path.

## Completed Migration Phases

### Phase 1 — Baseline

Current PDF architecture mapped, `@react-pdf-viewer` coupling identified, native
PDF.js migration determined viable with risks. No source change. Key finding:
`@react-pdf-viewer/core@3.12.0` `require()`s `pdfjs-dist`, and
`npm view @react-pdf-viewer/core version` is still `3.12.0` — no viewer release
supports pdfjs ≥ 4.

### Phase 2 — Regression Test Hardening

Behaviour pinned **before** any renderer change: 125 tests across 6 new files plus
1 extended, mutation-validated (19 deliberate production mutations, 19/19 caught,
all reverted). This is the safety net for every later phase — capture, selection,
pan, Ctrl+wheel zoom, search highlight, serialization.

### Phase 3 — Single-Version Attempt

**BLOCKED, not implemented.** `@react-pdf-viewer@3.12.0` calls `renderTextLayer()`
and `new SVGGraphics()`, both removed in PDF.js 4.x. Measured against 6.4.299:
`{ "version": "6.4.299", "missing": ["renderTextLayer", "SVGGraphics"] }`. The
dependency change was reverted (commit `d0564f7`).

### Phase 3B — Dual-Runtime Native Engine Foundation

Temporary dual-runtime architecture: `pdfjs-6` alias, `features/pdf/engine/`,
packaged assets, split security posture, isolation enforced by tests. No viewer or
UI file touched.

### Phase 4 — Native Canvas Viewer + Page/Scale State

The first consumer of the engine. `features/pdf/native/**` +
`NativePdfViewer.tsx` render one page on one canvas with their own page and scale
state, behind `VITE_NATIVE_PDF_VIEWER` (default **off**). The legacy viewer is
untouched; the normal build now emits **both** PDF.js workers.

## Current PDF Architecture

```
PdfViewer → PdfViewerDocument → usePdfViewerState
   │
   ├─ flag OFF (default) → PdfViewerElement → @react-pdf-viewer <Viewer>
   │                        → require('pdfjs-dist') → pdfjs-dist@3.11.174
   │                        LEGACY, SHIPPED. Worker fed by PdfWorkerHost.
   │                        → capture / text / search / pan / zoom / context menu
   │
   └─ flag ON  (VITE_NATIVE_PDF_VIEWER=true) → NativePdfViewer
                            → useNativePdfController → @features/pdf/engine
                            → pdfjs-6 → pdfjs-dist@6.4.299
```

One `ResizeObserver`, one `containerRef`, one toolbar. Page nav, zoom and the
current-scale readout bind to whichever renderer is live. When the flag is off the
legacy zoom/page/resize hooks are inert (`totalPages` stays 0), so exactly one
implementation of each is ever active.

## Dependency State

| Entry                     | Value                                           | Role                                        |
| ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `pdfjs-dist`              | `3.11.174` (exact)                              | **legacy / RPV runtime**                    |
| `overrides["pdfjs-dist"]` | `3.11.174`                                      | keeps the legacy pin exact                  |
| `pdfjs-6`                 | `npm:pdfjs-dist@6.4.299`                        | **native migration runtime** (alias, exact) |
| `@react-pdf-viewer/*`     | `^3.12.0` (core, page-navigation, search, zoom) | legacy viewer                               |

Unchanged since Phase 3B. `.npmrc` `legacy-peer-deps=true` still suppresses the
RPV peer `ERESOLVE` and must not be removed before the viewer is deleted.

## Temporary Migration Architecture

> **TEMPORARY.** Two PDF.js runtimes are installed so the native viewer can be
> built while the shipped viewer keeps working.

```
LEGACY (shipped)                    NATIVE (VITE_NATIVE_PDF_VIEWER=true)
@react-pdf-viewer@3.12.0            src/features/pdf/engine/**
        ↓                                    ↓
require('pdfjs-dist')              import 'pdfjs-6'
        ↓                                    ↓
pdfjs-dist@3.11.174                 pdfjs-6 alias → pdfjs-dist@6.4.299
        ↓                                    ↓
pdf.worker.min.js (PdfWorkerHost)   pdf.worker.min.mjs (engine/pdfWorker)
```

Separate `GlobalWorkerOptions` module instances; never mix them.

### Temporary Exit Plan

After native viewer feature parity (end of Phase 8): delete the four
`@react-pdf-viewer` packages, `PdfWorkerHost` and its worker import, the
`vendor-pdf-legacy` chunk, `pdfjs-dist@3.11.174` + its override, the `pdfjs-6`
alias, the `CVE-2024-4367` exception, the `isEvalSupported: false` call sites,
`pdfjs-dual-runtime.test.ts`, and `features/pdf/native/**` +
`NativePdfViewer.tsx` + the flag; rename `vendor-pdf-native` back to
`vendor-pdf`; rewrite engine imports `pdfjs-6` → `pdfjs-dist` and repoint asset
staging at `node_modules/pdfjs-dist`; rescope the legacy half of
`pdfjs-engine-worker-coupling.test.ts`. The full ordered list with rationale is
the Phase 3B exit plan in `docs/pdfjs-migration-plan.md`.

## Native PDF Engine

`src/features/pdf/engine/` — 6 files, no React / DOM / UI / zustand / RPV
imports (asserted by test). Direction is `UI → engine → pdfjs-6`, now with a real
consumer.

| File                    | Responsibility                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pdfWorker.ts`          | publishes `pdfjs-6.GlobalWorkerOptions.workerSrc` once; exports the resolved `.mjs` URL                            |
| `pdfDocumentOptions.ts` | the single authoritative `getDocument` parameter builder: scripting + asset policy                                 |
| `documentManager.ts`    | owns the `PDFLoadingTask`; load / reload / getDocument / getPage / destroy, generation-based stale-load protection |
| `pageCache.ts`          | page number → `PDFPageProxy`; clearable, rejected lookups not cached                                               |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, supersede-cancel, typed cancellation                            |
| `index.ts`              | barrel; the only entry point consumers should use                                                                  |

Still absent: a search controller (`PDFFindController` needs the
`web/pdf_viewer` event bus and DOM) and TextLayer / AnnotationLayer rendering.

## Native Viewer (Phase 4)

Everything that imports `@features/pdf/engine` lives in `features/pdf/native/`
plus `features/pdf/ui/components/NativePdfViewer.tsx`. Asserted by
`pdfjs-dual-runtime.test.ts`, together with the inverse: no
`@react-pdf-viewer` import specifier and no `rpv-*` string in that boundary.

| File                         | Responsibility                                                          |
| ---------------------------- | ----------------------------------------------------------------------- |
| `nativePdfViewerFlag.ts`     | `VITE_NATIVE_PDF_VIEWER`; only the exact string `true` opts in          |
| `nativePdfBounds.ts`         | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*` |
| `useNativeCoalescedScale.ts` | numeric rAF-coalesced zoom channel, latest wins                         |
| `useNativePdfEngine.ts`      | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount |
| `useNativePdfDocument.ts`    | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size             |
| `useNativePdfPageState.ts`   | 1-based clamped `currentPage`, previous/next/jump                       |
| `useNativePdfScaleState.ts`  | numeric clamped `scale`, fit once per document identity                 |
| `useNativePdfRender.ts`      | one page → one canvas, supersede-cancel                                 |
| `useNativePdfController.ts`  | composition + the toolbar contract                                      |
| `nativeZoomControls.tsx`     | render-prop zoom components for the shared toolbar                      |

Invariants worth knowing before changing it:

- **Effect order matters once.** The engine-creating effect is declared before the
  document-loading effect; the engine must exist when the document hook runs.
- **Page indexing is 1-based.** Only RPV's `onPageChange` is 0-based, and the
  native path has no such callback. `clampPdfPage` upper-bounds only once
  `totalPages` is known, because the resume flow restores a page first.
- **`PageWidth` becomes a number.** Fit scale comes from the shared `useFitScale`
  with the shared `adjustedContainerSize` returned by `usePdfViewerState`. The
  fit is keyed on document identity so `fit → render → resize → fit` cannot loop.
- **Zoom is one change per frame** through `useNativeCoalescedScale`; every source
  is clamped by `clampPdfScale`.
- **Cancellation is not an error.** `RenderingCancelledException` is dropped;
  genuine failures become `renderError`.
- **First render of a document is at scale 1** and superseded one frame later by
  the fit. Deliberate — see the plan; not a bug.
- **DPR is not applied.** `canvas.width/height` = viewport size, 1:1 with CSS px.

Reused unchanged from the legacy path: `useFitScale`, `useContainerSize`,
`useLastNavigationTime`, `usePdfWheelNavigation`, `usePdfCtrlWheelZoom`,
`usePdfResizeRefit`, `PdfToolbar`, `PdfZoomControls`, `PdfPageNav`,
`InlineSpinner`, `onReadingProgressChange`.

## Worker Architecture

|           | Legacy                                   | Native                                 |
| --------- | ---------------------------------------- | -------------------------------------- |
| Specifier | `pdfjs-dist/build/pdf.worker.min.js?url` | `pdfjs-6/build/pdf.worker.min.mjs?url` |
| Owner     | `ui/components/PdfWorkerHost.tsx`        | `engine/pdfWorker.ts`                  |
| Strategy  | `<Worker workerUrl>` (RPV)               | `GlobalWorkerOptions.workerSrc`        |
| Emitted   | `pdf.worker.min-<hash>.js`, ~1 062 kB    | `pdf.worker.min-<hash>.mjs`, ~1 235 kB |

Both are emitted by the normal `npm run build:renderer:electron` build — the check
Phase 3B could not make. Each chunk carries only its own version string
(`3.11.174` / `6.4.299`) and references only its own worker asset.

## Asset Packaging

Staged from `node_modules/pdfjs-6` into `dist/pdfjs/` by an inline Vite plugin
(`pdfjsAssets()` in `vite.config.mts`) using only Node built-ins — **no new
dependency**. `cmaps/` 169 · `standard_fonts/` 16 · `wasm/` 13 · `iccs/` 2 = 200
files, 3.36 MB.

Chunks: `vendor-pdf-legacy` (3.x + RPV, ~459 kB) and `vendor-pdf-native` (6.x,
~437 kB).

`useWorkerFetch` is deliberately **not** set: PDF.js 6 derives it via
`isValidFetchUrl` (true over http, false over `file://`), and `fetchData` falls
back to `XMLHttpRequest` accepting `status === 0` for `file://`.

## Security State

Reported per runtime — they are **not** one package. Unchanged by Phase 4.

**Legacy runtime — `pdfjs-dist@3.11.174` (shipped via RPV)**

- `isEvalSupported: false` on both 3.x `getDocument` call sites
  (`ui/components/PdfViewerElement.tsx`, `lib/renderPageToImage.ts`)
- advisory **still reported**: `GHSA-wgrm-67xf-hhpq` / `CVE-2024-4367`, high,
  range `<=4.1.392`
- `security/audit-exceptions.json` exception **still required and unchanged** —
  same advisory ids, `installed: 3.11.174`, `expires: 2026-12-31`

**Native runtime — `pdfjs-6` / `pdfjs-dist@6.4.299`**

- `enableScripting: false` on every native `getDocument` path, via a narrow local
  intersection (no `as any`)
- `isEvalSupported` **not passed** — removed in 4.x
- advisory: **none**; no exception needed, none added

## Critical Invariants

1. The existing RPV viewer must remain functional until native feature parity.
2. Legacy viewer sources import `pdfjs-dist` **only**.
3. The native engine imports `pdfjs-6` **only**.
4. The two `GlobalWorkerOptions` namespaces stay isolated — different objects.
5. Workers are never shared across runtimes; no `workerPort` on either namespace.
6. The native engine never mutates the legacy PDF.js namespace.
7. Native PDF JavaScript execution stays disabled (`enableScripting: false`).
8. The native engine contains no React / UI / zustand / RPV dependencies.
9. Only `features/pdf/native/**` + `NativePdfViewer.tsx` import
   `@features/pdf/engine`; none of them import `@react-pdf-viewer`.
10. `VITE_NATIVE_PDF_VIEWER` defaults to off, and only the exact string `true`
    enables it.
11. `isEvalSupported: false` stays on the legacy call sites while 3.x is shipped.
12. Do **not** remove the CVE exception while vulnerable 3.x remains shipped — it
    goes stale only when 3.11.174 leaves the tree.
13. Phase 2 regression suites stay green — they are the safety net for every
    later phase.
14. The two runtimes stay in separate bundle chunks.

## Regression Baseline

Last verified in Phase 4, after all code changes. Run `npm test` to reproduce.

```
Full suite:  352 test files · 3799 passed · 2 skipped · 0 failed
```

The 2 skips are pre-existing (Electron `ConfigManager`). By area:
`src/__tests__/features/pdf/**` = 55 files / 568 tests (incl. 6 native files);
`src/__tests__/architecture/**` = 5 files / 84 tests.

Static gates green at Phase 4: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `ci:check-hygiene`, `check:audit`,
`check:electron-security`, `git diff --check`.

Build: `npm run build:renderer:electron` succeeds, emitting **both** workers,
`vendor-pdf-legacy`, `vendor-pdf-native` and the full `dist/pdfjs/` tree.

## Known Issues and Technical Debt

1. **Pixel budget enforced only to a rounding epsilon.** `renderPageToImage.ts`
   derives the ratio from the rounded viewport, then rounds again without
   re-checking: A0 at scale 4 / 20 MP yields 20 001 639 px (0.008 % over). Phase 2
   tests allow a 0.1 % tolerance; a rewrite that re-checks is not strictly
   behaviour-preserving.
2. **The `anchorNode.isConnected` guard in `usePdfTextActions.ts` is nearly dead
   code** — observable only for a non-collapsed range with empty text.
3. **PDF.js 6 removed `PDFDocumentProxy.destroy()`**; the proxy exposes only
   `cleanup()`, so teardown must go through `PDFDocumentLoadingTask.destroy()`. The
   engine and the native viewer already do. `renderPageToImage.ts` still calls
   `destroy()` on the document — correct for 3.11.174, keep until the viewer is
   gone.
4. **PDF.js 6 types `DocumentInitParameters.url` as `string | URL` only.**
5. **`scrollbar-gutter-stable`** is applied in `PdfViewerDocument.tsx` but has no
   definition anywhere. Dead class.
6. **Native canvas is not DPR-aware** — 1:1 with CSS pixels on HiDPI. Deferred
   with the capture high-DPI work.
7. **Native path renders once at scale 1 before the fit commits** (one frame,
   cancelled mid-flight). Documented, not fixed; fixing it would add a fragile
   cross-hook ordering dependency.

## Temporary Migration Components

- the `pdfjs-6` alias in `package.json`
- the `vendor-pdf-native` / `vendor-pdf-legacy` chunk split in `vite.config.mts`
- the `pdfjsAssets()` plugin that stages `dist/pdfjs/` from `node_modules/pdfjs-6`
- `pdfjs-dual-runtime.test.ts` and the legacy half of
  `pdfjs-engine-worker-coupling.test.ts`
- `isEvalSupported: false` on the 3.x call sites
- `VITE_NATIVE_PDF_VIEWER` and `features/pdf/native/**` + `NativePdfViewer.tsx`
- `nativeCanvasMode` / `textLayerActionsDisabled` on `PdfToolbar` /
  `PdfAiQuickBar` (the native-mode bounding, deleted with the native path)

## Important Decisions

**Dual PDF.js runtime (Option B).** _Reason:_ `@react-pdf-viewer@3.12.0` cannot
render against PDF.js 6; a single-version upgrade would leave the app with no
working PDF viewer until Phase 8. _Removal condition:_ native feature parity
(Phase 8). _Cost:_ two runtimes in the bundle.

**Build-time flag, read at call time.** _Reason:_ the shipped renderer must not
change by accident, and `import.meta.env` read inside a function keeps one code
path across dev / build / packaged app and stays testable without a build.

**Feature switch at the top of `PdfViewerDocument`, not inside `PdfViewerElement`.**
_Reason:_ keeps `PdfViewerElement.tsx` at zero diff and leaves both paths whole.

**Controller always mounted, inert when the flag is off.** _Reason:_ hooks cannot
be conditional; passing `enabled` keeps hook order stable while guaranteeing no
engine, no load and no listeners on the legacy path.

**Separate `useNativeCoalescedScale`.** _Reason:_ `useCoalescedZoom` is typed to
RPV's `zoomTo`. Widening it would put an RPV type in the native path and change a
Phase 2-pinned file for no gain. _Removal:_ delete it with the rest.

**Narrowed `usePdfCtrlWheelZoom.ZoomTo`, additive `usePdfResizeRefit` parameter.**
_Reason:_ both hooks needed a numeric channel to be reachable from a numeric-only
caller; contravariance keeps the legacy call sites assignable and the default
fallback keeps them behaviour-identical. _Alternative rejected:_ a numeric clone
of the resize refit, which would have duplicated the 150 ms debounce and the
navigation lock.

**Toolbar adapter instead of a toolbar rewrite.** _Reason:_ the render-prop
contract is small and already abstracted; supplying it reuses the existing
buttons, readout and tooltips instead of duplicating markup inside the toolbar.

**Native zoom components rebuilt on scale change.** _Reason:_ `PdfToolbar` and
`PdfZoomControls` are memoised; without it the percentage readout would not
re-render on zoom.

**Bound unsupported controls instead of hiding or faking them.** _Reason:_ search,
selection, page text and capture have no native implementation. Reload stays live
because it maps onto a real native lifecycle.

**DPR left alone.** _Reason:_ it needs its own proof and belongs with the capture
high-DPI work; changing the renderer quietly would widen the phase.

## Files and Areas That Must Not Be Changed Yet

Zero diff is the expected state for all of these in any phase that is not the one
explicitly requested.

- `src/features/pdf/ui/components/{PdfViewerElement,PdfWorkerHost}.tsx`
- `src/features/pdf/ui/hooks/usePdfPlugins.ts`
- `src/features/pdf/lib/{renderPageToImage,activePdfDocumentRegistry,pdfViewerDom}.ts`
- `src/features/pdf/{capture,text,interaction}/**`
- `src/features/pdf/store/**` and `hooks/{readingHistoryRepository,useReadingProgressPersistence,usePdfNavigation,usePdfViewerZoomOrchestrator,usePdfViewerEffects}.ts`
- `src/features/pdf/viewport/useCoalescedZoom.ts`, `usePdfWheelNavigation.ts`
- `src/shared/styles/**` (all PDF viewer CSS)
- `security/audit-exceptions.json`
- any `@react-pdf-viewer/*` usage

## Git State

```
Branch: refactor/native-pdfjs-viewer  (tracks origin, fast-forward only)
Base:   master — 5a47228b3d784951ce63e1da30746ce20cadffd0
Ahead of master: 0 behind
```

Phase commits, oldest first:

```
b4bd443 docs(pdf): baseline native pdfjs viewer migration
d277420 test(pdf): lock selection, pan, zoom and search highlight behavior
d0564f7 docs(pdf): record phase 3 blocker in the pdfjs 6 upgrade
aef4bb8 chore(pdf): add isolated pdfjs 6 migration runtime
f3d68c8 feat(pdf): add native pdfjs engine foundation
d04e8a3 test(pdf): enforce dual-runtime isolation
fd886b4 docs(agent): add repository handoff context
```

`master` remains a working RPV + pdfjs 3.x build throughout, so rollback is
"stop shipping the branch", not "reconstruct the old viewer". Do not merge to
master, tag, release or bump the version until the migration completes.

## Next Phase

**Phase 5 — text layer + selection.** First capability on top of the canvas the
native viewer already renders.

- add a `TextLayer` rendered by the native viewer, owned by the native boundary,
  with a lifecycle as explicit as the renderer's (create on page change, tear down
  on supersede/unmount)
- retarget `text/extractPageTextFromDom.ts` and `text/extractSelectedText.ts` at
  the native markup; keep the strict `> 12 MP` serialization threshold and the
  normalization rules verbatim
- wire `text/usePdfTextActions.ts` to the native selection surface: selection
  change listener, the 150 ms scroll freeze, rAF coalescing,
  `pdf-selection-active`, `requestIdleCallback` with the 500 ms fallback
- the Phase 2 selection suite must pass **unchanged** — that is the exit criterion
- enable the "send selection / page text to AI" toolbar actions on the native
  path and drop them from the `nativeCanvasMode` bounding
- keep `renderPageToImage.ts`, the capture pipeline and `activePdfDocumentRegistry`
  on the legacy path; capture migration is a later phase

Phase 5 must **not** touch the annotation layer, links, search, capture,
`activePdfDocumentRegistry`, context menu, or any CSS.

## Do Not Do Yet

- Do not remove `@react-pdf-viewer`, `pdfjs-dist` 3.x, or the legacy override.
- Do not collapse the dual runtime, remove the `pdfjs-6` alias, or rename
  `vendor-pdf-native`.
- Do not migrate the annotation layer, links, search, or the capture pipeline.
- Do not touch `activePdfDocumentRegistry` or the reading-progress architecture.
- Do not remove the CVE-2024-4367 exception, extend its expiry, or drop
  `isEvalSupported: false` from the legacy call sites.
- Do not delete `usePdfPlugins`, `PdfViewerElement` or `PdfWorkerHost`.
- Do not change PDF viewer CSS, or remove `.npmrc` / `legacy-peer-deps`.
- Do not modify Phase 2 regression expectations to make new code pass.
- Do not enable the native viewer by default.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is
   dirty or master has advanced.
3. Compare repository state against this file; where they conflict the repository
   wins.
4. Read `docs/pdfjs-migration-plan.md` for the detail the current phase needs —
   especially the phase table and the Phase 3B / Phase 4 sections.
5. Read the implementation files relevant to the requested phase:
   `src/features/pdf/native/*`, `src/features/pdf/engine/*`, plus the legacy viewer
   files it must not disturb.
6. Execute **only** the explicitly requested phase.
7. Run `npm test` plus the static gates; update this file before finishing.

## Handoff Maintenance Rules

- Every agent MUST read this file before modifying the repository.
- Every agent MUST update this file before finishing a completed phase.
- Do not append an execution diary. Rewrite stale state instead of accumulating
  contradictory history.
- Keep completed phases concise.
- Keep Current State, Security State, Known Issues, Git State and Next Phase
  current.
- Repository + Git + test/build results override this document if they conflict.
- `docs/pdfjs-migration-plan.md` holds the deep technical migration detail; do not
  duplicate it here.
- Do not record secrets, tokens, credentials or machine-specific paths here.
