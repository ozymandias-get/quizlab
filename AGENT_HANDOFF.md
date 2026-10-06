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

| Field                       | Value                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| Branch                      | `refactor/native-pdfjs-viewer` (base: `master`)                                  |
| Current phase               | Phase 3B complete — **Phase 4 (canvas + page/scale state) not started**          |
| Last completed phase        | Phase 3B — dual-runtime native engine foundation                                 |
| Current HEAD                | run `git rev-parse HEAD`                                                         |
| Last completed phase commit | `d04e8a310b30c23141ada24ca77d8d308e61390c`                                       |
| Working tree                | clean at last commit                                                             |
| Base SHA at Phase 3B        | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                       |
| Readiness                   | **ready for Phase 4** — engine exists and is tested, but nothing consumes it yet |

There is no native viewer. The shipped PDF experience is still
`@react-pdf-viewer`. The native engine is built, tested and wired into the build
pipeline, but deliberately unreachable from the UI.

## Current Goal

Replace `@react-pdf-viewer` with a native `pdfjs-dist` 6.x viewer **without ever
leaving the shipped app without a working PDF reader**. Phases 1–3B established the
baseline, the regression safety net and the dual runtime needed to build the new
engine in parallel. Phase 4 onward consumes that engine one layer at a time.

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
all reverted).

| Area             | What is pinned                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| capture          | active-document reuse, borrowed proxy never destroyed, destroyed-proxy eviction, self-load + `finally` destroy, pixel budget for both call sites, the five-rung fallback ladder, `toBlob` → null |
| selection        | capture-phase listeners, out-of-container and detached-anchor selectionchange, the 150 ms scroll lock, rAF coalescing, `pdf-selection-active`, `requestIdleCallback` vs 500 ms fallback          |
| pan              | primary-button-only drag, pointer capture/release lifecycle, scrollable-ancestor resolution, `INNER_CONTAINER_SELECTOR` fallback, cleanup                                                        |
| Ctrl+wheel zoom  | `{ passive: false, capture: true }`, modifiers, clamps, pan suppression, the 40 ms throttle                                                                                                      |
| search highlight | `safeRenderHighlights` geometry, guards, `pdf-highlight-fadein`, `prefers-reduced-motion`                                                                                                        |
| serialization    | the strict `>` 12 MP JPEG threshold at boundary cases                                                                                                                                            |

### Phase 3 — Single-Version Attempt

**Single pdfjs 6 replacement attempt BLOCKED.** Not an implementation.

`@react-pdf-viewer@3.12.0` calls two APIs PDF.js 4.x removed — `renderTextLayer()`
(on its **per-page text-layer hot path**) and `new SVGGraphics()`. Measured
against installed 6.4.299:
`{ "version": "6.4.299", "missing": ["renderTextLayer", "SVGGraphics"] }`. Every
page render would throw and `onRenderTextCompleted()` would never fire, killing
"send selection to AI" and "send page text to AI". Two further blockers: the build
fails because `pdf.worker.min.js` no longer exists, and `isEvalSupported` no longer
type-checks. The dependency change was reverted (commit `d0564f7`).

### Phase 3B — Dual-Runtime Native Engine Foundation

Temporary dual-runtime architecture implemented successfully. `pdfjs-6` alias
added, engine created, assets packaged, security posture split per runtime,
isolation enforced by tests. No viewer or UI file touched.

## Current PDF Architecture

```
PdfViewer → PdfViewerDocument → usePdfViewerState → PdfViewerElement
  → @react-pdf-viewer <Viewer> → require('pdfjs-dist') → pdfjs-dist@3.11.174
     LEGACY, SHIPPED. Worker fed by PdfWorkerHost.
  → capture / text / search / pan / zoom / context menu
```

Phase 2 tests lock this. `lib/pdfViewerDom.ts` is the single owner of the
viewer's private DOM (5 selectors). All AI features — selection, page text,
high-DPI screenshot, page → PNG — run on top of the legacy viewer.

## Dependency State

| Entry                     | Value                                           | Role                                        |
| ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `pdfjs-dist`              | `3.11.174` (exact)                              | **legacy / RPV runtime**                    |
| `overrides["pdfjs-dist"]` | `3.11.174`                                      | keeps the legacy pin exact                  |
| `pdfjs-6`                 | `npm:pdfjs-dist@6.4.299`                        | **native migration runtime** (alias, exact) |
| `@react-pdf-viewer/*`     | `^3.12.0` (core, page-navigation, search, zoom) | legacy viewer                               |

