# QuizLab Agent Handoff

## Purpose

Persistent working memory for agents on the `refactor/native-pdfjs-viewer` branch.
A new agent that has exhausted its context should be able to read only the
repository and this file, and continue safely from where the last agent stopped.

Not an execution diary — current state, decisions, invariants, next step. Deep
technical reasoning lives in `docs/pdfjs-migration-plan.md`, the authoritative
migration plan.

## Current State

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Branch               | `refactor/native-pdfjs-viewer` (base: `master`)                                  |
| Current phase        | **Phase 9 — general cleanup, in progress**                                       |
| Last completed phase | Phase 8B — legacy RPV removal + collapse to a single PDF.js 6 runtime            |
| Current HEAD         | run `git rev-parse HEAD`                                                         |
| Working tree         | **dirty** — Phase 9 is in flight and several agents hold it                      |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                       |
| Readiness            | single runtime, sole renderer, no feature flag; Phase 9 gates **not yet re-run** |

**The PDF viewer migration is complete and Phase 9 is not migration work.** There is
one PDF.js in the tree, one worker, one viewer, and no feature flag.
`@react-pdf-viewer` is gone. Phase 9 is post-migration cleanup — comment and
terminology accuracy, dead code, stale documentation — and it must not change what the
app does. The migration's own exit criterion (Phase 8B) was met before it began.

Phase 4's manual smoke was resolved by user validation in the real application.
The Phase 5, 6, 7, 8A and 8B interactive lists are **still outstanding** — see
_Interactive Smoke State_. They are the only thing Phase 8B could not verify, and
Phase 9 does not touch them.

## Current Goal

There is no active migration goal. The branch exists to deliver a native PDF.js 6
viewer, and it does: one page, one text layer, one annotation layer, one search
overlay, one capture pipeline, one zoom channel, one worker.

The next goal is a **merge decision**: `master` is still a working
`@react-pdf-viewer` + pdfjs 3.x build, so rollback is currently "stop shipping the
branch". Merging is deliberately out of scope for this branch (no PR, no merge, no
tag, no release) and needs its own authorisation.

## Completed Migration Phases

Phases 1–4 (history, kept short — the detail is in `docs/pdfjs-migration-plan.md`):

- **1 — baseline.** Architecture mapped, RPV coupling identified, migration judged
  viable with risks. No source change. `@react-pdf-viewer/core@3.12.0` `require()`s
  `pdfjs-dist` and no viewer release supports pdfjs ≥ 4.
- **2 — regression hardening.** 125 tests across 6 new files plus 1 extended,
  mutation-validated. The safety net for every later phase.
- **3 — single-version attempt. BLOCKED, not implemented.** RPV 3.12 calls
  `renderTextLayer()` and `new SVGGraphics()`, both removed in 4.x. Reverted.
- **3B — dual-runtime foundation.** The `pdfjs-6` alias, `features/pdf/engine/`,
  packaged assets, split security posture, isolation enforced by tests.
- **4 — native canvas viewer + page/scale state.** The first engine consumer, behind
  a build-time flag.

### Phases 5–8A — feature parity

- **5 — text layer + selection.** PDF.js 6's own `TextLayer`; the Phase 2 selection
  suite passed byte-identical.
- **6 — annotation layer + links.** PDF.js's `AnnotationLayer`; internal
  destinations drive the native page, external links go through the app's existing
  `openExternal` IPC, AcroForm widgets stay display-only.
- **7 — search + highlights.** A native overlay porting the legacy plugin's own DOM
  walk; `PDFFindController` declined (it lives in `pdfjs-dist/web/**` and wants an
  event bus). Scope is the rendered page.
- **8A — capture + registry + context menu.** The last three legacy-only
  capabilities. The registry became a runtime-agnostic handle; capture's fallback
  document load moved onto the engine.

### Phase 8B — legacy removal + single runtime (done)

The deletion phase, plus **two parity blockers found and closed before any deletion**.

**The blockers.** Removing RPV would have silently killed two shipped capabilities
that existed only inside it:

1. _Electron context-menu zoom._ The PDF window menu's Zoom In / Zoom Out / Reset
   Zoom forwarded over `TRIGGER_PDF_VIEWER_ZOOM` terminated at RPV's `zoomTo`, with
   reset expressed as `SpecialZoomLevel.PageWidth`. The hook is now numeric — reset
   takes the same fit scale `usePdfResizeRefit` and `useNativePdfScaleState#fit`
   already use — and is declared in `useNativePdfController`, so the subscription
   lives and dies with the viewer and exactly one responds.
2. _Keyboard zoom._ `zoomPlugin({ enableShortcuts: true })` bound Ctrl/Cmd +
   `-` / `=` / `0`. `usePdfZoomShortcuts` restores the key set, modifier rule,
   `document`-level listener and conditional `preventDefault`. It deliberately does
   **not** copy RPV's `container.contains(document.activeElement)` scope check: QuizLab
   never moves DOM focus into the PDF surface, so that check would have made the
   shortcuts unreachable while the toolbar advertises `+ / −` unconditionally. Whether
   the legacy shortcut was in fact reachable is a human-smoke question.

`aria-keyshortcuts` moved with the bindings it describes.

