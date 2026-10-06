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

| Field                | Value                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| Branch               | `refactor/native-pdfjs-viewer` (base: `master`)                                         |
| Current phase        | Phase 8A complete — **Phase 8B (RPV removal) not started**                              |
| Last completed phase | Phase 8A — native capture + active document registry + context-menu parity              |
| Current HEAD         | run `git rev-parse HEAD`                                                                |
| Working tree         | clean at last commit                                                                    |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                              |
| Readiness            | **native feature parity reached — ready for Phase 8B, subject to the smoke debt below** |

Phase 4's manual smoke was recorded as outstanding because the Phase 4 agent had no
interactive environment. The user has since **manually exercised the Phase 4 native viewer
in the real application and reported no visible issue**. That closes the only open Phase 4
item; nothing wider is claimed from it — interactive native verification is still open
for Phases 5, 6, 7 **and now 8A**, see _Interactive Smoke State_.

The shipped PDF experience is still `@react-pdf-viewer`. The native pdfjs-6 path is
implemented, wired into the viewer shell and in the build, and switched on only by an
explicit opt-in environment variable.

## Current Goal

Replace `@react-pdf-viewer` with a native `pdfjs-dist` 6.x viewer **without ever leaving
the shipped app without a working PDF reader**. Phases 1–4 established the baseline, the
regression safety net, the dual runtime and the first working native renderer. Phases 5–7
added the text layer, the annotation layer and search; Phase 8A added the last three
legacy-only capabilities — the capture pipeline, `activePdfDocumentRegistry` and the
context menu that depends on them. The native path now renders a page, selects its text,
sends it to the AI, follows links, searches it, captures it at high DPI and serves the
same right-click menu. What is left is **deletion**, not implementation: Phase 8B removes
`@react-pdf-viewer` and collapses the dual runtime.

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
stay unbound. **The Phase 2 selection files are still byte-identical.**

### Phase 7 — Native Search + Highlights

The page gained a fourth layer: QuizLab's own search highlight overlay. `PDFFindController`
was declined for the same reason Phase 6 declined `PDFLinkService` — it lives in
`pdfjs-6/web/pdf_viewer.mjs`, calls `eventBus.on(...)` four times in its constructor and
publishes matches by dispatching to `PDFPageView`. The parity target turned out to be the
_legacy plugin's own DOM walk_ (it never uses `PDFFindController` either), so
`nativePdfSearch.ts` ports that: runs concatenated with no separator, literal
case-insensitive matching with no regexp, one `Range`-measured rectangle per run a match
touches, the single-space run skipped, `top`/`left` ordering. The controller exposes the
plugin's exact two calls, so `PdfSearchBar`, `usePdfSearchStore`, `Ctrl+F` and `Escape`
are untouched and `PdfToolbar` no longer hides the search bar on the native path.
`pdf-highlight-fadein` is referenced, not redeclared; reduced motion is read per search
run, so `usePdfPlugins.ts` is at **zero diff** and the Phase 2 search-highlight suite is
**byte-identical**. Scope is the rendered page, matching the legacy viewer's
`ViewMode.SinglePage`; no whole-document index, no next/prev match, no match count.

### Phase 8A — Native Capture + Registry + Context Menu

The last three legacy-only capabilities, and the phase that makes "native feature parity"
true. `activePdfDocumentRegistry` now stores a **runtime-agnostic handle** rather than a
pdfjs-3 proxy, the native viewer publishes its mounted document through it, and
`renderPageToImage` resolves **no PDF.js runtime at all**: it borrows when it can and loads
one isolated pdfjs-6 document when it cannot. `findPageCanvas` became renderer-agnostic and
validates the page against `[data-native-pdf-page]`. `PdfViewerDocument` supplies the live
page number to capture through a ref, because the legacy navigation state is inert on the
native path. The context menu needed **no change at all** — one hook, one component, one
item list, and three of its four items now reach a real capability. `PdfToolbar`'s
`nativeCanvasMode` and `PdfAiQuickBar`'s `captureActionsDisabled` were deleted, so no
capture control is bounded any more.

**The only Phase 2 test file that changed is `renderPageToImage.test.ts`**, and only
because the contract it pinned — a 3.x `getDocument` call site and a `destroy()` on the
document — is precisely what Phase 8A removed. Every behavioural expectation survived:
borrow-don't-destroy, the pixel budget and its rounding epsilon, the clone fallback, the
white fill, the PNG/blob/URL shape, and "return null rather than throw". The three Phase 2
selection files and `usePdfPluginsHighlights.test.tsx` are **byte-identical**.

## Current PDF Architecture

```
PdfViewer → PdfViewerDocument → usePdfViewerState
   │
   ├─ flag OFF (default) → PdfViewerElement → @react-pdf-viewer <Viewer>
   │                        → require('pdfjs-dist') → pdfjs-dist@3.11.174
   │                        LEGACY, SHIPPED. Worker fed by PdfWorkerHost.
   │                        registers its PDFDocumentProxy in the registry
   │                        (adapted by lib/legacyPdfCaptureDocument.ts)
   │                        → capture / search / pan / zoom / context menu
   │                        → text: RPV TextLayer read by text/**
   │
   └─ flag ON  (VITE_NATIVE_PDF_VIEWER=true) → NativePdfViewer
                               → useNativePdfController → @features/pdf/engine
                               → pdfjs-6 → pdfjs-dist@6.4.299
                               canvas + PDF.js TextLayer + PDF.js AnnotationLayer
                               + native search overlay;
                               text: native TextLayer; links: nativePdfLinkService;
                               search: nativePdfSearch;
                               capture: publishes its document to the registry
                               (useNativePdfCaptureDocument)
```

One `ResizeObserver`, one `containerRef`, one toolbar. Page nav, zoom, the
current-scale readout, `highlight`/`clearHighlights` **and the capture page number** bind
to whichever renderer is live. When the flag is off the legacy zoom/page/resize hooks are
inert (`totalPages` stays 0), so exactly one implementation of each is ever active.