Verified on disk: 3.11.174 / 6.4.299 / 3.12.0. The `overrides` entry does **not**
hijack the alias (npm keys overrides by dependency name). Lockfile churn when
the alias was added: +279 / −0, purely additive.

`.npmrc` contains `legacy-peer-deps=true`; it suppresses the RPV peer
`ERESOLVE` and is not to be removed before the viewer is deleted.

## Temporary Migration Architecture

> **TEMPORARY.** Two PDF.js runtimes are installed so the native engine can be
> built while the shipped viewer keeps working. Scaffolding, not the target.

```
LEGACY (shipped)                    NATIVE (not yet wired to UI)
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

After native viewer feature parity (end of Phase 8):

1. delete `@react-pdf-viewer/{core,page-navigation,search,zoom}`
2. delete `PdfWorkerHost` and the legacy `pdf.worker.min.js?url` import
3. delete `vendor-pdf-legacy`; rename `vendor-pdf-native` back to `vendor-pdf`
4. delete `pdfjs-dist@3.11.174` and its `overrides` entry
5. delete the `pdfjs-6` alias; make `pdfjs-dist` the direct `6.4.299` pin
6. rewrite engine imports `pdfjs-6` → `pdfjs-dist`
7. delete `pdfjs-dual-runtime.test.ts`; rescope or delete the legacy half of
   `pdfjs-engine-worker-coupling.test.ts` (peer-range rows become meaningless)
8. delete the `CVE-2024-4367` exception and the `isEvalSupported: false` sites
9. point asset staging at `node_modules/pdfjs-dist` instead of `node_modules/pdfjs-6`

Only steps 6 and 9 touch engine source; everything else is deletion.

## Native PDF Engine

`src/features/pdf/engine/` — 6 files, no React / DOM / UI / zustand / RPV
imports (asserted by test). Direction is `UI → engine → pdfjs-6`.

| File                    | Responsibility                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pdfWorker.ts`          | publishes `pdfjs-6.GlobalWorkerOptions.workerSrc` once; exports the resolved `.mjs` URL                            |
| `pdfDocumentOptions.ts` | the single authoritative `getDocument` parameter builder: scripting + asset policy                                 |
| `documentManager.ts`    | owns the `PDFLoadingTask`; load / reload / getDocument / getPage / destroy, generation-based stale-load protection |
| `pageCache.ts`          | page number → `PDFPageProxy`; clearable, rejected lookups not cached                                               |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, supersede-cancel, typed cancellation                            |
| `index.ts`              | barrel; the only entry point consumers should use                                                                  |

Deliberately absent: a search controller (`PDFFindController` needs the
`web/pdf_viewer` event bus and DOM — belongs to the viewer phase) and
TextLayer / AnnotationLayer rendering.

`PdfDocumentSource` derives from `getDocument`'s own signature rather than
deep-importing a type: the root type entry does not re-export
`DocumentInitParameters` and there is no `exports` map.

## Worker Architecture

|           | Legacy                                   | Native                                 |
| --------- | ---------------------------------------- | -------------------------------------- |
| Specifier | `pdfjs-dist/build/pdf.worker.min.js?url` | `pdfjs-6/build/pdf.worker.min.mjs?url` |
| Owner     | `ui/components/PdfWorkerHost.tsx`        | `engine/pdfWorker.ts`                  |
| Strategy  | `<Worker workerUrl>` (RPV)               | `GlobalWorkerOptions.workerSrc`        |
| Emitted   | `pdf.worker.min-<hash>.js`, 1 062 KB     | `pdf.worker.min-<hash>.mjs`, 1 264 KB  |

`workerSrc` was chosen over `workerPort`: the latter moves the whole Worker
lifetime into our code and pdf.js would no longer own the global worker.
`workerSrc` already provides the "one worker per runtime" invariant and is the
mechanism the legacy path proves works.

The native worker is not yet in the app bundle because nothing imports the engine.
It was verified to resolve and emit via an isolated Vite build importing
`engine/`. Once Phase 4 adds a consumer, the normal build should emit **both**
workers — that is the check to run.

## Asset Packaging

Staged from `node_modules/pdfjs-6` into `dist/pdfjs/` by an inline Vite plugin
(`pdfjsAssets()` in `vite.config.mts`) using only Node built-ins — **no new
dependency**. Serves from `node_modules` in dev (`configureServer`), copies in
build (`closeBundle`, which runs after `emptyOutDir`, so no staleness).