**Mechanical findings closed in the same phase:** RPV type leakage out of the shared
state module; the render error guard moved off the deleted worker host to app boot; the
pan fallback repointed at a native viewport selector; the five reading-progress resume
tests re-homed onto the native page state; and the security-gate exception test repaired
so it cannot go vacuous with an empty exception list.

**Deleted:** `PdfViewerElement`, `PdfWorkerHost`, `usePdfPlugins`, `usePdfNavigation`,
`usePdfViewerZoomOrchestrator`, `useCoalescedZoom`, `lib/pdfViewerDom.ts`,
`legacyPdfCaptureDocument.ts`, `nativePdfViewerFlag.ts`, the four `@react-pdf-viewer/*`
packages, `pdfjs-dist@3.11.174` + its `overrides` entry, the `pdfjs-6` alias, the
`VITE_NATIVE_PDF_VIEWER` flag, and all 38 `.rpv-*` CSS rules.

## Current PDF Architecture

```
LeftPanel / FocusPdfBody
   └─ PdfViewer (lazy) ──► PdfViewerDocument        ← pure JSX shell
        └─ usePdfViewerState                        ← owns the live state
             ├─ useNativePdfController              ← the single renderer
             │    └─ @features/pdf/engine            ← the only PDF.js importer
             │         pdfjs-dist@6.4.299 → pdf.worker.min.mjs
             ├─ usePdfCaptureActions                 (renderer-agnostic)
             ├─ usePdfPanTool                        (renderer-agnostic)
             ├─ usePdfTextActions                    (renderer-agnostic)
             └─ usePdfContextMenu + menuItems        (renderer-agnostic)
```

`PdfViewerDocument` renders exactly one container, one `NativePdfViewer` and one
`PdfToolbar`. There is no `import.meta.env` read anywhere in the PDF feature.

**The inversion that used to exist is gone.** `lib/renderPageToImage.ts` needed a PDF.js
document for capture's temporary load and reached sideways into `native/` to get one.
The adapter now lives at `engine/captureDocument.ts`, because the engine is the only
place allowed to import PDF.js and capture needs a document. `lib/` → `engine/`
replaces `lib/` → `native/`.

## Dependency State

| Entry                     | Value             | Role                |
| ------------------------- | ----------------- | ------------------- |
| `pdfjs-dist`              | `6.4.299` (exact) | **the only PDF.js** |
| `overrides["pdfjs-dist"]` | _gone_            | no longer needed    |
| `pdfjs-6` alias           | _gone_            | collapsed           |
| `@react-pdf-viewer/*`     | _gone_            | removed             |

`npm ls pdfjs-dist` → `pdfjs-dist@6.4.299`. `npm ls @react-pdf-viewer/*` → `(empty)`.

`.npmrc` still has `legacy-peer-deps=true`. It was needed to suppress RPV's peer
`ERESOLVE`; that is gone, but the setting also governs an eslint peer conflict that is
still live, so **it was deliberately left alone** and is Phase 9's business.

## Native PDF Engine

`src/features/pdf/engine/` — React-free, DOM-free, viewer-free, asserted by test.
Direction is `UI → engine → pdfjs-dist`; the reverse is forbidden.

| File                    | Responsibility                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfWorker.ts`          | publishes `GlobalWorkerOptions.workerSrc` once — the **only** assignment in the codebase                                                              |
| `pdfDocumentOptions.ts` | the single authoritative `getDocument` parameter builder: scripting + asset policy                                                                    |
| `documentManager.ts`    | owns the `PDFLoadingTask`; load / reload / getDocument / getPage / destroy, generation-based stale-load protection                                    |
| `pageCache.ts`          | page number → `PDFPageProxy`; clearable, rejected lookups not cached                                                                                  |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, supersede-cancel, typed cancellation                                                               |
| `captureDocument.ts`    | the engine's public **capture/document adapter**: handle creation + the temporary isolated load                                                       |
| `index.ts`              | barrel: exactly `createPdfDocumentManager`, `createPageRenderer`, `isRenderCancelled` and their types — the entry point for everything except capture |

`captureDocument.ts` is the one deliberate addition to a pure engine, and it earns its
place: capture needs a PDF.js document, the engine is the only place allowed to import
one, and it is what makes "capture cannot introduce a security-posture divergence" a
structural property rather than a review item. It is the engine's second entry point and
is reached by deep import (`@features/pdf/engine/captureDocument`), which is why the
barrel does not re-export it.

Still absent: form editing (`renderForms: false`). Search lives in the viewer boundary,
not the engine.

## Capture Architecture

```
usePdfCaptureActions (renderer-agnostic)
  │  page ← the viewer's live page, written by usePdfViewerState
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

| Path                    | Where it lives                    | Native support                         |
| ----------------------- | --------------------------------- | -------------------------------------- |
| page → image (high-DPI) | `lib/renderPageToImage.ts`        | direct PDF.js render + canvas fallback |
| area / crop screenshot  | `startScreenshot` → main process  | identical — no `.rpv-*` geometry       |
| selection screenshot    | same as above (`captureKind` tag) | identical                              |
| current rendered canvas | `capture/findPageCanvas.ts`       | `nativePdfDom.findNativePageCanvas`    |

