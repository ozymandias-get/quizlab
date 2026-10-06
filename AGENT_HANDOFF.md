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
| Current phase        | Phase 6 complete — **Phase 7 not started**                                             |
| Last completed phase | Phase 6 — native annotation layer + internal/external links                            |
| Current HEAD         | run `git rev-parse HEAD`                                                               |
| Working tree         | clean at last commit                                                                   |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                             |
| Readiness            | **ready for Phase 7** — the native viewer is reachable behind `VITE_NATIVE_PDF_VIEWER` |

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
renderer. Phases 5–6 added the text layer and then the annotation layer, so the
native path now renders a page, lets you select its text, send it to the AI, and
follow its links.

## Completed Migration Phases

Phases 1–4 (history, kept short — the detail is in `docs/pdfjs-migration-plan.md`):

- **1 — baseline.** Architecture mapped, RPV coupling identified, migration judged
  viable with risks. No source change. Key finding: `@react-pdf-viewer/core@3.12.0`
  `require()`s `pdfjs-dist`, and it is still `3.12.0` — no viewer release supports
  pdfjs ≥ 4.
- **2 — regression hardening.** 125 tests across 6 new files plus 1 extended,
  mutation-validated (19 deliberate mutations, 19/19 caught). The safety net for
  every later phase: capture, selection, pan, Ctrl+wheel zoom, search highlight,
  serialization.
- **3 — single-version attempt. BLOCKED, not implemented.** RPV 3.12 calls
  `renderTextLayer()` and `new SVGGraphics()`, both removed in 4.x. The dependency
  change was reverted (`d0564f7`).
- **3B — dual-runtime foundation.** `pdfjs-6` alias, `features/pdf/engine/`,
  packaged assets, split security posture, isolation enforced by tests. No viewer or
  UI file touched.
- **4 — native canvas viewer + page/scale state.** The first engine consumer.
  `features/pdf/native/**` + `NativePdfViewer.tsx` render one page on one canvas
  behind `VITE_NATIVE_PDF_VIEWER` (default **off**). Legacy untouched; the build now
  emits **both** workers. **Manual smoke resolved** by user validation in the real
  application.

### Phase 5 — Native Text Layer + Selection

PDF.js 6's own `TextLayer` now renders the selectable text geometry for the
current page over the native canvas, in the native boundary. The legacy
extractors resolve either markup, `usePdfTextActions` is untouched, and both AI
text actions work on the native path. **Phase 2's selection suite passes
byte-identical** — that was the exit criterion.

### Phase 6 — Native Annotation Layer + Links

PDF.js 6's own `AnnotationLayer` renders the third layer: link annotations (and
whatever else the document carries, display-only) over the canvas and the text
layer. An internal destination resolves to a 1-based page and moves
`useNativePdfPageState`'s `currentPage` through the same `jumpToPage` the toolbar
uses; an external link goes through the app's existing `openExternal` IPC under
`https:`/`mailto:`, and an unsafe protocol gets no actionable `href` at all.
AcroForm widgets stay display-only (`renderForms: false`), PDF JavaScript actions
stay unbound. Search, capture and `activePdfDocumentRegistry` remain legacy-only.
**The Phase 2 selection files are still byte-identical.**

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
                              canvas + PDF.js TextLayer + PDF.js AnnotationLayer;
                              text: native TextLayer; links: nativePdfLinkService
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
`web/pdf_viewer` event bus and DOM) and form editing.

## Native Viewer (Phases 4–6)

Everything that imports `@features/pdf/engine` lives in `features/pdf/native/`
plus `features/pdf/ui/components/NativePdfViewer.tsx`. Asserted by
`pdfjs-dual-runtime.test.ts`, together with the inverse: no
`@react-pdf-viewer` import specifier and no `rpv-*` string in that boundary.

