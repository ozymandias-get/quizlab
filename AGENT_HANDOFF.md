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
| Current phase        | Phase 5 complete — **Phase 6 not started**                                             |
| Last completed phase | Phase 5 — native TextLayer + selection + AI text actions                               |
| Current HEAD         | run `git rev-parse HEAD`                                                               |
| Working tree         | clean at last commit                                                                   |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                             |
| Readiness            | **ready for Phase 6** — the native viewer is reachable behind `VITE_NATIVE_PDF_VIEWER` |

Phase 4's manual smoke was recorded as outstanding because the Phase 4 agent had
no interactive environment. The user has since **manually exercised the Phase 4
native viewer in the real application and reported no visible issue**. That
closes the only open Phase 4 item; nothing wider is claimed from it — interactive
native verification starts again at Phase 5's own smoke list below.

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
untouched; the normal build now emits **both** PDF.js workers. **Manual smoke:
resolved by user manual validation** — the native viewer was exercised in the
real application with no visible issue reported.

### Phase 5 — Native Text Layer + Selection

PDF.js 6's own `TextLayer` now renders the selectable text geometry for the
current page over the native canvas, in the native boundary. The legacy
extractors resolve either markup, `usePdfTextActions` is untouched, and both AI
text actions work on the native path. Annotation layer, links, search, capture and
`activePdfDocumentRegistry` remain legacy-only. **Phase 2's selection suite passes
byte-identical** — that was the exit criterion.

## Current PDF Architecture

```
PdfViewer → PdfViewerDocument → usePdfViewerState
   │
   ├─ flag OFF (default) → PdfViewerElement → @react-pdf-viewer <Viewer>
   │                        → require('pdfjs-dist') → pdfjs-dist@3.11.174
   │                        LEGACY, SHIPPED. Worker fed by PdfWorkerHost.
   │                        → capture / search / pan / zoom / context menu
   │                        → text: RPV TextLayer read by text/**
   │
   └─ flag ON  (VITE_NATIVE_PDF_VIEWER=true) → NativePdfViewer
                             → useNativePdfController → @features/pdf/engine
                             → pdfjs-6 → pdfjs-dist@6.4.299
                             canvas + PDF.js TextLayer; text: native TextLayer
```

One `ResizeObserver`, one `containerRef`, one toolbar. Page nav, zoom and the
current-scale readout bind to whichever renderer is live. When the flag is off the
legacy zoom/page/resize hooks are inert (`totalPages` stays 0), so exactly one
implementation of each is ever active.

**Text is the one capability both paths share.** `usePdfTextActions` is mounted
once by `usePdfViewerState` against the shared container and is markup-agnostic;
`text/pdfTextLayerSource.ts` resolves whichever text layer is mounted. There is no
native-specific selection hook, and that is deliberate — a second implementation
would be free to drift away from the Phase 2 tests that guard the first.

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
`web/pdf_viewer` event bus and DOM) and AnnotationLayer rendering.

## Native Viewer (Phases 4–5)

Everything that imports `@features/pdf/engine` lives in `features/pdf/native/`
plus `features/pdf/ui/components/NativePdfViewer.tsx`. Asserted by
`pdfjs-dual-runtime.test.ts`, together with the inverse: no
`@react-pdf-viewer` import specifier and no `rpv-*` string in that boundary.

| File                         | Responsibility                                                          |
| ---------------------------- | ----------------------------------------------------------------------- |
| `nativePdfViewerFlag.ts`     | `VITE_NATIVE_PDF_VIEWER`; only the exact string `true` opts in          |
| `nativePdfBounds.ts`         | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*` |
| `nativePdfDom.ts`            | the native markup contract — page / canvas / layer / text-run selectors |
| `nativePdfTextLayer.css`     | PDF.js's text-layer layout contract, scoped to `data-native-pdf-*`      |
| `useNativeCoalescedScale.ts` | numeric rAF-coalesced zoom channel, latest wins                         |
| `useNativePdfEngine.ts`      | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount |
| `useNativePdfDocument.ts`    | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size             |
| `useNativePdfPageState.ts`   | 1-based clamped `currentPage`, previous/next/jump                       |
| `useNativePdfScaleState.ts`  | numeric clamped `scale`, fit once per document identity                 |
| `useNativePdfRender.ts`      | one page → one canvas, supersede-cancel                                 |
| `useNativePdfTextLayer.ts`   | one page → one PDF.js `TextLayer`, supersede-cancel, page-level cache   |
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
- **Cancellation is not an error.** `RenderingCancelledException` (canvas) and
  `AbortException` (text layer) are both dropped; genuine failures become
  `renderError` / `textLayerError`.
- **Canvas and text layer share one viewport.** The layer is built from
  `page.getViewport({ scale })` with the same scale `pageRenderer` used, inside the
  same `[data-native-pdf-page]` box, and `--total-scale-factor` on that box is that
  same number. Recomputing it would misalign every selection highlight.
- **`TextLayer#cancel()` is required, not just the `cancelled` flag.** The flag
  stops _us_; `cancel()` stops PDF.js appending the rest of the stream into a
  container that is about to be reused for another page.