`renderPageToImageFallback` still has **no cancellation parameter**, deliberately.
Capture supersession is decided by the caller's request stamp.

## Active Document Registry

`lib/activePdfDocumentRegistry.ts` — one slot, runtime-agnostic, zero PDF.js knowledge.

```ts
interface ActivePdfDocumentHandle {
  getPage(pageNumber: number): Promise<CaptureDocumentPage>
  isAlive(): boolean
}
```

- **Owns:** lookup, identity, liveness, eviction of a dead entry.
- **Does not own:** the document, its loading task, or its teardown. There is no
  `destroy()` anywhere in the surface.
- **One producer:** `engine/captureDocument.ts`. The old raw-pdfjs-3-proxy shim is gone,
  so there is no "accepts two shapes" special case left to get wrong.
- **Never branches on a PDF.js version.** Every version-specific fact lives in the adapter.

Registration returns an opaque token; `clearActivePdfDocument(token)` withdraws **only that
entry**, which is what keeps an unmounting `LeftPanel` from evicting a live `FocusOverlay`.
`clearActivePdfDocument()` with no token empties the slot. Semantics otherwise unchanged: a
single slot, **most recent registration wins**.

## Viewer Boundary

Exactly four files import `@features/pdf/engine`, and all four are inside
`features/pdf/`: `native/useNativePdfEngine.ts` and `native/useNativePdfRender.ts` (via
the barrel), plus `native/useNativePdfCaptureDocument.ts` and `lib/renderPageToImage.ts`
(both narrowly, for the capture adapter). `ui/components/NativePdfViewer.tsx` does not
import the engine at all — it reaches it only through those hooks — and `native/` has no
barrel of its own since `native/index.ts` was deleted in Phase 9. Asserted by
`architecture/pdfjs-single-runtime.test.ts`, together with the inverse: no
`@react-pdf-viewer` import and no `rpv-*` string in that boundary.

| File                             | Responsibility                                                                |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `nativePdfBounds.ts`             | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*`       |
| `nativePdfDom.ts`                | the viewer's markup contract + the page/canvas/text/annotation/search lookups |
| `nativePdfTextLayer.css`         | PDF.js's text-layer layout, scoped to `data-native-pdf-*`                     |
| `nativePdfAnnotationLayer.css`   | PDF.js's `.annotationLayer` layout rules, scoped the same way                 |
| `nativePdfSearchLayer.css`       | the search overlay + highlight layout, scoped to `data-native-pdf-search-*`   |
| `nativePdfLinkService.ts`        | PDF.js's link-service surface over the page state + `openExternal`            |
| `nativePdfSearch.ts`             | the search engine: page text, literal matching, `Range` geometry              |
| `nativeZoomControls.tsx`         | render-prop zoom components for the shared toolbar, incl. `aria-keyshortcuts` |
| `useNativeCoalescedScale.ts`     | the one-zoom-per-frame channel                                                |
| `useNativePdfEngine.ts`          | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount       |
| `useNativePdfDocument.ts`        | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size                   |
| `useNativePdfCaptureDocument.ts` | publishes the mounted document to the capture registry, token-scoped          |
| `useNativePdfPageState.ts`       | 1-based clamped `currentPage`; consumes `initialPage` once per identity       |
| `useNativePdfScaleState.ts`      | numeric clamped `scale`, fit once per document identity                       |
| `useNativePdfRender.ts`          | one page → one canvas, supersede-cancel                                       |
| `useNativePdfTextLayer.ts`       | one page → one PDF.js `TextLayer`, supersede-cancel, page cache               |
| `useNativePdfAnnotationLayer.ts` | one page → one PDF.js `AnnotationLayer` + link service, supersede-destroy     |
| `useNativePdfSearch.ts`          | keyword → highlight rectangles: lifecycle + `highlight`/`clearHighlights`     |
| `useNativePdfController.ts`      | composition, the toolbar contract, and the shared-hook wiring                 |

Invariants worth knowing before changing it:

- **Effect order matters three times, and all three are load-bearing.** The
  engine-creating effect is declared before the document-loading effect; the
  capture-registration effect immediately after it; the text-layer,
  annotation-layer and search effects after both render effects, so the DOM is torn down
  and rebuilt in paint order and the text layer's synchronous cleanup empties the runs
  search is about to measure.
- **Page indexing is 1-based.** A PDF destination index is 0-based and is converted
  **once**, in `nativePdfLinkService.ts`. Capture passes `pageNumber` straight to
  `getPage`, which is also 1-based.
- **Zoom is one change per frame** through `useNativeCoalescedScale`. Every source —
  toolbar, Ctrl+wheel, resize refit, initial fit, keyboard, Electron context menu — is
  clamped by `clampPdfScale` and funnels through the same channel.
- **Cancellation is not an error.** `RenderingCancelledException` (canvas) and
  `AbortException` (text layer) are dropped; genuine failures become `renderError` /
  `textLayerError` / `annotationLayerError`.
- **Canvas, text layer and annotation layer share one viewport**, and
  `--total-scale-factor` on the page box is that same number.
- **The search overlay is the fourth layer**, declared last in the DOM on purpose,
  painted by `z-index: 1` between the text layer and the annotation layer.
- **Capture borrows; it never destroys.** No `page.cleanup()` on a borrowed proxy.
- **Liveness is the manager's question, not the proxy's.** PDF.js 6 has no
  `PDFDocumentProxy#destroyed`, so the adapter asks `manager.getDocument() === document`.
  A throwing probe counts as dead.