| File                             | Responsibility                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `nativePdfViewerFlag.ts`         | `VITE_NATIVE_PDF_VIEWER`; only the exact string `true` opts in                                         |
| `nativePdfBounds.ts`             | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*`                                |
| `nativePdfDom.ts`                | the native markup contract — page / canvas / text layer / annotation layer / text-run / link selectors |
| `nativePdfTextLayer.css`         | PDF.js's text-layer layout contract, scoped to `data-native-pdf-*`                                     |
| `nativePdfAnnotationLayer.css`   | PDF.js's `.annotationLayer` layout rules, scoped to `data-native-pdf-*`                                |
| `nativePdfLinkService.ts`        | PDF.js's link-service surface over the native page state + `openExternal`                              |
| `useNativeCoalescedScale.ts`     | numeric rAF-coalesced zoom channel, latest wins                                                        |
| `useNativePdfEngine.ts`          | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount                                |
| `useNativePdfDocument.ts`        | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size                                            |
| `useNativePdfPageState.ts`       | 1-based clamped `currentPage`, previous/next/jump                                                      |
| `useNativePdfScaleState.ts`      | numeric clamped `scale`, fit once per document identity                                                |
| `useNativePdfRender.ts`          | one page → one canvas, supersede-cancel                                                                |
| `useNativePdfTextLayer.ts`       | one page → one PDF.js `TextLayer`, supersede-cancel, page-level cache                                  |
| `useNativePdfAnnotationLayer.ts` | one page → one PDF.js `AnnotationLayer` + its link service, supersede-destroy                          |
| `useNativePdfController.ts`      | composition + the toolbar contract                                                                     |
| `nativeZoomControls.tsx`         | render-prop zoom components for the shared toolbar                                                     |

Invariants worth knowing before changing it:

- **Effect order matters once.** The engine-creating effect is declared before the
  document-loading effect; the engine must exist when the document hook runs.
  The text-layer effect is declared before the annotation-layer effect so the DOM
  is torn down and rebuilt in the order it is painted.
- **Page indexing is 1-based.** Only RPV's `onPageChange` is 0-based, and the
  native path has no such callback. `clampPdfPage` upper-bounds only once
  `totalPages` is known, because the resume flow restores a page first. A PDF
  destination index is 0-based and is converted **once**, in
  `nativePdfLinkService.ts`; do not add a second `+ 1`.
- **`PageWidth` becomes a number.** Fit scale comes from the shared `useFitScale`
  with the shared `adjustedContainerSize` returned by `usePdfViewerState`. The
  fit is keyed on document identity so `fit → render → resize → fit` cannot loop.
- **Zoom is one change per frame** through `useNativeCoalescedScale`; every source
  is clamped by `clampPdfScale`.
- **Cancellation is not an error.** `RenderingCancelledException` (canvas) and
  `AbortException` (text layer) are both dropped; genuine failures become
  `renderError` / `textLayerError` / `annotationLayerError`.
- **Canvas, text layer and annotation layer share one viewport.** All three are
  built from `page.getViewport({ scale })` with the same scale `pageRenderer`
  used, inside the same `[data-native-pdf-page]` box, and `--total-scale-factor`
  on that box is that same number. Recomputing it would misalign every selection
  highlight _and_ every link hitbox.
- **The three layers are in PDF.js's order** — `LAYERS_ORDER` in
  `web/pdf_viewer.mjs` is `canvasWrapper` 0, `textLayer` 1, `annotationLayer` 2.
  The annotation layer is above the text layer, and it is `pointer-events: none`
  with `section { pointer-events: auto }`, so selection still works everywhere the
  layer has no annotation. Asserted as DOM child order.
- **`TextLayer#cancel()` is required, not just the `cancelled` flag.** The flag
  stops _us_; `cancel()` stops PDF.js appending the rest of the stream into a
  container that is about to be reused for another page.
- **`AnnotationLayer` has no `cancel()`** — `destroy()` plus the `cancelled` flag.
  Its `render()` builds every element synchronously and awaits only an empty aria
  pass, so the guards are checked **before** every DOM-touching call and never
  after: a post-await clear from a stale run would erase the page on screen,
  because the layer `div` outlives the effect.
- **The link service's lifetime is the layer's.** It is created inside the
  annotation-layer effect and disposed in its cleanup, which is what makes an
  in-flight named destination inert after a page change, zoom, reload, document
  switch or unmount.
- **`role="presentation"` identifies a text run**, not `span`. PDF.js nests its
  runs in `span.markedContent` on a tagged PDF, and a blanket `span` query would
  count every word twice.
- **`textLayerError` and `annotationLayerError` are on the controller but not
  rendered.** Both mean "the page is readable but less capable than it should
  be"; hiding a working page to report a degraded one is the wrong trade.