**Text and capture are the two capabilities both paths share.** `usePdfTextActions` is
mounted once by `usePdfViewerState` against the shared container and is markup-agnostic;
`text/pdfTextLayerSource.ts` resolves whichever text layer is mounted. Capture is the same
shape: `usePdfCaptureActions`, `renderPageToImageFallback` and `findPageCanvas` are
renderer-agnostic and were not forked — only the _backend capability_ behind them is chosen
at the single switch in `PdfViewerDocument`. There is no native-specific selection system
and no native-specific capture system, and both absences are deliberate.

## Dependency State

| Entry                     | Value                                           | Role                                        |
| ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `pdfjs-dist`              | `3.11.174` (exact)                              | **legacy / RPV runtime**                    |
| `overrides["pdfjs-dist"]` | `3.11.174`                                      | keeps the legacy pin exact                  |
| `pdfjs-6`                 | `npm:pdfjs-dist@6.4.299`                        | **native migration runtime** (alias, exact) |
| `@react-pdf-viewer/*`     | `^3.12.0` (core, page-navigation, search, zoom) | legacy viewer                               |

Unchanged since Phase 3B — **Phase 8A touched none of them**. `.npmrc`
`legacy-peer-deps=true` still suppresses the RPV peer `ERESOLVE` and must not be removed
before the viewer is deleted.

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

Separate `GlobalWorkerOptions` module instances; never mix them. `lib/renderPageToImage.ts`
now sits on **neither** side: it imports no PDF.js runtime at all.

### Temporary bridge introduced by Phase 8A

Two pieces of scaffolding exist only because `ui/components/PdfViewerElement.tsx` is frozen
at zero diff for the duration of the migration:

1. **`lib/renderPageToImage.ts` imports `features/pdf/native/nativePdfCaptureDocument`**
   for its temporary-document load. That is the legacy capture module reaching into the
   native boundary — the only direction-inverted edge in the feature.
2. **`setActivePdfDocument` still accepts a raw pdfjs-3 proxy**, normalized through
   `lib/legacyPdfCaptureDocument.ts`, because `PdfViewerElement` hands over
   `DocumentLoadEvent#doc` verbatim.

\_Removal condition: **Phase 8B**, in this order — delete `PdfViewerElement.tsx`, then
`legacyPdfCaptureDocument.ts`, then make `setActivePdfDocument` take handles only, then
inline the native adapter into the capture path once `pdfjs-6` is renamed to `pdfjs-dist`.

### Temporary Exit Plan

After native feature parity (reached at the end of Phase 8A): delete the four
`@react-pdf-viewer` packages, `PdfWorkerHost` and its worker import, the
`vendor-pdf-legacy` chunk, `pdfjs-dist@3.11.174` + its override, the `pdfjs-6`
alias, the `CVE-2024-4367` exception, the `isEvalSupported: false` call site
that remains on the viewer, `pdfjs-dual-runtime.test.ts`, and
`features/pdf/native/**` + `NativePdfViewer.tsx` + the flag; rename
`vendor-pdf-native` back to `vendor-pdf`; rewrite engine imports `pdfjs-6` →
`pdfjs-dist` and repoint asset staging at `node_modules/pdfjs-dist`; rescope the
legacy half of `pdfjs-engine-worker-coupling.test.ts`. The full ordered list with
rationale is the Phase 3B exit plan in `docs/pdfjs-migration-plan.md`.

## Native PDF Engine

`src/features/pdf/engine/` — 6 files, no React / DOM / UI / zustand / RPV
imports (asserted by test). Direction is `UI → engine → pdfjs-6`. Since Phase 8A
it also owns the **capture** document load, not just the viewer's: that is why a
temporary capture document gets the same options, worker and security posture for
free.

| File                    | Responsibility                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pdfWorker.ts`          | publishes `pdfjs-6.GlobalWorkerOptions.workerSrc` once; exports the resolved `.mjs` URL                            |
| `pdfDocumentOptions.ts` | the single authoritative `getDocument` parameter builder: scripting + asset policy                                 |
| `documentManager.ts`    | owns the `PDFLoadingTask`; load / reload / getDocument / getPage / destroy, generation-based stale-load protection |
| `pageCache.ts`          | page number → `PDFPageProxy`; clearable, rejected lookups not cached                                               |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, supersede-cancel, typed cancellation                            |
| `index.ts`              | barrel; the only entry point consumers should use                                                                  |

Still absent: form editing. Search lives in the viewer boundary, not here;
capture now reaches the engine only through `features/pdf/native/`, because only
that directory may import the engine.

## Capture Architecture

```
usePdfCaptureActions (renderer-agnostic)
  │  currentPage ← capturePageRef.current, written by PdfViewerDocument from the
  │                live renderer's page state (1-based)
  ├── handleFullPageScreenshot: the 5-rung ladder
  │     1. renderPageToImageFallback(pdfUrl, page, { scale: 4.0, maxPixels: 20 MP })
  │          a. getActivePdfDocument(pdfUrl)          ← borrow, no teardown
  │          b. else loadTemporaryCaptureDocument()    ← own it, release() in `finally`
  │          c. page.getViewport({ scale }) → clamp → canvas → white fill
  │             → page.render() → canvas.toBlob('image/png') → URL.createObjectURL
  │          d. on any failure → findPageCanvas(page) → clone at the same scale
  │          e. null
  │     2. the live canvas as a synchronous data URL
  │     3. the same canvas after a progressive retry ladder (30→210 ms, ~900 ms)
  │     4. renderPageToImageFallback at scale 2
  │     5. toast_capture_failed
  │     → queueImageForAi(dataUrl | blobUrl, { page, captureKind: 'full-page' })
  └── handleAreaScreenshot → startScreenshot({ page, captureKind: 'selection' })
        → Electron main process, webContents.capturePage(rect) — never PDF.js