- **`initialPage` is consumed once per `(pdfUrl, reloadKey)` identity**, not per prop
  change. `initialPage` mirrors persisted progress, so consuming it on every change would
  reset the viewer to the saved page on every page turn.
- **DPR is not applied** to the native canvas. Capture is unaffected: it renders at
  scale 4 into its own canvas.

Reused unchanged: `useFitScale`, `useContainerSize`, `useLastNavigationTime`,
`usePdfWheelNavigation`, `usePdfCtrlWheelZoom`, `usePdfResizeRefit`,
`usePdfZoomShortcuts`, `usePdfViewerZoomIpc`, **`usePdfTextActions`**,
**`usePdfCaptureActions`**, `usePdfContextMenu`, `useCanvasGpuCleanup`, `PdfToolbar`,
`PdfZoomControls`, `PdfPageNav`, `ContextMenu`, `InlineSpinner`,
`onReadingProgressChange`.

## Worker Architecture

| Field     | Value                                               |
| --------- | --------------------------------------------------- |
| Specifier | `pdfjs-dist/build/pdf.worker.min.mjs?url`           |
| Owner     | `engine/pdfWorker.ts` — the only assignment         |
| Strategy  | `GlobalWorkerOptions.workerSrc`, never `workerPort` |
| Emitted   | one `pdf.worker.min-<hash>.mjs`                     |

`workerSrc` is deliberate: `workerPort` would move the worker's whole lifetime into our
code and stop PDF.js reusing its global worker.

## Security State

- `enableScripting: false` on every `getDocument` path, via a narrow local intersection
  (no `as any`), **and** on the annotation layer's `render()`.
- `hasJSActions: false` on the annotation layer, which together with the above is what
  keeps `LinkAnnotationElement#_bindJSAction` unreachable.
- `renderForms: false` — AcroForm widgets stay display-only.
- A `javascript:` annotation target is given **no `href` at all**, plus `aria-disabled`,
  plus a cancelled click.
- External link targets go through `electronAPI.openExternal`, never `window.open` /
  `location.href`; the renderer checks the protocol against the main process's own list
  (`https:`, `mailto:`) and refuses embedded credentials, and the main process
  re-validates before `shell.openExternal`.
- File attachments and `Launch` actions are inert.
- **`isEvalSupported` is at zero occurrences in production code.** The knob was removed
  in PDF.js 4.x, so there was nothing to port.
- **`security/audit-exceptions.json` is empty.** `CVE-2024-4367` /
  `GHSA-wgrm-67xf-hhpq` affects `pdfjs-dist <=4.1.392`; 6.4.299 is outside that range, so
  the finding is fixed rather than mitigated. The entry is **deleted, not re-dated** —
  `check-audit.mjs` fails an exception whose advisory is no longer reported.
- `npm run check:audit` reports a **clean shipped tree with 0 exceptions**. The 33
  remaining high/critical findings are build/lint tooling only and are not shipped.
- `check:electron-security`: no HIGH/CRITICAL (baseline 1 LOW, 14 MEDIUM).

### The render error guard

`features/pdf/errors/pdfRenderErrors.ts` installs a `window` `unhandledrejection` filter
for PDF.js render-cancellation races. It is mounted at **app boot** in `app/main.tsx`,
after `installGlobalErrorHandlers` so `defaultPrevented` suppresses the toast too. It used
to hang off `PdfWorkerHost`, which meant lazily installed, once per mounted viewer, and
only while a PDF panel existed.

## Critical Invariants

1. The native viewer is the only PDF renderer. Do not reintroduce a second one.
2. `pdfjs-dist@6.4.299` is pinned exactly, and it is the only PDF.js. Engine and worker
   are the same dependency, so a range could hand the engine a worker from another major.
3. `engine/pdfWorker.ts` is the only place that assigns `GlobalWorkerOptions.workerSrc`.
4. Only `features/pdf/native/**` + `lib/renderPageToImage.ts` may import
   `@features/pdf/engine`. `NativePdfViewer.tsx` reaches the engine only through those
   hooks; adding a direct import there would put a UI component on the wrong side of the
   boundary.
5. The engine contains no React / UI / zustand / viewer dependencies.
6. No PDF.js web-viewer import (`pdfjs-dist/web/**`) anywhere — QuizLab supplies its own
   page view, and importing it would pull a second viewer in behind the one.
7. Native PDF JavaScript execution stays disabled (`enableScripting: false` on the
   document and the annotation layer).
8. Native page indexing is 1-based; a PDF destination's 0-based index is converted
   **exactly once**, in `nativePdfLinkService.ts`.
9. A PDF link never navigates the renderer.
10. The native viewer never emits an `rpv-*` class and never reuses one.
11. **One zoom channel.** Every programmatic zoom source is numeric, clamped by
    `clampPdfScale`, and funnels through `useNativeCoalescedScale`.