- **First render of a document is at scale 1** and superseded one frame later by
  the fit. Deliberate — see the plan; not a bug.
- **DPR is not applied.** `canvas.width/height` = viewport size, 1:1 with CSS px.
- **Links stay clickable in pan mode.** The legacy `_pdf-viewer.css` drops
  `user-select` in pan mode on the _text layer only_ and says nothing about the
  annotation layer, so under RPV a link was live during a pan. Parity says keep it
  live; there is deliberately no pan rule in `nativePdfAnnotationLayer.css`.

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
~437 kB), plus `viewer-<hash>.css` (2.77 kB) carrying both native layer stylesheets
(text layer + annotation layer).

`useWorkerFetch` is deliberately **not** set: PDF.js 6 derives it via
`isValidFetchUrl` (true over http, false over `file://`), and `fetchData` falls
back to `XMLHttpRequest` accepting `status === 0` for `file://`.

## Security State

Reported per runtime — they are **not** one package. Phase 6 added a second
`enableScripting: false` (the annotation layer) but changed no other posture.

**Legacy runtime — `pdfjs-dist@3.11.174` (shipped via RPV)**

- `isEvalSupported: false` on both 3.x `getDocument` call sites
  (`ui/components/PdfViewerElement.tsx`, `lib/renderPageToImage.ts`)
- advisory **still reported**: `GHSA-wgrm-67xf-hhpq` / `CVE-2024-4367`, high,
  range `<=4.1.392`
- `security/audit-exceptions.json` exception **still required and unchanged** —
  same advisory ids, `installed: 3.11.174`, `expires: 2026-12-31`

**Native runtime — `pdfjs-6` / `pdfjs-dist@6.4.299`**

- `enableScripting: false` on every native `getDocument` path, via a narrow local
  intersection (no `as any`), **and** on the annotation layer's `render()`
- `hasJSActions: false` on the annotation layer, which together with the above is
  what keeps `LinkAnnotationElement#_bindJSAction` unreachable
- a `javascript:` annotation target is not merely unfollowed: it is given **no
  `href` at all**, plus `aria-disabled`, plus a cancelled click
- external link targets go through `electronAPI.openExternal`, never
  `window.open` / `location.href`; the renderer checks the protocol against the
  main process's own list (`https:`, `mailto:`) and refuses embedded credentials
- the main process re-validates the URL (`resolveExternalLink`) before
  `shell.openExternal`, so the renderer check is defence in depth, not the gate
- file attachments and `Launch` actions are inert (`getAttachmentContent`
  resolves `null`, no `downloadManager` is passed)
- `renderForms: false` — AcroForm widgets stay display-only, not editable
- `isEvalSupported` **not passed** — removed in 4.x
- advisory: **none**; no exception needed, none added

## Critical Invariants

1. The existing RPV viewer must remain functional until native feature parity.
2. Legacy viewer sources import `pdfjs-dist` **only**.
3. The native engine imports `pdfjs-6` **only**.
4. The two `GlobalWorkerOptions` namespaces stay isolated — different objects.
5. Workers are never shared across runtimes; no `workerPort` on either namespace.
6. The native engine never mutates the legacy PDF.js namespace.
7. Native PDF JavaScript execution stays disabled (`enableScripting: false` on
   both the document and the annotation layer).
8. The native engine contains no React / UI / zustand / RPV dependencies.
9. Only `features/pdf/native/**` + `NativePdfViewer.tsx` import
   `@features/pdf/engine`; none of them import `@react-pdf-viewer`.
10. `VITE_NATIVE_PDF_VIEWER` defaults to off, and only the exact string `true`
    enables it.
11. `isEvalSupported: false` stays on the legacy call sites while 3.x is shipped.
12. Do **not** remove the CVE exception while vulnerable 3.x remains shipped — it
    goes stale only when 3.11.174 leaves the tree.
13. Phase 2 regression suites stay green — they are the safety net for every
    later phase. **They still pass byte-identical after Phase 6**; do not edit a
    Phase 2 expectation to make migrated code pass.
14. The two runtimes stay in separate bundle chunks.
15. The native viewer never reaches into `lib/pdfViewerDom.ts`, and the legacy
    adapter never reaches into `nativePdfDom.ts`. Two DOM vocabularies, two files.