| Directory         | Files   | Size                                             |
| ----------------- | ------- | ------------------------------------------------ |
| `cmaps/`          | 169     | 1.11 MB                                          |
| `standard_fonts/` | 16      | 0.76 MB                                          |
| `wasm/`           | 13      | 1.47 MB (jbig2, openjpeg, qcms_bg, quickjs-eval) |
| `iccs/`           | 2       | ~10 kB                                           |
| **total**         | **200** | **3.36 MB**                                      |

Chunks are split so neither runtime can be deleted by accident:
`vendor-pdf-legacy` (3.x + RPV) and `vendor-pdf-native` (6.x).

`useWorkerFetch` is deliberately **not** set: PDF.js 6 derives it via
`isValidFetchUrl` (true over http, false over `file://`), and `fetchData` falls
back to `XMLHttpRequest` accepting `status === 0` for `file://`. Asset URLs come
from `import.meta.env.BASE_URL` (`'./'` in a production build), so the same
options work in dev, production build and packaged Electron.

## Security State

Reported per runtime — they are **not** one package.

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
9. `isEvalSupported: false` stays on the legacy call sites while 3.x is shipped.
10. Do **not** remove the CVE exception while vulnerable 3.x remains shipped — it
    goes stale only when 3.11.174 leaves the tree.
11. Phase 2 regression suites stay green — they are the safety net for every
    later phase.
12. The two runtimes stay in separate bundle chunks.

## Regression Baseline

Last verified in Phase 3B, after all code changes. Run `npm test` to reproduce.

```
Full suite:  346 test files · 3728 passed · 2 skipped · 0 failed
```

The 2 skips are pre-existing (Electron `ConfigManager`). By area:
`src/__tests__/features/pdf/**` = 49 files / 502 tests (incl. 5 engine files);
`src/__tests__/architecture/**` = 5 files / 78 tests.

Static gates green at Phase 3B: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `ci:check-hygiene`, `check:audit`,
`check:electron-security`, `git diff --check`.

Build: `npm run build:renderer:electron` succeeds, emitting the legacy worker,
`vendor-pdf-legacy` and the full `dist/pdfjs/` tree.

## Known Issues and Technical Debt

Still present and verified in the current tree. None are fixed — they were pinned
by tests instead.

1. **Pixel budget enforced only to a rounding epsilon.** `renderPageToImage.ts`
   derives the ratio from the rounded viewport, then rounds again without
   re-checking: A0 at scale 4 / 20 MP yields 20 001 639 px (0.008 % over). Phase 2
   tests allow a 0.1 % tolerance; a rewrite that re-checks is not strictly
   behaviour-preserving.
2. **The `anchorNode.isConnected` guard in `usePdfTextActions.ts` is nearly dead
   code** — observable only for a non-collapsed range with empty text. Do not
   treat it as load-bearing.
3. **PDF.js 6 removed `PDFDocumentProxy.destroy()`**; the proxy exposes only
   `cleanup()`, so teardown must go through `PDFDocumentLoadingTask.destroy()`. The
   engine already does. `renderPageToImage.ts` still calls `destroy()` on the
   document — correct for 3.11.174, keep until the viewer is gone.
4. **PDF.js 6 types `DocumentInitParameters.url` as `string | URL` only** — binary
   source variants are gone; they would move to `data`.
5. **`scrollbar-gutter-stable`** is applied in `PdfViewerDocument.tsx` but has no
   definition anywhere. Dead class; the effect comes from `_pdf-viewer.css`.

## Temporary Migration Components

- the `pdfjs-6` alias in `package.json`
- the `vendor-pdf-native` / `vendor-pdf-legacy` chunk split in `vite.config.mts`
- the `pdfjsAssets()` plugin that stages `dist/pdfjs/` from `node_modules/pdfjs-6`
- `pdfjs-dual-runtime.test.ts` and the legacy half of
  `pdfjs-engine-worker-coupling.test.ts`
- `isEvalSupported: false` on the 3.x call sites

## Important Decisions

**Dual PDF.js runtime (Option B).** _Reason:_ `@react-pdf-viewer@3.12.0` cannot
render against PDF.js 6; a single-version upgrade would leave the app with no
working PDF viewer until Phase 8. _Removal condition:_ native feature parity
(Phase 8). _Cost:_ two runtimes in the bundle, 448 KB legacy vendor chunk.

**`workerSrc` over `workerPort`.** _Reason:_ `workerPort` would move the Worker's
whole lifetime into our code and pdf.js would no longer own the global worker.
_Removal condition:_ none — this is the final approach too.