- **`role="presentation"` identifies a text run**, not `span`. PDF.js nests its
  runs in `span.markedContent` on a tagged PDF, and a blanket `span` query would
  count every word twice.
- **`textLayerError` is on the controller but not rendered.** A text-layer failure
  means "readable but not selectable"; hiding a working page to report a degraded
  one is the wrong trade.
- **First render of a document is at scale 1** and superseded one frame later by
  the fit. Deliberate — see the plan; not a bug.
- **DPR is not applied.** `canvas.width/height` = viewport size, 1:1 with CSS px.

Reused unchanged from the legacy path: `useFitScale`, `useContainerSize`,
`useLastNavigationTime`, `usePdfWheelNavigation`, `usePdfCtrlWheelZoom`,
`usePdfResizeRefit`, **`usePdfTextActions`**, `PdfToolbar`, `PdfZoomControls`,
`PdfPageNav`, `InlineSpinner`, `onReadingProgressChange`.

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
~437 kB), plus `viewer-<hash>.css` (~1 kB) carrying only the native text-layer
rules.

`useWorkerFetch` is deliberately **not** set: PDF.js 6 derives it via
`isValidFetchUrl` (true over http, false over `file://`), and `fetchData` falls
back to `XMLHttpRequest` accepting `status === 0` for `file://`.

## Security State

Reported per runtime — they are **not** one package. Unchanged by Phase 5.

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
    later phase. **They still pass byte-identical after Phase 5**; do not edit a
    Phase 2 expectation to make migrated code pass.
14. The two runtimes stay in separate bundle chunks.
15. The native viewer never reaches into `lib/pdfViewerDom.ts`, and the legacy
    adapter never reaches into `nativePdfDom.ts`. Two DOM vocabularies, two files.
16. The native viewer never emits an `rpv-*` class and never reuses one; the
    native stylesheet matches `data-native-pdf-*` only.
17. `usePdfTextActions` stays renderer-agnostic. One selection system, reached
    through the shared container, resolving whichever text layer is mounted.

## Regression Baseline

Last verified in Phase 5, after all code changes. Run `npm test` to reproduce.

```
Full suite:  356 test files · 3851 passed · 2 skipped · 0 failed
```

The 2 skips are pre-existing (Electron `ConfigManager`). By area:
`src/__tests__/features/pdf/**` = 59 files / 620 tests (incl. 10 native files);
`src/__tests__/architecture/**` = 5 files / 89 tests.

**The three Phase 2 selection files are unchanged since Phase 2** —
`usePdfTextActions.test.tsx`, `extractSelectedText.test.ts`,
`extractPageTextFromDom.extended.test.ts`. That is the Phase 5 exit criterion.

Static gates green at Phase 5: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `analyze:css`,
`ci:check-hygiene`, `check:audit`, `check:electron-security`, `git diff --check`.

Build: `npm run build:renderer:electron` succeeds, emitting **both** workers,
`vendor-pdf-legacy`, `vendor-pdf-native`, the native text-layer stylesheet chunk
and the full `dist/pdfjs/` tree. `VITE_NATIVE_PDF_VIEWER=true` produces the same
artifact set.

## Interactive Smoke State

- **Phase 4**: resolved — the user manually exercised the native viewer in the
  real application and reported no visible issue.
- **Phase 5**: **outstanding.** This environment has no interactive session, so
  the native text layer has never been looked at in a real browser. jsdom has no
  layout, which means the automated coverage proves the contract and the
  lifecycle but _cannot_ prove that a selection highlight lands on the right
  glyph. The manual checklist is in the migration plan's Phase 5 section; the
  highest-value items are selection alignment against the canvas at 100 % / 150 %
  / fit, `Ctrl+C` out of the native layer, pan ⇄ text switching, and a text-dense
  page watched for UI lock.

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
8. **`TextLayer#update()` is unused.** Every zoom rebuilds the whole layer
   (thousands of spans) instead of relaying out the existing ones. Correct and
   supersede-safe, but it is the obvious next optimisation once the native path
   has been measured.