```

Four separate capture paths exist and each is the pre-existing one, unchanged:

| Path                    | Where it lives                    | Native support                          |
| ----------------------- | --------------------------------- | --------------------------------------- |
| page → image (high-DPI) | `lib/renderPageToImage.ts`        | direct pdfjs-6 render + canvas fallback |
| area / crop screenshot  | `startScreenshot` → main process  | identical — no `.rpv-*` geometry        |
| selection screenshot    | same as above (`captureKind` tag) | identical                               |
| current rendered canvas | `capture/findPageCanvas.ts`       | native first, then legacy               |

`renderPageToImageFallback` still has **no cancellation parameter**, deliberately. Capture
supersession is decided by the caller's request stamp, and the previous `AbortSignal`
argument was dead code.

## Active Document Registry

`lib/activePdfDocumentRegistry.ts` — one slot, runtime-agnostic, zero PDF.js knowledge.

```ts
interface ActivePdfDocumentHandle {
  getPage(pageNumber: number): Promise<CaptureDocumentPage>
  isAlive(): boolean
}
```

- **Owns:** lookup, identity (`pdfUrl` + the registrant's own identity string), liveness,
  eviction of a dead entry.
- **Does not own:** the document, its loading task, or its teardown. There is no
  `destroy()` anywhere in the module's surface.
- **Never branches on a PDF.js version.** Every version-specific fact lives in an adapter.

| Adapter                                          | Producer             | `isAlive()`                                                |
| ------------------------------------------------ | -------------------- | ---------------------------------------------------------- |
| `lib/legacyPdfCaptureDocument.ts`                | `PdfViewerElement`   | `destroyed !== true` (3.x's flag)                          |
| `native/nativePdfCaptureDocument.ts`             | `PdfDocumentManager` | `!manager.destroyed && manager.getDocument() === document` |
| `native/nativePdfCaptureDocument.ts` (temp load) | a throwaway manager  | `!manager.destroyed && manager.getDocument() !== null`     |

Registration returns an opaque token; `clearActivePdfDocument(token)` withdraws **only that
entry**, which is what keeps an unmounting `LeftPanel` from evicting a live `FocusOverlay`
on the same file. `clearActivePdfDocument()` with no token stays the legacy `<Viewer>`
contract and empties the slot outright. Semantics are otherwise unchanged from before: a
single slot, **most recent registration wins**.

Native registration is `useNativePdfCaptureDocument`, declared immediately after
`useNativePdfDocument` in the controller so it only ever publishes a document that exists.
It registers when `status === 'ready'` and withdraws on identity change, reload and
unmount. Every early return happens _before_ any withdrawal, so the inert flag-off path can
never erase the legacy viewer's registration.

## Context Menu

`usePdfContextMenu` + `ContextMenu` + `usePdfViewerMenuItems`. **Phase 8A changed none of
them, deliberately.** The hook listens on the shared viewer container, the component is one
piece of markup, and the list is four items:

| Item                        | Backend                                                  |
| --------------------------- | -------------------------------------------------------- |
| add current page text to AI | `usePdfTextActions` → shared on both paths since Phase 5 |
| send page as image          | `usePdfCaptureActions` → native since Phase 8A           |
| crop screenshot             | `startScreenshot` → main process, never PDF.js           |
| reload                      | `viewerReloadKey`, which is the native reload signal too |

The renderer branch stays at the single switch in `PdfViewerDocument`, at backend-capability
level only. There is no second menu and no native-only menu variant;
`nativeCaptureActions.test.tsx` drives the real menu on the real native canvas to keep it
that way.

## Native Viewer (Phases 4–8A)

Everything that imports `@features/pdf/engine` lives in `features/pdf/native/`
plus `features/pdf/ui/components/NativePdfViewer.tsx`. Asserted by
`pdfjs-dual-runtime.test.ts`, together with the inverse: no
`@react-pdf-viewer` import specifier and no `rpv-*` string in that boundary.

| File                             | Responsibility                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nativePdfViewerFlag.ts`         | `VITE_NATIVE_PDF_VIEWER`; only the exact string `true` opts in                                                                                     |
| `nativePdfBounds.ts`             | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*`                                                                            |
| `nativePdfDom.ts`                | the native markup contract — page / canvas / text layer / annotation layer / search layer / text-run / link selectors, plus `findNativePageCanvas` |
| `nativePdfTextLayer.css`         | PDF.js's text-layer layout contract, scoped to `data-native-pdf-*`                                                                                 |
| `nativePdfAnnotationLayer.css`   | PDF.js's `.annotationLayer` layout rules, scoped to `data-native-pdf-*`                                                                            |
| `nativePdfSearchLayer.css`       | QuizLab's search overlay + highlight layout, scoped to `data-native-pdf-search-*`                                                                  |
| `nativePdfLinkService.ts`        | PDF.js's link-service surface over the native page state + `openExternal`                                                                          |
| `nativePdfSearch.ts`             | the search engine: page text, literal matching, `Range` geometry, highlight rendering                                                              |
| `nativePdfCaptureDocument.ts`    | the capture handle adapter + `loadTemporaryCaptureDocument` (a throwaway `PdfDocumentManager`)                                                     |
| `useNativeCoalescedScale.ts`     | numeric rAF-coalesced zoom channel, latest wins                                                                                                    |
| `useNativePdfEngine.ts`          | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount                                                                            |
| `useNativePdfDocument.ts`        | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size                                                                                        |
| `useNativePdfCaptureDocument.ts` | publishes the mounted document to the capture registry, token-scoped                                                                               |
| `useNativePdfPageState.ts`       | 1-based clamped `currentPage`, previous/next/jump                                                                                                  |
| `useNativePdfScaleState.ts`      | numeric clamped `scale`, fit once per document identity                                                                                            |
| `useNativePdfRender.ts`          | one page → one canvas, supersede-cancel                                                                                                            |
| `useNativePdfTextLayer.ts`       | one page → one PDF.js `TextLayer`, supersede-cancel, page-level cache, `textLayerReady`                                                            |
| `useNativePdfAnnotationLayer.ts` | one page → one PDF.js `AnnotationLayer` + its link service, supersede-destroy                                                                      |
| `useNativePdfSearch.ts`          | keyword → highlight rectangles: the lifecycle, plus `highlight` / `clearHighlights`                                                                |
| `useNativePdfController.ts`      | composition + the toolbar contract                                                                                                                 |
| `nativeZoomControls.tsx`         | render-prop zoom components for the shared toolbar                                                                                                 |

Invariants worth knowing before changing it:

- **Effect order matters three times, and all three are load-bearing.** The
  engine-creating effect is declared before the document-loading effect; the
  capture-registration effect immediately after it, because it may only publish a
  document that exists; the text-layer, annotation-layer and search effects after
  both render effects, so the DOM is torn down and rebuilt in paint order and the
  text layer's synchronous cleanup empties the runs search is about to measure.
- **Page indexing is 1-based.** Only RPV's `onPageChange` is 0-based. A PDF
  destination index is 0-based and is converted **once**, in `nativePdfLinkService.ts`.
  Capture passes `pageNumber` straight to `getPage`, which is also 1-based.
- **`PageWidth` becomes a number.** Fit scale comes from the shared `useFitScale`,
  keyed on document identity so `fit → render → resize → fit` cannot loop.
- **Zoom is one change per frame** through `useNativeCoalescedScale`; every source
  is clamped by `clampPdfScale`.
- **Cancellation is not an error.** `RenderingCancelledException` (canvas) and
  `AbortException` (text layer) are both dropped; genuine failures become
  `renderError` / `textLayerError` / `annotationLayerError`.
- **Canvas, text layer and annotation layer share one viewport**, and
  `--total-scale-factor` on the page box is that same number.
- **The search overlay is the fourth layer and is declared last in the DOM on
  purpose**, painted by `z-index: 1` between the text layer and the annotation layer.
- **Capture borrows; it never destroys.** No `page.cleanup()` on a borrowed proxy,
  because that clears the shared decoded-object cache and forces a re-decode.
- **Liveness is the manager's question, not the proxy's.** PDF.js 6 removed
  `PDFDocumentProxy#destroyed`, so the native adapter asks
  `manager.getDocument() === document`. A throwing probe counts as dead.