16. The native viewer never emits an `rpv-*` class and never reuses one; the
    native stylesheets match `data-native-pdf-*` only.
17. `usePdfTextActions` stays renderer-agnostic. One selection system, reached
    through the shared container, resolving whichever text layer is mounted.
18. The native boundary never imports `pdfjs-6/web/**`. `PDFLinkService` is not
    reachable from `pdfjs-6`'s entry point, and the module that has it is the
    whole web viewer; the link surface is QuizLab's own adapter.
19. An internal destination converts a 0-based PDF index to a 1-based QuizLab
    page **exactly once**, in `nativePdfLinkService.ts`. No second `+ 1`.
20. A PDF link never navigates the renderer: internal destinations are cancelled
    by PDF.js's own `onclick → return false`, external ones by an explicit
    `preventDefault()`, and unsafe ones have nothing actionable left in the DOM.

## Regression Baseline

Last verified in Phase 6, after all code changes. Run `npm test` to reproduce.

```
Full suite:  358 test files · 3928 passed · 2 skipped · 0 failed
```

The 2 skips are pre-existing (Electron `ConfigManager`). By area:
`src/__tests__/features/pdf/**` = 61 files / 689 tests (incl. 12 native files);
`src/__tests__/architecture/**` = 5 files / 92 tests.

**The three Phase 2 selection files are unchanged since Phase 2** —
`usePdfTextActions.test.tsx`, `extractSelectedText.test.ts`,
`extractPageTextFromDom.extended.test.ts`. That is the Phase 5 and Phase 6 exit
criterion, and it still holds.

Phase 6 added 77 tests across 2 new files plus extensions to 4 existing ones. They
were mutation-checked: dropping the `+ 1` from the destination page-index
conversion fails 7 tests; dropping the `cancelled` guard after `getAnnotations()`
fails 3 race tests.

Static gates green at Phase 6: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `analyze:css`,
`ci:check-hygiene`, `check:audit`, `check:electron-security`, `git diff --check`.

Build: `npm run build:renderer:electron` succeeds, emitting **both** workers,
`vendor-pdf-legacy`, `vendor-pdf-native`, the native layer-stylesheet chunk (text +
annotation, 2.77 kB) and the full `dist/pdfjs/` tree.
`VITE_NATIVE_PDF_VIEWER=true` produces the same artifact set.

## Interactive Smoke State

- **Phase 4**: resolved — the user manually exercised the native viewer in the
  real application and reported no visible issue.
- **Phase 5**: **still outstanding.** This environment has no interactive
  session, so the native text layer has never been looked at in a real browser.
- **Phase 6**: **still outstanding**, for the same reason plus one more: an
  annotation layer's whole point is geometry, and jsdom has none, so the automated
  coverage proves the viewport argument, the layer order and the lifecycle but
  _cannot_ prove that a link's hitbox sits over the words it belongs to.

Both checklists are in the migration plan (the Phase 5 and Phase 6
"Interactive smoke" sections). The highest-value items overall: selection
alignment against the canvas at 100 % / 150 % / fit, `Ctrl+C` out of the native
layer, pan ⇄ text switching, link hitbox alignment after a zoom, an external link
opening in the system browser with **no** renderer navigation, a `javascript:`
annotation doing nothing, and a text-dense page watched for UI lock.

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
9. **Component-local CSS is a new build pattern.** The two native layer
   stylesheets are imported for their side effect; they needed `declare module
'*.css'` in `src/types/assets.d.ts`. They ship as one chunk
   (`viewer-<hash>.css`), so they load with the viewer rather than in the global
   sheet.
10. **PDF.js's `AnnotationLayer` type declarations are stricter than its
    implementation.** The constructor types every destructured key as required,
    including six managers a headless viewer has no use for, and `render()` is
    declared against the whole constructor payload while its implementation reads
    `annotations` plus a few options. Worked around without `as any`: the unused
    managers are passed as `null` (which is what the class defaults them to) and
    `render()` goes through one documented, single-purpose assertion helper.
11. **Named link actions are inert on the native path.** `NextPage`, `PrevPage`,
    `FirstPage`, `LastPage`, `GoBack`, `GoForward` are recognised by PDF.js and
    bound to an anchor, and our adapter deliberately does nothing with them. They
    are not destinations, the legacy viewer drives its own navigation plugins, and
    half-implementing them would have been a guess.