9. **`nativePdfTextLayer.css` is a new build pattern.** Component-local CSS
   imported for its side effect; it needed `declare module '*.css'` in
   `src/types/assets.d.ts`. It ships as its own chunk (`viewer-<hash>.css`), so it
   loads with the viewer rather than in the global sheet.

## Temporary Migration Components

- the `pdfjs-6` alias in `package.json`
- the `vendor-pdf-native` / `vendor-pdf-legacy` chunk split in `vite.config.mts`
- the `pdfjsAssets()` plugin that stages `dist/pdfjs/` from `node_modules/pdfjs-6`
- `pdfjs-dual-runtime.test.ts` and the legacy half of
  `pdfjs-engine-worker-coupling.test.ts`
- `isEvalSupported: false` on the 3.x call sites
- `VITE_NATIVE_PDF_VIEWER` and `features/pdf/native/**` + `NativePdfViewer.tsx`
- `nativeCanvasMode` / `captureActionsDisabled` on `PdfToolbar` /
  `PdfAiQuickBar` (the native-mode bounding; after Phase 5 it covers only capture,
  and it goes with the native path)
- the `*.css` module declaration in `src/types/assets.d.ts` (only user:
  `nativePdfTextLayer.css`)

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

**Bound unsupported controls instead of hiding or faking them.** _Reason:_ search
and capture have no native implementation. Reload stays live because it maps onto a
real native lifecycle. _Phase 5 narrowing:_ the bounding used to cover the AI text
actions too; it now covers **only** capture, because the text layer exists.

**DPR left alone.** _Reason:_ it needs its own proof and belongs with the capture
high-DPI work; changing the renderer quietly would widen the phase.

**PDF.js renders the text layer; QuizLab renders the behaviour around it.**
_Reason:_ a text layer is glyph geometry — per-run font transforms, `--scale-x`
stretching against measured advance, rotation, bidi, ascent compensation,
`markedContent` nesting — and browser selection plus `Ctrl+C` are only correct if
that geometry is real. _Alternative rejected:_ placing the words approximately and
relying on the `selection.toString()` fallback; that is a rewrite, not a
migration, and it would have broken exactly the multi-column reading order the
Phase 2 tests pin.

**`TextLayer` in the viewer boundary, not in `engine/`.** _Reason:_ its constructor
demands an `HTMLElement`. _Consequence:_ `engine/` stays React- and DOM-free, which
is what keeps `renderPageToImage` usable outside React; asserted by
`pdfjs-dual-runtime.test.ts`.

**A page box wrapping canvas + layer.** _Reason:_ the canvas is sized from the
viewport and the layer from `--total-scale-factor × <page size>`; siblings in one
`position: relative` box is what makes them agree at every scale and rotation.
_Consequence:_ page identity moved from the canvas to `[data-native-pdf-page]`, so
"the page element" is never ambiguous to a `querySelector`.

**A new resolution point, `text/pdfTextLayerSource.ts`.** _Reason:_ two renderers,
one extraction contract. It returns the layer _plus that renderer's span selector_,
so neither extractor grows a branch and the reading order / normalization /
fast-path logic stays shared verbatim. _Alternative rejected:_ branching inside
each extractor — the same decision would have been written twice and could drift.

**The native selection scope check is native-only.** _Reason:_ on the native path
the layer is addressable, so "is this PDF text?" has a real answer; on the legacy
path it has none, and inventing one would have risked selections that work today.
That is precisely why the Phase 2 suite passes without edits.

**Native markup keyed on `data-native-pdf-*`, never on `rpv-*`.** _Reason:_ reusing
the legacy class names would let the legacy stylesheet restyle the native layer and
would make the two markups indistinguishable in the extractors. Asserted by test.

**Component-local CSS instead of extending `src/shared/styles/**`.** _Reason:_ the
text-layer layout contract is genuinely required — PDF.js writes geometry as custom
properties and needs a stylesheet to turn it into a font size and a transform — but
it belongs to a rendering surface that owns its own markup. Every rule is scoped to
`data-native-pdf-_`, so there is no global leakage. \_Cost:_ one additive
`declare module '_.css'`.

**No `TextLayer#update()` yet.** _Reason:_ it is a second code path across the same
three races and needs its own proof; parity first, throughput later.