**Inline Vite plugin for asset staging.** _Reason:_ committing 3.4 MB of
vendored binaries to `public/`, or adding a copy plugin for one directory, were
both worse than ~40 lines of Node built-ins.

**Leave `useWorkerFetch` unset.** _Reason:_ PDF.js 6 computes it scheme-aware and
correctly for both the http dev server and the `file://` packaged app; pinning it
would break one of them.

**No `searchController` in Phase 3B.** _Reason:_ `PDFFindController` requires the
viewer event bus and DOM, which would drag viewer concerns into the engine.

## Files and Areas That Must Not Be Changed Yet

Zero diff is the expected state for all of these in any phase that is not the one
explicitly requested.

- `src/features/pdf/ui/**` — legacy viewer shell
- `src/features/pdf/lib/{renderPageToImage,activePdfDocumentRegistry,pdfViewerDom}.ts`
- `src/features/pdf/{capture,text,interaction,viewport,hooks,store}/**`
- `src/shared/styles/**` (all PDF viewer CSS)
- `security/audit-exceptions.json`
- any `@react-pdf-viewer/*` usage

## Git State

```
Branch: refactor/native-pdfjs-viewer  (tracks origin, fast-forward only)
Base:   master — 5a47228b3d784951ce63e1da30746ce20cadffd0
Phase 3B: d04e8a310b30c23141ada24ca77d8d308e61390c
Ahead of master: 7 commits, 0 behind
```

Phase commits, oldest first:

```
b4bd443 docs(pdf): baseline native pdfjs viewer migration
d277420 test(pdf): lock selection, pan, zoom and search highlight behavior
d0564f7 docs(pdf): record phase 3 blocker in the pdfjs 6 upgrade
aef4bb8 chore(pdf): add isolated pdfjs 6 migration runtime
f3d68c8 feat(pdf): add native pdfjs engine foundation
d04e8a3 test(pdf): enforce dual-runtime isolation
```

`master` remains a working RPV + pdfjs 3.x build throughout, so rollback is
"stop shipping the branch", not "reconstruct the old viewer". Do not merge to
master, tag, release or bump the version until the migration completes.

## Next Phase

**Phase 4 — canvas + page/scale state.** The first consumer of the native engine.
Authoritative detail is the phase table in `docs/pdfjs-migration-plan.md`.

- add the native viewer component as the **only** file importing
  `@features/pdf/engine`; it owns one `createPdfDocumentManager()` and one
  `createPageRenderer()` per mounted document and destroys both on unmount
- render the current page only (mirror `ViewMode.SinglePage`) via
  `createPageRenderer().renderPage()`, sized from the viewport
- port zoom/page ownership: the native path owns its own scale state, so
  re-create the rAF-coalesced zoom channel to keep the one-zoom-per-frame
  invariant that suppresses `RenderingCancelledException`
- feature-flag the switchover so the legacy `<Viewer>` stays the default
- verify: `npm run build:renderer:electron` should now emit **both** workers
  (legacy `.js` and native `.mjs`) — the check that could not be made in Phase 3B;
  then `npm test` and a manual pass over open/close, tab switch, page navigation,
  zoom, fit and reload

Phase 4 must **not** touch the text layer, annotation layer, links, search,
capture pipeline, selection, progress persistence, `activePdfDocumentRegistry`, or
any CSS.

## Do Not Do Yet

- Do not remove `@react-pdf-viewer`, `pdfjs-dist` 3.x, or the legacy override.
- Do not collapse the dual runtime, remove the `pdfjs-6` alias, or rename
  `vendor-pdf-native`.
- Do not migrate TextLayer, AnnotationLayer/links, search, or selection.
- Do not touch the capture pipeline or `activePdfDocumentRegistry`.
- Do not remove the CVE-2024-4367 exception, extend its expiry, or drop
  `isEvalSupported: false` from the legacy call sites.
- Do not delete `usePdfPlugins`, `PdfViewerElement` or `PdfWorkerHost`.
- Do not change PDF viewer CSS, or remove `.npmrc` / `legacy-peer-deps`.
- Do not modify Phase 2 regression expectations to make new code pass.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is
   dirty or master has advanced.
3. Compare repository state against this file; where they conflict the repository
   wins.
4. Read `docs/pdfjs-migration-plan.md` for the detail the current phase needs —
   especially the phase table and the Phase 3B section.
5. Read the implementation files relevant to the requested phase:
   `src/features/pdf/engine/*`, plus the legacy viewer files it must not disturb.
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