- **`capturePageRef` is written during render, not in an effect**, so a capture
  triggered in the same tick as a page change reads the new page. The ref is
  created _before_ `usePdfViewerState` runs, because that hook needs it.
- **Reduced motion is read per search run**, `usePdfPlugins.ts` stays at zero diff.
- **Search offsets are never taken from a case-folded copy of the page**, and
  search geometry is always measured with a `Range`.
- **First render of a document is at scale 1**, superseded one frame later by the fit.
- **DPR is not applied** to the native canvas — capture at scale 4 is independent
  of it, which is exactly why the capture path does not need it.

Reused unchanged from the legacy path: `useFitScale`, `useContainerSize`,
`useLastNavigationTime`, `usePdfWheelNavigation`, `usePdfCtrlWheelZoom`,
`usePdfResizeRefit`, **`usePdfTextActions`**, **`usePdfCaptureActions`**,
`usePdfContextMenu`, `useCanvasGpuCleanup`, `PdfToolbar`, `PdfZoomControls`,
`PdfPageNav`, `ContextMenu`, `InlineSpinner`, `onReadingProgressChange`.

## Worker Architecture

|           | Legacy                                   | Native                                 |
| --------- | ---------------------------------------- | -------------------------------------- |
| Specifier | `pdfjs-dist/build/pdf.worker.min.js?url` | `pdfjs-6/build/pdf.worker.min.mjs?url` |
| Owner     | `ui/components/PdfWorkerHost.tsx`        | `engine/pdfWorker.ts`                  |
| Strategy  | `<Worker workerUrl>` (RPV)               | `GlobalWorkerOptions.workerSrc`        |
| Emitted   | `pdf.worker.min-<hash>.js`, ~1 062 kB    | `pdf.worker.min-<hash>.mjs`, ~1 235 kB |

Both are emitted by the normal `npm run build:renderer:electron` build, and both
are still emitted **on both flag settings**. Since Phase 8A the native worker is
also the one capture's temporary document load uses — there is no third worker and
no second way to bootstrap one.

## Security State

Reported per runtime — they are **not** one package.

**Legacy runtime — `pdfjs-dist@3.11.174` (shipped via RPV)**

- `isEvalSupported: false` on **the one remaining 3.x `getDocument` call site**,
  `ui/components/PdfViewerElement.tsx`. Phase 8A removed the second one
  (`lib/renderPageToImage.ts`) by moving capture's fallback load onto pdfjs 6.
- advisory **still reported**: `GHSA-wgrm-67xf-hhpq` / `CVE-2024-4367`, high,
  range `<=4.1.392`
- `security/audit-exceptions.json` exception **still required and unchanged** —
  same advisory ids, `installed: 3.11.174`, `expires: 2026-12-31`
- **Known prose drift:** the exception's `reason` still names
  `pdf/lib/renderPageToImage.ts` as a mitigated call site. That file no longer
  resolves 3.x. The exception remains _correct_ — the viewer is still the shipped
  3.x consumer — but the sentence describing the mitigation is one call site out
  of date. Phase 8A did not touch the file by instruction; Phase 8B deletes the
  entry outright.

**Native runtime — `pdfjs-6` / `pdfjs-dist@6.4.299`**

- `enableScripting: false` on every native `getDocument` path, via a narrow local
  intersection (no `as any`), **and** on the annotation layer's `render()`. This
  now includes the temporary capture document, because it goes through the same
  `createPdfDocumentOptions` builder rather than a second one written next to
  capture.
- `hasJSActions: false` on the annotation layer, which together with the above is
  what keeps `LinkAnnotationElement#_bindJSAction` unreachable
- a `javascript:` annotation target is not merely unfollowed: it is given **no
  `href` at all**, plus `aria-disabled`, plus a cancelled click
- external link targets go through `electronAPI.openExternal`, never
  `window.open` / `location.href`; the renderer checks the protocol against the
  main process's own list (`https:`, `mailto:`) and refuses embedded credentials
- the main process re-validates the URL (`resolveExternalLink`) before
  `shell.openExternal`
- file attachments and `Launch` actions are inert (`getAttachmentContent` resolves
  `null`, no `downloadManager` is passed)
- `renderForms: false` — AcroForm widgets stay display-only, not editable
- `isEvalSupported` **not passed** — removed in 4.x
- advisory: **none**; no exception needed, none added

**Capture specifically.** A temporary capture document is loaded through a
throwaway `PdfDocumentManager`, so it inherits the engine's options verbatim and
is destroyed through `PDFDocumentLoadingTask#destroy()` (which aborts its network
requests and worker). A _borrowed_ document is never torn down at all. There is no
`isEvalSupported` in the capture path and no way to add one: it no longer reaches
3.x.

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
11. `isEvalSupported: false` stays on the legacy **viewer** call site while 3.x is
    shipped. It is no longer anywhere else.