12. **`executeSetOCGState` is a no-op.** Optional-content visibility needs the
    optional-content configuration, which this viewer does not carry. The call
    resolves, so the annotation stays inert rather than broken.
13. **Embedded-file attachments cannot be opened from the native path.**
    `getAttachmentContent` resolves `null` and no `downloadManager` is passed, so
    the anchor is clickable and inert. Phase 6 is not a local-file launcher.
14. **A destination's implied zoom is ignored**, matching the legacy path. RPV's
    link handling sets the page and the named destination, not the zoom.

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
- the `*.css` module declaration in `src/types/assets.d.ts` (only users:
  `nativePdfTextLayer.css`, `nativePdfAnnotationLayer.css`)

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
layer layout contracts are genuinely required — PDF.js writes geometry as custom
properties and expects a stylesheet to turn them into positions, font sizes and
transforms — but they belong to rendering surfaces that own their own markup. Every
rule is scoped to `data-native-pdf-\*`, so there is no global leakage, and importing
PDF.js's whole `pdf*viewer.css`was rejected because its global`.linkAnnotation`/`section`/`input` rules would restyle the legacy viewer's markup in the same
document. \_Cost:* one additive `declare module '_.css'`.

**No `TextLayer#update()` yet.** _Reason:_ it is a second code path across the same
three races and needs its own proof; parity first, throughput later.

**`textLayerError` and `annotationLayerError` are exposed but not rendered.**
_Reason:_ each means "readable but less capable than it should be". Hiding a working
page to report a degraded one is the wrong trade, and silently swallowing it would
be worse.

**PDF.js renders the annotation layer; QuizLab renders the behaviour around it.**
_Reason:_ an annotation is glyph geometry plus widget markup — PDF-space rectangles
resolved into the viewport, rotation, `noRotate`, border styles, hidden and
optional-content entries, a real `<textarea>` for a multiline field — and a link is
only clickable if the box is where PDF.js put it. _Alternative rejected:_ placing
the boxes approximately, which would be a rewrite and would have made every link
hitbox a guess.

**A QuizLab link-service adapter, not PDF.js's `PDFLinkService`.** _Reason:_ three
properties of the installed implementation, not preference — `PDFLinkService` is not
exported from `pdfjs-6`'s entry point, its `goToDestination` requires a
`PDFViewer` (and its `pagesCount` getter dereferences one), and its external-link
handling leaves the outcome to Electron's navigation interception, which
allow-lists `https:` only and so cannot open the `mailto:` links the app's own
policy supports. The adapter implements exactly the surface `AnnotationLayer` calls,
read off `build/pdf.mjs`. _Alternative rejected:_ importing
`pdfjs-6/web/pdf_viewer.mjs`, which is the entire web viewer in one chunk.
_Asserted by:_ `pdfjs-dual-runtime.test.ts` forbids `pdfjs-6/web/` anywhere in the
native boundary.

**The link service's lifetime is the layer's.** _Reason:_ a click can only come from
an anchor a live layer rendered, so creating it inside the annotation-layer effect
and disposing it in that effect's cleanup is what makes a named destination that
resolves late inert. _Alternative rejected:_ holding it in a ref for the viewer's
life, which would have let a resolution that started under one document navigate
another.

**One `+ 1` for page indices, in one file.** _Reason:_ a PDF destination is 0-based
and QuizLab's page state is 1-based; both ways of naming a page (an indirect ref via
`getPageIndex`, and a literal index) are converted in `resolveDestinationPage` and
nowhere else. _Alternative rejected:_ clamping inside `jumpToPage`, which already
clamps and would have hidden a bad conversion instead of failing a test.

**Renderer checks protocol + credentials; the main process keeps the full policy.**
_Reason:_ both renderer checks answer "may this become an actionable `href`?", which
is why they belong at the boundary. The loopback / IPv4-literal / TLD-less host
rules stay in `resolveExternalLink` — duplicating them would create a second policy
free to drift from the first. `http:` is deliberately **not** allowed, matching the
shipped main process; `mailto:` is, matching the app's own external-link policy.