12. `usePdfViewerZoomIpc` is numeric. `reset` means the fit scale — never a keyword.
13. `usePdfZoomShortcuts` calls `preventDefault()` only for a key it actually handles, and
    never while the event target is an editable field.
14. `usePdfTextActions` stays renderer-agnostic and is mounted once, against the shared
    container. A selection is PDF text only if it lands inside the text layer.
15. Capture **borrows**; it never destroys. A borrowed handle exposes no teardown, the
    registry has no `destroy()`, and no page `cleanup()` is called on a borrowed proxy.
16. The capture registry is runtime-agnostic. `isAlive()` is adapter-provided; a version
    check or a `destroyed`-flag read in the store is a bug.
17. **One `getDocument` options builder, one worker source.** Capture gets both by going
    through the engine, never by building its own.
18. The page a capture is labelled with is the viewer's live page.
19. **A canvas is only ever captured for the page it is showing.**
    `findNativePageCanvas` validates `[data-native-pdf-page]` rather than falling back to
    "the one canvas there is".
20. `initialPage` is consumed once per `(pdfUrl, reloadKey)` identity, so a saved page that
    no longer matches where the reader is must be **ignored**.
21. `pdf-highlight-fadein` is defined once, in `src/shared/styles/modules/_pdf-viewer.css`.
    The native search layer references it rather than redeclaring it; deleting it with the
    RPV rules would silently break the highlight animation.
22. No capture control is renderer-bounded any more.
23. **Native page placement.** When the rendered page is shorter than the available PDF
    viewport, the entire native page stack is vertically centered. When the rendered page
    exceeds the viewport, normal scrolling is preserved and the page top remains
    reachable. This is carried by `m-auto` on the `[data-native-pdf-page]` wrapper, never
    by `align-items: center` / `justify-content: center` on `[data-native-pdf-scroll]`:
    `center` overflows _equally in both directions_ when free space is negative, so the
    start-side overflow lands before the scroll origin and the top of a tall page becomes
    unreachable. An auto margin is resolved before alignment and is zeroed for an
    overflowing item, so one declaration satisfies both halves. The centering viewport is
    the page scroll container, which fills the viewer area; the toolbar is a `shrink-0`
    flow sibling, not an overlay, so it is excluded from that height. Do **not** move the
    margin onto the canvas: canvas, `TextLayer`, `AnnotationLayer` and `SearchLayer` all
    share the page wrapper precisely so the whole stack moves as one unit.

## Regression Baseline

Last re-verified after the vertical-centering fix, on top of the Phase 8B baseline.

```
Targeted:      src/__tests__/features/pdf + src/__tests__/architecture
               68 files · 880 passed · 0 failed

Blast radius:  + app, components/layout, platform
               118 files · 1235 passed · 0 failed
```

> **These counts predate Phase 9 and are stale as file counts.** Phase 9 removed
> vacuous and duplicate test files and deleted `src/features/pdf/native/index.ts`, so
> the file counts above are known to be too high. The pass/fail figures are the last
> measured truth; nobody has re-run the suite for Phase 9 yet. Whoever closes Phase 9
> must re-measure and replace both blocks rather than leave a plausible-looking number.

> **The full `npm test` run was not executed** — it is intentionally skipped unless a
> targeted failure indicates broader validation is necessary. The repository-wide count is
> therefore still the **Phase 7 baseline**: 361 files · 3996 passed · 2 skipped · 0 failed.
> The 2 skips are pre-existing (Electron `ConfigManager`).

Static gates green after the centering fix: `typecheck`, `lint`, `format:check`,
`analyze:architecture`, `analyze:file-sizes`, `analyze:css`, `ci:check-hygiene`,
`git diff --check`. `check:audit` / `check:electron-security` were last green at Phase 8B
and are unaffected by a renderer-only CSS change.

Build: `npm run build:renderer:electron` emits **one** PDF chunk (`vendor-pdf`, 426.62 kB),
**one** worker (`pdf.worker.min-<hash>.mjs`) and the full `dist/pdfjs/` tree
(200 files: cmaps 169, standard_fonts 16, wasm 13, iccs 2). Zero RPV traces in `dist/assets`.

`electron/__tests__` were not run; they do not import PDF.js and the centering fix touches
neither `electron/` nor `shared/` behaviour.

## Interactive Smoke State

**USER-OWNED / OUTSTANDING until the user reports results. Do not mark this PASS.**

- **Phase 4**: resolved — the user manually exercised the viewer and reported no issue.
- **Phase 5**: outstanding. No interactive session existed; the native text layer has
  never been looked at in a real browser.
- **Phase 6**: outstanding, and jsdom structurally cannot cover it — an annotation layer's
  whole point is geometry, and no test can prove a link's hitbox sits over its words.
- **Phase 7**: outstanding, for the same reason once more: a highlight's whole point is
  that a rectangle covers the glyphs it claims to.
- **Phase 8A**: outstanding. Sharp text on a captured page, correct page, uncropped, white
  background, and **provably no second document load**; the pixel clamp on an A0 page; the
  crop overlay over the native page box at fit and at 150 %; all four context-menu items.
- **Phase 8B**: outstanding, and it now carries an extra question — **does Ctrl/Cmd +
  `-` / `=` / `0` zoom actually work**, and did it work under RPV? The audit could not
  settle whether RPV's focus-containment check made those bindings unreachable in
  QuizLab's own markup.