12. Do **not** remove the CVE exception while vulnerable 3.x remains shipped.
13. Phase 2 regression suites stay green — they are the safety net for every
    later phase. The three selection files and the search-highlight file are
    **byte-identical**; `renderPageToImage.test.ts` changed only because the
    contract it pinned (a 3.x `getDocument` + document `destroy()`) is what Phase
    8A removed.
14. The two runtimes stay in separate bundle chunks.
15. The native viewer never reaches into `lib/pdfViewerDom.ts`, and the legacy
    adapter never reaches into `nativePdfDom.ts`. Two DOM vocabularies, two files.
16. The native viewer never emits an `rpv-*` class and never reuses one; the
    native stylesheets match `data-native-pdf-*` only.
17. `usePdfTextActions` stays renderer-agnostic. One selection system, reached
    through the shared container, resolving whichever text layer is mounted.
18. The native boundary never imports `pdfjs-6/web/**`.
19. An internal destination converts a 0-based PDF index to a 1-based QuizLab
    page **exactly once**, in `nativePdfLinkService.ts`.
20. A PDF link never navigates the renderer.
21. `PdfSearchBar`, `usePdfSearchStore` and `PdfToolbar`'s search logic stay
    renderer-agnostic. The switch is at the top of `PdfViewerDocument`.
22. The native search emits no `rpv-*` class.
23. **Capture borrows; it never destroys.** A borrowed handle exposes no teardown,
    the registry has no `destroy()`, and no page `cleanup()` is ever called on a
    borrowed proxy.
24. **The capture registry is runtime-agnostic.** `isAlive()` is adapter-provided;
    a version check or a `destroyed`-flag read in the store is a bug.
25. **One `getDocument` options builder, one worker source.** Capture gets both by
    going through `createPdfDocumentManager`, never by building its own.
26. **The page a capture is labelled with is the live renderer's page.** The
    legacy navigation state is inert on the native path; `capturePageRef` is what
    keeps a capture on page 40 from being sent as page 1.
27. **A native canvas is only ever captured for the page it is showing.**
    `findNativePageCanvas` validates `[data-native-pdf-page]` rather than falling
    back to "the one canvas there is".
28. No capture control is renderer-bounded any more. A re-introduced
    `nativeCanvasMode` / `captureActionsDisabled` could only disable something
    that works, and would be a second thing to forget in Phase 8B.

## Regression Baseline

Last verified in Phase 8A, after all code changes.

```
Targeted area run:  src/__tests__/architecture/** + src/__tests__/features/pdf/**
                    72 files · 912 passed · 0 failed
```

> **The full `npm test` run was skipped on request for this phase**, so the
> repository-wide count below is still the Phase 7 baseline rather than a Phase 8A
> measurement. Phase 8B should run it.

```
Phase 7 baseline:   361 test files · 3996 passed · 2 skipped · 0 failed
```

The 2 skips are pre-existing (Electron `ConfigManager`).

**Byte-identical since Phase 2** — `usePdfTextActions.test.tsx`,
`extractSelectedText.test.ts`, `extractPageTextFromDom.extended.test.ts`, and
`usePdfPluginsHighlights.test.tsx` (14 tests). Untouched throughout Phase 8A.

Phase 8A added 92 tests across 3 new files plus extensions to 6 existing ones:
`nativePdfCaptureDocument.test.ts` (11, the real engine against a faked `pdfjs-6`:
options, worker, `loadingTask.destroy()`, handle liveness across reload/teardown),
`nativeCaptureRegistry.test.tsx` (11, `useNativePdfCaptureDocument` through the real
controller: publish, borrow, reload generations, the in-flight window, document switch,
unmount, sibling viewers, inert path), `nativeCaptureActions.test.tsx` (16, end-to-end
through the real `PdfViewerDocument`, toolbar, context menu and capture ladder on both flag
settings), plus the rewritten registry (21) and `renderPageToImage` (33) suites and 6
native cases in `findPageCanvas`.

Static gates green at Phase 8A: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `analyze:css`, `ci:check-hygiene`,
`check:audit`, `check:electron-security`, `git diff --check`.

Build: `npm run build:renderer:electron` succeeds, emitting **both** workers,
`vendor-pdf-legacy` (458.81 kB), `vendor-pdf-native` (436.85 kB), the native
layer-stylesheet chunk (text + annotation + search, 3.19 kB) and the full `dist/pdfjs/`
tree (200 files). `VITE_NATIVE_PDF_VIEWER=true` produces the same artifact set.

## Interactive Smoke State

**This is the branch's largest outstanding debt, and Phase 8B deletes the code it
would exercise. Whoever runs Phase 8B should run these first.**

- **Phase 4**: resolved — the user manually exercised the native viewer in the
  real application and reported no visible issue.
- **Phase 5**: **outstanding.** No interactive session in this environment, so the
  native text layer has never been looked at in a real browser.
- **Phase 6**: **outstanding**, for the same reason plus one more: an annotation
  layer's whole point is geometry, and jsdom has none, so the automated coverage
  proves the viewport argument, the layer order and the lifecycle but _cannot_
  prove that a link's hitbox sits over the words it belongs to.
- **Phase 7**: **outstanding**, for the same reason once more: a search
  highlight's whole point is that a rectangle covers the glyphs it claims to.
- **Phase 8A**: **outstanding**, and its own list is in the migration plan's
  Phase 8A "Interactive smoke" section. The first item is the one that matters
  most: _does a native page capture come out sharp, of the right page, uncropped,
  with a white background — and provably without a second document load?_ Then
  the pixel clamp on an A0 page, the crop overlay over the native page box at fit
  and at 150 %, and all four context-menu items doing what they say.

The Phase 5, Phase 6 and Phase 7 checklists are in the migration plan and should be
run in one session. The highest-value items overall: selection alignment against
the canvas at 100 % / 150 % / fit, `Ctrl+C` out of the native layer, pan ⇄ text
switching, link hitbox alignment after a zoom, an external link opening in the
system browser with **no** renderer navigation, a `javascript:` annotation doing
nothing, a highlight sitting **on** its word after a zoom, and a captured page image
that looks like the page.

## Known Issues and Technical Debt