**`textLayerError` is exposed but not rendered.** _Reason:_ a text-layer failure
means "readable but not selectable". Hiding a working page to report a degraded one
is the wrong trade, and silently swallowing it would be worse.

## Files and Areas That Must Not Be Changed Yet

Zero diff is the expected state for all of these in any phase that is not the one
explicitly requested.

- `src/features/pdf/ui/components/{PdfViewerElement,PdfWorkerHost}.tsx`
- `src/features/pdf/ui/hooks/usePdfPlugins.ts`
- `src/features/pdf/lib/{renderPageToImage,activePdfDocumentRegistry,pdfViewerDom}.ts`
- `src/features/pdf/{capture,interaction}/**` and `text/normalizePdfText.ts`,
  `text/usePdfTextActions.ts`, `text/types.ts`
- `src/features/pdf/store/**` and `hooks/{readingHistoryRepository,useReadingProgressPersistence,usePdfNavigation,usePdfViewerZoomOrchestrator,usePdfViewerEffects}.ts`
- `src/features/pdf/viewport/useCoalescedZoom.ts`, `usePdfWheelNavigation.ts`
- `src/shared/styles/**` (all PDF viewer CSS — the native text layer has its own)
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
+ Phase 4 (canvas viewer) and Phase 5 (text layer + selection) — see
  `git log --oneline master..HEAD`
```

`master` remains a working RPV + pdfjs 3.x build throughout, so rollback is
"stop shipping the branch", not "reconstruct the old viewer". Do not merge to
master, tag, release or bump the version until the migration completes.

## Next Phase

**Phase 6 — annotation layer + links.** The authoritative scope is the migration
plan's phase table row: `PdfAnnotationLayer`, `LinkService`, and links plus form
widgets behaving as they do under RPV. `TextLayer` is done, so this is the first
capability that lives _on top of_ it.

Before starting it, note three things Phase 5 left for it:

- the native page box in `NativePdfViewer.tsx` is the natural mount point for an
  annotation layer — same box, same viewport, same lifecycle as the text layer, so
  `useNativePdfTextLayer` is the template to copy rather than reinvent
- `AnnotationLayer` also needs an `HTMLElement` and a DOM adapter in
  `nativePdfDom.ts`, so it stays in the boundary for exactly the reason the text
  layer does
- link handling adds a _navigation_ concern the text layer does not have
  (`LinkService` events, external vs. internal targets, and what happens to a
  click that leaves the panel). That is the part most worth pinning with tests
  before writing it, because a wrong internal-target resolution is a silent
  navigation bug

Still out of scope for Phase 6: search, capture, `activePdfDocumentRegistry`,
context menu, RPV removal, and the `pdfjs-6` alias.

## Do Not Do Yet

- Do not remove `@react-pdf-viewer`, `pdfjs-dist` 3.x, or the legacy override.
- Do not collapse the dual runtime, remove the `pdfjs-6` alias, or rename
  `vendor-pdf-native`.
- Do not migrate search, capture, `activePdfDocumentRegistry`, or the context menu.
- Do not touch the reading-progress architecture.
- Do not remove the CVE-2024-4367 exception, extend its expiry, or drop
  `isEvalSupported: false` from the legacy call sites.
- Do not delete `usePdfPlugins`, `PdfViewerElement` or `PdfWorkerHost`.
- Do not extend `src/shared/styles/**` for native work, or remove `.npmrc` /
  `legacy-peer-deps`.
- Do not modify Phase 2 regression expectations to make new code pass.
- Do not enable the native viewer by default.
- Do not add `TextLayer#update()` / canvas DPR work opportunistically — each is a
  separate, provable change.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is
   dirty or master has advanced.
3. Compare repository state against this file; where they conflict the repository
   wins.
4. Read `docs/pdfjs-migration-plan.md` for the detail the current phase needs —
   especially the phase table and the Phase 3B / 4 / 5 sections.
5. Read the implementation files relevant to the requested phase:
   `src/features/pdf/native/*`, `src/features/pdf/engine/*`, `text/*`, plus the
   legacy viewer files it must not disturb.
6. If the phase adds a viewer capability, run the **Phase 5 interactive smoke**
   first — jsdom cannot see layout, so anything about geometry, real selection or
   visual alignment is unproven until a human looks at it.
7. Execute **only** the explicitly requested phase.
8. Run `npm test` plus the static gates; update this file before finishing.

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