- **Phase 8B follow-up (vertical centering)**: outstanding. jsdom has no box model, so
  `nativePageLayout.test.tsx` pins the _structural_ contract (which element scrolls, which
  element carries `m-auto`, which subtree moves together) and nothing more. Nobody has
  looked at a centered page in a real window, so treat "the page is vertically centered"
  as unverified until the user runs the list below.

The highest-value items overall: selection alignment against the canvas at 100 % / 150 % /
fit, `Ctrl+C` out of the native layer, pan ⇄ text switching, link hitbox alignment after a
zoom, an external link opening in the system browser with **no** renderer navigation, a
`javascript:` annotation doing nothing, a highlight sitting **on** its word after a zoom, a
captured page image that looks like the page, and the keyboard zoom shortcuts.

**Phase 8B deleted the dual-runtime comparison** ("both PDF paths side by side") and with
it the flag-off path, so these lists are now the only interactive verification this viewer
has.

## Known Issues and Technical Debt

1. **Pixel budget enforced only to a rounding epsilon.** `renderPageToImage.ts` derives
   the ratio from the rounded viewport, then rounds again without re-checking: A0 at
   scale 4 / 20 MP yields 20 001 639 px (0.008 % over). Tests allow 0.1 %; a rewrite that
   re-checks is not strictly behaviour-preserving. **Not fixed by Phase 8B.**
2. **The `anchorNode.isConnected` guard in `usePdfTextActions.ts` is nearly dead code** —
   observable only for a non-collapsed range with empty text.
3. **`scrollbar-gutter-stable`** looks undefined in the repository but is **not** — it is
   a Tailwind 4.3.1 built-in utility, so the class on `PdfViewerDocument.tsx` compiles to
   `scrollbar-gutter: stable` and reserves the gutter on the `overflow: hidden` container.
   Do not "clean it up" on the grounds that no CSS file defines it; verify against
   `node_modules/tailwindcss` first.
4. **Native canvas is not DPR-aware** — 1:1 with CSS pixels on HiDPI. Cosmetic: capture is
   unaffected, because it renders at scale 4 into its own canvas.
5. **Native path renders once at scale 1 before the fit commits** (one frame, cancelled
   mid-flight). Documented, not fixed.
6. **`TextLayer#update()` is unused.** Every zoom rebuilds the whole layer.
7. **PDF.js's `AnnotationLayer` type declarations are stricter than its implementation.**
   Worked around without `as any`.
8. **Named link actions are inert** (`NextPage`, `PrevPage`, …).
9. **`executeSetOCGState` is a no-op.**
10. **Embedded-file attachments cannot be opened.**
11. **A destination's implied zoom is ignored**, matching the legacy path. Historical note:
    that parity target was `@react-pdf-viewer`, deleted in Phase 8B, so this is now a
    standing decision to revisit rather than parity to maintain.
12. **Native search has no match count, no next/previous match and no page jump.**
13. **Native search scope is the rendered page.**
14. **`src/__tests__/features/pdf/native/nativeSearchGeometry.ts` is a declared fake
    layout**, and the honest limit of the Phase 7 test suite. It is a _test helper_, not
    production code: the real geometry comes from `Range.getClientRects()` in
    `nativePdfSearch.ts`, and jsdom implements neither it nor `getBoundingClientRect()`,
    so the helper supplies stand-in boxes. It proves the arithmetic and the lifecycle; it
    cannot prove that a rectangle covers the glyphs it should.
15. **A padded keyword matches literally and finds nothing.** Parity with the
    `@react-pdf-viewer/search` plugin that Phase 8B deleted, and pinned by test. Historical
    note: there is no longer a second implementation to diverge from, so this is a standing
    choice to revisit rather than an ongoing parity obligation.
16. **The area/crop screenshot carries no capture metadata of its own.** It hands the main
    process a screen rectangle; if the window is partially occluded the captured region is
    whatever is visible at that position. Pre-existing on both the legacy and the native
    path, so Phase 8B changed nothing here, and it is the one capture path with no
    renderer-independent correctness story.
17. **`usePdfViewerZoomIpc` duplicates a small amount of zoom policy.** The controller
    already has `zoomIn`/`zoomOut`/`fit`, but the hook takes the numeric channel so it can
    keep its own arithmetic tests and stay renderer-agnostic. Deliberate; worth revisiting
    if the two ever drift.
18. **`.npmrc` still sets `legacy-peer-deps=true`** although RPV is gone. It still governs
    an eslint peer conflict; removing it is Phase 9's business, not this phase's.
19. **`nativePageLayout.test.tsx` cannot measure layout.** jsdom performs no box model —
    every rect is `0×0`, `scrollHeight === clientHeight`, and no margin is ever resolved —
    so the file asserts the structural layout contract instead and says so in its header.
    A future agent must not "upgrade" it by fabricating pixel geometry: that would assert
    the helper's arithmetic rather than the browser's. The vertical-centering invariant is
    confirmed by the interactive smoke list, not by that suite.

## Temporary Migration Components

**None.** The list is closed:

- ~~the `pdfjs-6` alias~~ gone
- ~~the `vendor-pdf-native` / `vendor-pdf-legacy` chunk split~~ gone
- ~~`pdfjsAssets()` reading `node_modules/pdfjs-6`~~ repointed at `node_modules/pdfjs-dist`
- ~~`pdfjs-dual-runtime.test.ts`~~ replaced by `pdfjs-single-runtime.test.ts`
- ~~the legacy half of `pdfjs-engine-worker-coupling.test.ts`~~ file deleted
- ~~`isEvalSupported: false` on the 3.x viewer call site~~ gone
- ~~`VITE_NATIVE_PDF_VIEWER`~~ gone
- ~~`lib/legacyPdfCaptureDocument.ts`~~ gone
- ~~`renderPageToImage.ts` importing `features/pdf/native/`~~ gone
- ~~the `*.css` legacy worker module declaration in `src/types/assets.d.ts`~~ now declares
  the `.mjs` worker

## Important Decisions

**Dual PDF.js runtime (Option B).** _Reason:_ `@react-pdf-viewer@3.12.0` cannot render
against PDF.js 6; a single-version upgrade would have left the app with no working viewer
until the native path was complete. _Removed at the end of Phase 8B._

**A handle, not a document proxy, in the capture registry.** _Reason:_ the old interface was
shaped around 3.x's `destroyed`/`destroy()`, which 6.x removed. Casting a native proxy
into it would have read a field 6.x never sets, so a reloaded document would have looked
alive forever. `isAlive()` as an adapter-provided method is the only shape honest on one
runtime, and it keeps the store free of version knowledge.

**The capture adapter lives in the engine, not in `native/`.** _Reason:_ capture needs a
PDF.js document and the engine is the only place allowed to import one. Leaving it in
`native/` meant `lib/` reached sideways across the boundary — the one inverted edge in the
feature. _Rejected:_ a new `lib/capture/` layer, which would have been a bigger abstraction
for the same job.

**`usePdfViewerState` owns the controller.** _Reason:_ it used to be a _legacy_ state hook
holding a second, inert copy of the page and the scale. With the renderer gone, that copy
had no producer, and the shared consumers were reading a page that lagged by a render.
Moving the controller in means capture, pan, text actions and the context menu read the
live page directly, and `PdfViewerDocument` is pure JSX.

**Numeric zoom IPC contract.** _Reason:_ `SpecialZoomLevel.PageWidth` was a viewer API, not
a scale — only RPV's own `zoomTo` could interpret it. With one runtime there is exactly one
number "fit to page width" can mean, and it is the one `useFitScale` already computes.
_Alternative rejected:_ a command contract (`zoomIn`/`zoomOut`/`fit`) delegating to the
controller, which is smaller but turns the hook into a router and moves its arithmetic
tests out of the file that owns the policy.

**Keyboard shortcut scope: "a PDF is ready" + not-an-editable-field.** _Reason:_ RPV's
`container.contains(document.activeElement)` test is not a policy QuizLab can satisfy —
nothing in the PDF surface takes focus — so copying it would have produced a shortcut that
never fires while the toolbar advertises `+ / −`. The editable-target exclusion is the
app's existing convention (`FocusOverlay`'s Escape guard uses the same selector).
**Flagged:** whether the legacy shortcut was actually reachable is unverified and belongs in
the interactive smoke list.

**`aria-keyshortcuts` follows the binding.** _Reason:_ RPV stamped it on its zoom buttons, so
it described a shortcut the viewer really handled. Dropping it silently would have removed
an accessibility affordance that is now ours to keep.

**Delete the CVE exception rather than re-date it.** _Reason:_ 6.4.299 is outside the
affected range, so the finding is fixed, and `check-audit.mjs` fails an exception whose
advisory is no longer reported. Keeping it would break the gate, not preserve a decision.

**The render error guard moved to app boot.** _Reason:_ it is a window listener with no
React or viewer dependency. Under `PdfWorkerHost` it was installed lazily, once per mounted
viewer, and only while a PDF panel existed — three ways to be missing when it is needed.

**Keep the native viewer's names.** _Reason:_ renaming `NativePdfViewer` /
`features/pdf/native/**` to drop the "Native" would have produced a large diff of pure
churn on top of a deletion phase. It is a naming-cleanup phase, not this one.

## Files and Areas That Must Not Be Changed Yet

Zero diff is the expected state for all of these in any phase that is not the one
explicitly requested.