1. **Pixel budget enforced only to a rounding epsilon.** `renderPageToImage.ts`
   derives the ratio from the rounded viewport, then rounds again without
   re-checking: A0 at scale 4 / 20 MP yields 20 001 639 px (0.008 % over). Phase 2
   tests allow a 0.1 % tolerance; a rewrite that re-checks is not strictly
   behaviour-preserving. **Unchanged by Phase 8A.**
2. **The `anchorNode.isConnected` guard in `usePdfTextActions.ts` is nearly dead
   code** — observable only for a non-collapsed range with empty text.
3. **PDF.js 6 removed `PDFDocumentProxy.destroy()`**; teardown goes through
   `PDFDocumentLoadingTask.destroy()`. The engine and the native viewer already
   did; **Phase 8A finished the job** — `renderPageToImage.ts` no longer calls
   `destroy()` on any document.
4. **PDF.js 6 types `DocumentInitParameters.url` as `string | URL` only.**
5. **`scrollbar-gutter-stable`** is applied in `PdfViewerDocument.tsx` but has no
   definition anywhere. Dead class.
6. **Native canvas is not DPR-aware** — 1:1 with CSS pixels on HiDPI. Still
   deferred. Note that capture is _unaffected_: it renders at scale 4 into its own
   canvas, which is why this is cosmetic rather than a capture bug.
7. **Native path renders once at scale 1 before the fit commits** (one frame,
   cancelled mid-flight). Documented, not fixed.
8. **`TextLayer#update()` is unused.** Every zoom rebuilds the whole layer.
9. **Component-local CSS is a new build pattern** (`viewer-<hash>.css`).
10. **PDF.js's `AnnotationLayer` type declarations are stricter than its
    implementation.** Worked around without `as any`.
11. **Named link actions are inert on the native path** (`NextPage`, `PrevPage`, …).
12. **`executeSetOCGState` is a no-op.**
13. **Embedded-file attachments cannot be opened from the native path.**
14. **A destination's implied zoom is ignored**, matching the legacy path.
15. **Native search has no match count, no next/previous match and no page jump.**
16. **Native search scope is the rendered page** (`ViewMode.SinglePage` parity).
17. **`nativeSearchGeometry.ts` is a declared fake layout**, and the honest limit
    of the Phase 7 test suite.
18. **A padded keyword matches literally and finds nothing.** Parity with the
    legacy plugin, and pinned.
19. **`security/audit-exceptions.json`'s prose names a retired call site.** The
    entry is still correct (the viewer is still 3.x) but its `reason` paragraph
    describes `renderPageToImage.ts` as mitigated, and that file no longer touches
    3.x. Left alone by instruction; the entry is deleted in Phase 8B.
20. **`setActivePdfDocument` accepts two shapes.** A real handle, or a raw pdfjs-3
    proxy normalized through `legacyPdfCaptureDocument`. The one structural test
    that distinguishes them (`typeof candidate.isAlive === 'function'`) is the
    price of keeping `PdfViewerElement.tsx` at zero diff. Delete both in Phase 8B.
21. **`lib/renderPageToImage.ts` imports from `features/pdf/native/`.** The only
    edge in the feature that points from a legacy module at the native boundary.
    Exists so capture's fallback load can go through the engine, which is the only
    thing allowed to import `pdfjs-6`. Removed in Phase 8B.
22. **The area/crop screenshot carries no capture metadata of its own.** It hands
    the main process a screen rectangle; if the window is partially occluded the
    captured region is whatever is visible at that position. This is pre-existing
    behaviour on both paths and Phase 8A did not change it, but it is the one
    capture path with no renderer-independent correctness story.

## Temporary Migration Components

- the `pdfjs-6` alias in `package.json`
- the `vendor-pdf-native` / `vendor-pdf-legacy` chunk split in `vite.config.mts`
- the `pdfjsAssets()` plugin that stages `dist/pdfjs/` from `node_modules/pdfjs-6`
- `pdfjs-dual-runtime.test.ts` and the legacy half of
  `pdfjs-engine-worker-coupling.test.ts`
- `isEvalSupported: false` on the 3.x viewer call site
- `VITE_NATIVE_PDF_VIEWER` and `features/pdf/native/**` + `NativePdfViewer.tsx`
- **the two Phase 8A bridges**: `lib/legacyPdfCaptureDocument.ts`, and
  `renderPageToImage.ts` importing `features/pdf/native/nativePdfCaptureDocument.ts`
- the `*.css` module declaration in `src/types/assets.d.ts`

## Important Decisions

**Dual PDF.js runtime (Option B).** _Reason:_ `@react-pdf-viewer@3.12.0` cannot
render against PDF.js 6; a single-version upgrade would leave the app with no
working PDF viewer until the native path was complete. _Removal condition:_ native
feature parity — **reached at the end of Phase 8A**, so this is now overdue.
_Cost:_ two runtimes in the bundle.

**Build-time flag, read at call time.** _Reason:_ the shipped renderer must not
change by accident, and `import.meta.env` read inside a function keeps one code
path across dev / build / packaged app and stays testable without a build.

**Feature switch at the top of `PdfViewerDocument`, not inside `PdfViewerElement`.**
_Reason:_ keeps `PdfViewerElement.tsx` at zero diff and leaves both paths whole.

**Controller always mounted, inert when the flag is off.** _Reason:_ hooks cannot
be conditional; passing `enabled` keeps hook order stable while guaranteeing no
engine, no load and no listeners on the legacy path.

**A handle, not a document proxy, in the capture registry.** _Reason:_ the old
interface was shaped around 3.x's `destroyed`/`destroy()`, which 6.x removed.
Casting a native proxy into it would have read a field 6.x never sets, so a
reloaded document would have looked alive forever. `isAlive()` as an
adapter-provided method is the only shape that is honest on both runtimes, and it
keeps the store free of version knowledge. _Alternative rejected:_ a `version`
field on the handle and a branch in the store — a second place to update when one
runtime is deleted.