**A refused URL gets no `href` at all.** _Reason:_ `preventDefault` alone leaves a
`javascript:` target sitting in the DOM for some other activation path. Leaving
nothing actionable, plus `aria-disabled`, plus a cancelled click, is what makes it
non-executable rather than merely unfollowed.

**`renderForms: false`.** _Reason:_ Phase 6 is display, not form editing. A widget
with a baked-in appearance keeps the canvas's painting and cannot be edited, which
is what the legacy viewer shows too. Form state, persistence and saving are out of
scope and nothing here pretends otherwise.

**Links stay clickable in pan mode.** _Reason:_ parity, decided from the legacy CSS
rather than guessed — `_pdf-viewer.css` drops `user-select` in pan mode on the text
layer only and says nothing about the annotation layer, so under RPV a link was live
during a pan. The native stylesheet therefore has no pan rule.

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
- `src/shared/styles/**` (all PDF viewer CSS — the native layers have their own)
- `security/audit-exceptions.json`
- any `@react-pdf-viewer/*` usage
- `src/features/pdf/search/**`, `safeRenderHighlights`, `usePdfSearchStore`,
  `PdfSearchBar` (Phase 7 scope)

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
+ Phase 4 (canvas viewer), Phase 5 (text layer + selection) and Phase 6
  (annotation layer + links) — see `git log --oneline master..HEAD`
```

`master` remains a working RPV + pdfjs 3.x build throughout, so rollback is
"stop shipping the branch", not "reconstruct the old viewer". Do not merge to
master, tag, release or bump the version until the migration completes.

## Next Phase

**Phase 7 — search + highlights.** The authoritative scope is the migration
plan's phase table row: a native search controller and highlight overlay reusing the
existing `pdf-highlight-fadein` and `rpv-search__highlight` geometry, with the Phase 2
search-highlight tests passing unchanged.

Four things Phase 6 settled that Phase 7 depends on or must respect:

- **`PDFFindController` is in `pdfjs-6/web/pdf_viewer.mjs`**, the same module Phase 6
  refused for `PDFLinkService` — and it is worse, because it needs the `EventBus` and
  the page-view container. The plan says "reuse `safeRenderHighlights` geometry", so
  the likely shape is again an adapter over the text layer's `textDivs` /
  `textContentItemsStr` rather than an import. Read the phase-6 reasoning in
  `nativePdfLinkService.ts` before reaching for the web bundle.
- **`TextLayer#update()` and the text-run geometry are already in place.** Search
  needs a text→rect mapping; `TextLayer` already exposes `textDivs` and
  `textContentItemsStr`, and `collectTextItems` in `text/` already does
  geometry-based collection. Do not build a second one.
- **Highlights are DOM, so they need a fourth layer.** The page box already has the
  canvas, the text layer and the annotation layer, in PDF.js's order. A highlight
  overlay has to go above the canvas and be inert to the pointer; decide its
  position against `LAYERS_ORDER` and keep it `data-native-pdf-*`.
- **Search is the first native capability that writes into the text layer's DOM.**
  `usePdfTextActions` and the extractors must keep working unchanged — the Phase 2
  suite is still the exit criterion.

Still out of scope for Phase 7: capture, `activePdfDocumentRegistry`, context menu,
RPV removal, the `pdfjs-6` alias, and form editing.

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
- Do not import `pdfjs-6/web/**` into the native boundary, for `PDFLinkService`,
  `PDFFindController` or anything else.
- Do not add a second page-index conversion, a second navigation state machine, or a
  second external-URL pathway.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is
   dirty or master has advanced.
3. Compare repository state against this file; where they conflict the repository
   wins.
4. Read `docs/pdfjs-migration-plan.md` for the detail the current phase needs —
   especially the phase table and the Phase 3B / 4 / 5 / 6 sections.
5. Read the implementation files relevant to the requested phase:
   `src/features/pdf/native/*`, `src/features/pdf/engine/*`, `text/*`, plus the
   legacy viewer files it must not disturb.
6. If the phase adds a viewer capability, run the **Phase 5 and Phase 6 interactive
   smoke** first — jsdom cannot see layout, so anything about geometry, real
   selection, link hitboxes or visual alignment is unproven until a human looks at
   it. Do not mark either list resolved without that.
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