- `package.json`, `package-lock.json`, `.npmrc` (the `legacy-peer-deps` line is Phase 9's)
- `src/features/pdf/ui/hooks/**`, `src/features/pdf/viewport/**`,
  `src/features/pdf/interaction/**`
- `src/features/pdf/text/normalizePdfText.ts`, `text/usePdfTextActions.ts`, `text/types.ts`
- `src/features/pdf/store/**` and
  `hooks/{readingHistoryRepository,useReadingProgressPersistence,usePdfViewerEffects}.ts`
  (`usePdfNavigation.ts` was deleted in Phase 8B; only these three remain)
- `src/features/pdf/native/**` and `features/pdf/engine/**` — the migration's output; the
  naming is settled, the behaviour is not
- `src/shared/styles/**` (the native layers have their own stylesheets)
- `src/features/screenshot/**` and `electron/features/screenshot/**` — the crop path is
  renderer-independent and must stay that way
- `src/features/pdf/ui/components/PdfSearchBar.tsx`, `ui/hooks/usePdfSearchStore.ts`
- `security/audit-exceptions.json` — it is empty and correct; adding an entry needs a real
  advisory

## Git State

```
Branch: refactor/native-pdfjs-viewer  (tracks origin, fast-forward only)
Base:   master
Ahead of master: run `git rev-list --left-right --count master...HEAD` (stale as of writing)
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
+ Phases 4 – 8B and the post-8B polish commits — see `git log --oneline master..HEAD`
```

`master` remains a working RPV + pdfjs 3.x build, so rollback is "stop shipping the
branch". Do not merge to master, tag, release or bump the version.

## Next Phase

**Phase 9 — general cleanup: in progress.** The merge decision still needs its own
authorisation and is not part of Phase 9.

Phase 9 is cleanup of the finished migration: dead code, stale comments and
documentation, vacuous tests. It must not change what the app does, and it does not
retire the interactive smoke list — see below for the items that are still open.

Open candidates:

1. `npm run analyze:deadcode` / `analyze:knip` / `analyze:prune` — several modules were
   left deliberately reachable during the migration and may now be orphans.
2. Remove `.npmrc`'s `legacy-peer-deps=true` once the eslint peer conflict that still needs
   it is resolved. Deliberately untouched so far; the flag is real, not stale.
3. Re-measure and replace the Regression Baseline counts, which predate this phase.
4. Nothing else in the PDF feature. It is done.

**The interactive smoke list is still outstanding** and is not a Phase 9 deliverable:
jsdom cannot see layout, so geometry, real selection, link hitboxes, highlight alignment,
capture fidelity and keyboard zoom are all unproven. A later phase — or the merge
decision — has to own it.

## Do Not Do Yet

- Do not reintroduce a second PDF renderer, a feature flag, or an `@react-pdf-viewer`
  dependency. Phase 8B exists so they cannot come back.
- Do not re-introduce a renderer branch into `usePdfCaptureActions`, `findPageCanvas`,
  `usePdfContextMenu`, `usePdfViewerMenuItems` or `ContextMenu`.
- Do not read `PDFDocumentProxy.destroyed`, or add a version check, anywhere in the capture
  registry or `renderPageToImage.ts`.
- Do not add a `destroy()` / `cleanup()` to a borrowed capture handle, or call
  `page.cleanup()` on a borrowed page proxy.
- Do not import `pdfjs-dist/web/**` into the viewer boundary.
- Do not pass a PDF.js scale keyword anywhere. The whole scale domain is numeric.
- Do not add a second `getDocument` options path, or let capture build its own.
- Do not touch the reading-progress architecture.
- Do not extend `security/audit-exceptions.json`.
- Do not add `TextLayer#update()` / canvas DPR work opportunistically.
- Do not add a second page-index conversion, a second navigation state machine, or a
  second external-URL pathway.
- Do not give the native search a whole-document index, a match counter or next/previous
  match.
- Do not recentre the native page with `items-center` / `justify-content: center` on
  `[data-native-pdf-scroll]`, and do not move `m-auto` from the page wrapper onto the
  canvas. Both undo invariant 23: the first strands the top of a tall page above the
  scroll origin, the second desynchronises the canvas from the text, annotation and
  search layers.
- Do not write a second context menu.
- Do not fix the pixel-budget rounding epsilon "while you are in there" — it is pinned by
  tests with a deliberate tolerance.
- Do not rename the native viewer or the `native/` boundary. That is a separate phase.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. Stop if the tree is dirty or
   master has advanced.
3. Compare repository state against this file; where they conflict the repository wins.
4. Read `docs/pdfjs-migration-plan.md` — especially Part I §12 (zoom and navigation), the
   Phase 3B exit plan, and the Phase 8B section.
5. Read the implementation files relevant to the requested phase: `src/features/pdf/native/*`,
   `src/features/pdf/engine/*`, `src/features/pdf/lib/{activePdfDocumentRegistry,renderPageToImage}.ts`,
   `src/features/pdf/capture/*`, `text/*`, `viewport/*`.
6. If the phase touches the PDF viewer's geometry, selection, links, highlights, capture or
   keyboard input, remember that jsdom cannot cover any of it — run the **interactive smoke
   list** above, which is user-owned.
7. Execute **only** the explicitly requested phase.
8. **Run the complete dependency-aware targeted test set for the changed phase.** Do not run
   repository-wide `npm test` unless explicitly requested or a targeted failure indicates
   broader validation is necessary.
9. Update this file before finishing.

## Handoff Maintenance Rules

- Every agent MUST read this file before modifying the repository.
- Every agent MUST update this file before finishing a completed phase.
- Do not append an execution diary. Rewrite stale state instead of accumulating
  contradictory history.
- Keep completed phases concise.
- Keep Current State, Security State, Known Issues, Git State and Next Phase current.
- Repository + Git + test/build results override this document if they conflict.
- `docs/pdfjs-migration-plan.md` holds the deep technical migration detail; do not
  duplicate it here.
- Do not record secrets, tokens, credentials or machine-specific paths here.