**The native adapter owns the temporary document load, and it goes through
`createPdfDocumentManager()`.** _Reason:_ one `getDocument` options builder, one
worker bootstrap and one teardown call, all inherited rather than re-derived — which
is what makes "capture cannot introduce a security-posture divergence" a structural
property instead of a review item. _Alternatives rejected:_ a bare `getDocument` in
the capture path (a second parameter object, a second answer to "is scripting
disabled?"); keeping a 3.x temp load for the legacy path (two runtimes in one
feature, and the CVE exception's second call site would have to stay).

**Capture borrows and the registry cannot destroy.** _Reason:_ a mounted viewer's
document belongs to the viewer; tearing it down from a capture would drop its
shared decoded-object cache and force a font/image re-decode on the next repaint.
Making the store structurally unable to do it is stronger than a comment.
_Removed from the old code:_ the `destroyed` flag read and the
`finally`-scoped `destroy()`; both are now in adapters, and only the _temporary_
document has any teardown at all.

**Liveness is `manager.getDocument() === document`, not a flag.** _Reason:_ 6.x has
no flag to read. The manager already knows the answer in all three windows that
matter — reload, document switch, teardown — because `load()` disposes the
previous task before starting the next one. _Bonus:_ the same predicate makes the
capture registry's reload test a single assertion rather than a race.

**Token-scoped deregistration.** \_Reason:\* `LeftPanel` and `FocusOverlay` can both
be mounted on the same file. The pre-existing semantics (one slot, last writer
wins) are preserved exactly; the token only stops an unmounting viewer from
emptying a slot that is no longer its own. "Currently visible wins" was
considered and **rejected**: it would need a visibility signal the store has no
business reading, and it would have been a new semantic invented in a migration
phase.

**`findNativePageCanvas` validates the page instead of falling back.** \_Reason:\*
the native viewer keeps exactly one canvas, so "the canvas" and "the canvas for
page N" are the same object — a permissive lookup would hand page 5's screenshot
back labelled page 4. Returning `null` lets the direct render path handle it, which
is strictly better than a wrong image. Mirrors the legacy adapter's existing
"never an arbitrary canvas" rule.

**`capturePageRef` rather than a renderer branch inside the capture hook.**
\_Reason:* the legacy `currentPage` is *inert* on the native path, so this was a
correctness bug, not a cosmetic one. `PdfViewerDocument` already owns the switch,
so it is the only place that can name the live page — and a ref is what
`usePdfCaptureActions` already used to read the page exactly once, at capture time,
which is the contract the AI item's `page` metadata depends on.
\_Alternatives rejected:* branching in the hook (a second renderer check, in a file
the architecture deliberately keeps agnostic); moving `usePdfCaptureActions` up into
`PdfViewerDocument` (circular — `usePdfViewerState` needs its handlers for the
Electron screenshot IPC and the menu items, and needs the native controller's page,
which only exists after it runs).

**No change to the context menu, and that is the finding.** _Reason:\*
`usePdfContextMenu` listens on the shared container and `usePdfViewerMenuItems`
builds one item list; three of its four items were reaching into a legacy-only
capability rather than needing a native implementation. Writing a second menu, or a
native branch in the shared one, would have manufactured a difference that does not
exist. \_Consequence:_ a test drives the real menu on the real native canvas, because
"we changed nothing" is not a property that survives on its own.

**The crop screenshot needed no migration at all.** \_Reason:_ it is a
`webContents.capturePage(rect)` in the main process; nothing in it reads the
viewer's DOM, so there were no `.rpv-_`geometry assumptions to re-derive. Only the
page label came from the renderer, which`capturePageRef` fixed.

**Delete the bounding flags rather than leave them false.** \_Reason:\*
`nativeCanvasMode` / `captureActionsDisabled` existed only because capture was
legacy-only. Left in place they could only ever disable a capability that now
works, and would be a second thing to remember in Phase 8B. `pdf_capture_unavailable`
has no remaining reader.

**Leave `security/audit-exceptions.json` alone.** \_Reason:\* the viewer is still the
shipped 3.x consumer, so the exception is still justified and still required; the
instruction for this phase was explicit. The prose drift it now has is recorded as
Known Issue 19 and disappears when Phase 8B deletes the entry.

## Files and Areas That Must Not Be Changed Yet

Zero diff is the expected state for all of these in any phase that is not the one
explicitly requested.

- `package.json`, `package-lock.json`, `.npmrc`
- `vite.config.mts`, `security/audit-exceptions.json`
- `src/features/pdf/ui/components/{PdfViewerElement,PdfWorkerHost}.tsx`
- `src/features/pdf/ui/hooks/usePdfPlugins.ts`
- `src/features/pdf/lib/pdfViewerDom.ts`
- `src/features/pdf/interaction/**` and `text/normalizePdfText.ts`,
  `text/usePdfTextActions.ts`, `text/types.ts`
- `src/features/pdf/store/**` and
  `hooks/{readingHistoryRepository,useReadingProgressPersistence,usePdfNavigation,usePdfViewerZoomOrchestrator,usePdfViewerEffects}.ts`
- `src/features/pdf/viewport/useCoalescedZoom.ts`, `usePdfWheelNavigation.ts`
- `src/shared/styles/**` (all PDF viewer CSS — the native layers have their own)
- any `@react-pdf-viewer/*` usage
- `src/features/pdf/ui/components/PdfSearchBar.tsx`, `ui/hooks/usePdfSearchStore.ts`
  and `usePdfPlugins.ts` — **all three remain zero-diff after Phase 8A**
- `src/shared/styles/modules/_pdf-viewer.css`, including its
  `pdf-highlight-fadein` keyframes
- `src/features/screenshot/**` and `electron/features/screenshot/**` — the crop
  path is renderer-independent and must stay that way
- **changed in Phase 8A, now frozen again:** `lib/renderPageToImage.ts`,
  `lib/activePdfDocumentRegistry.ts`, `capture/findPageCanvas.ts`,
  `capture/usePdfCaptureActions.ts`, `native/nativePdfDom.ts`,
  `native/useNativePdfController.ts`, `ui/components/PdfViewerDocument.tsx`,
  `ui/components/PdfToolbar.tsx`, `ui/components/PdfAiQuickBar.tsx`,
  `hooks/usePdfViewerState.ts`, `hooks/pdfViewerStateTypes.ts`

## Git State

```
Branch: refactor/native-pdfjs-viewer  (tracks origin, fast-forward only)
Base:   master — 5a47228b3d784951ce63e1da30746ce20cadffd0
Ahead of master: 20 behind 0
```

Phase commits, oldest first:

```
b4bd443 docs(pdf): baseline native pdfjs viewer migration
d277420 test(pdf): lock selection, pan, zoom and search highlight behavior
d0564f7 docs(pdf): record phase 3 blocker in the pdfjs 6 upgrade
aef4bb8 chore(pdf): add isolated pdfjs 6 migration runtime
f3d68c6 feat(pdf): add native pdfjs engine foundation
d04e8a3 test(pdf): enforce dual-runtime isolation
fd886b4 docs(agent): add repository handoff context
+ Phase 4 (canvas viewer), Phase 5 (text layer + selection), Phase 6 (annotation
  layer + links), Phase 7 (search + highlights) and Phase 8A (capture + registry
  + context menu) — see `git log --oneline master..HEAD`
```

`master` remains a working RPV + pdfjs 3.x build throughout, so rollback is
"stop shipping the branch", not "reconstruct the old viewer". Do not merge to
master, tag, release or bump the version until the migration completes.

## Next Phase

**Phase 8B — drop RPV, collapse the dual runtime.** Native feature parity was
reached at the end of Phase 8A, so this phase is **deletion**, and its rollback is
`git revert` + `npm ci` from the pre-Phase-8 lockfile — keep the Phase 8 commit
revertable.

Two things to do **first**, in this order:

1. **Run the Phase 5, 6, 7 and 8A interactive smoke lists.** No interactive session
   existed for any of those phases, and Phase 8B deletes the code they would
   exercise. Whatever is unverified when 8B lands is unverified forever.
2. **Run the full `npm test`.** It was skipped for Phase 8A; the repository-wide
   count is still the Phase 7 baseline.

Then the Phase 3B exit plan, in its documented order:

1. delete `@react-pdf-viewer/{core,page-navigation,search,zoom}`
2. delete `PdfWorkerHost` and the legacy `pdf.worker.min.js?url` import
3. delete `vendor-pdf-legacy`, rename `vendor-pdf-native` → `vendor-pdf`
4. delete `pdfjs-dist@3.11.174` and its `overrides` entry
5. delete the `pdfjs-6` alias; make `pdfjs-dist` the direct `6.4.299` pin
6. rewrite the engine's imports `pdfjs-6` → `pdfjs-dist`
7. delete `pdfjs-dual-runtime.test.ts`, rescope or delete
   `pdfjs-engine-worker-coupling.test.ts`
8. delete the `CVE-2024-4367` exception and the remaining
   `isEvalSupported: false` call site
9. revisit the `wasm`/`icc`/`cmap`/font asset staging (it reads from
   `node_modules/pdfjs-6` today)

Two Phase 8A bridges are on that list and must not be missed:

- delete `lib/legacyPdfCaptureDocument.ts` and make `setActivePdfDocument` take
  handles only
- inline `native/nativePdfCaptureDocument.ts` into the capture path once the alias
  is gone, so `renderPageToImage.ts` no longer reaches sideways into the native
  boundary for a pdfjs-6 load

Also on the list, from earlier phases: `usePdfPlugins` (with `safeRenderHighlights`,
`pageNavigationPlugin`, `zoomPlugin`, `searchPlugin`, the 4 CSS imports and ~26
`rpv-*` rule blocks), `PdfViewerElement`, `pdfViewerDom.ts`'s RPV selectors,
`PdfTabStrip`'s internal tests, and the 4 tests that mock `@react-pdf-viewer/core`.

Still deliberately un-migrated, and **not** a Phase 8B blocker because both paths
already have them: form editing (`renderForms: false`), match count / next-prev
match, whole-document search, named link actions, attachment opening.

## Do Not Do Yet

- Do not remove `@react-pdf-viewer`, `pdfjs-dist` 3.x, or the legacy override.
- Do not collapse the dual runtime, remove the `pdfjs-6` alias, or rename
  `vendor-pdf-native`.
- Do not re-introduce a renderer branch into `usePdfCaptureActions`,
  `findPageCanvas`, `usePdfContextMenu`, `usePdfViewerMenuItems` or `ContextMenu`.
- Do not read `PdfDocumentProxy.destroyed`, or add a version check, anywhere in the
  capture registry or `renderPageToImage.ts`.
- Do not add a `destroy()` / `cleanup()` to a borrowed capture handle, or call
  `page.cleanup()` on a borrowed page proxy.
- Do not touch the reading-progress architecture.
- Do not extend `security/audit-exceptions.json`, or drop
  `isEvalSupported: false` from the viewer call site.
- Do not extend `src/shared/styles/**` for native work, or remove `.npmrc` /
  `legacy-peer-deps`.
- Do not modify the Phase 2 regression expectations to make new code pass.
- Do not enable the native viewer by default.
- Do not add `TextLayer#update()` / canvas DPR work opportunistically.
- Do not import `pdfjs-6/web/**` into the native boundary.
- Do not add a second page-index conversion, a second navigation state machine, or
  a second external-URL pathway.
- Do not touch the shared search UI.
- Do not give the native search a whole-document index, a match counter or
  next/previous match.
- Do not write a second context menu.
- Do not fix the pixel-budget rounding epsilon "while you are in there" — it is
  pinned by tests with a deliberate tolerance.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is
   dirty or master has advanced.
3. Compare repository state against this file; where they conflict the repository
   wins.
4. Read `docs/pdfjs-migration-plan.md` for the detail the current phase needs —
   especially the phase table, the Phase 3B exit plan and the Phase 8A section.
5. Read the implementation files relevant to the requested phase:
   `src/features/pdf/native/*`, `src/features/pdf/engine/*`,
   `src/features/pdf/lib/{activePdfDocumentRegistry,renderPageToImage,legacyPdfCaptureDocument}.ts`,
   `src/features/pdf/capture/*`, `text/*`, plus the legacy viewer files it must
   not disturb.
6. If the phase adds or deletes a viewer capability, run the **Phase 5, 6, 7 and
   8A interactive smoke** first — jsdom cannot see layout, so anything about
   geometry, real selection, link hitboxes, highlight alignment or capture
   fidelity is unproven until a human looks at it.
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
