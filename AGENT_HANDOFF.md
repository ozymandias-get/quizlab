# QuizLab Agent Handoff

## Purpose

Persistent working memory for agents on the `refactor/native-pdfjs-viewer` branch.
A new agent that has exhausted its context should be able to read only the
repository and this file, and continue safely from where the last agent stopped.

Not an execution diary — current state, decisions, invariants, next step. Deep
technical reasoning lives in `docs/pdfjs-migration-plan.md`, the authoritative
migration plan.

## Current State

| Field                | Value                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Branch               | `refactor/native-pdfjs-viewer` (base: `master`)                                                          |
| Current phase        | **Post-Phase-10 stabilization, complete and uncommitted**                                                |
| Last completed phase | Phase 10 — deferred-debt closure + baseline refresh (see _Deferred-Debt Decisions_)                      |
| Current HEAD         | `f037d2c`                                                                                                |
| Working tree         | **dirty** — see _Uncommitted Work_ below                                                                 |
| Base SHA at Phase 4  | `5a47228b3d784951ce63e1da30746ce20cadffd0`                                                               |
| Readiness            | single runtime, sole renderer, no feature flag; gates green **as measured at 50bd7ea**, not re-run since |

**The PDF viewer migration is complete and the cleanup phases are complete.** There is
one PDF.js in the tree, one worker, one viewer, and no feature flag.
`@react-pdf-viewer` is gone. Phases 9 and 10 were post-migration cleanup — dead code,
stale comments and documentation, unused dependencies, a refreshed baseline — and
neither changed what the app does. The migration's own exit criterion (Phase 8B) was
met before either began.

A further **stabilization round** then landed on top of Phase 10, uncommitted. It fixed
eleven proven defects and closed two test-coverage gaps; it changed no design decision.
See _Post-Phase-10 Stabilization_ for the list and the tests that pin each one.

### _Uncommitted Work_

The tree is a **mixed batch**. Three groups, and they must not be committed together:

| Group                        | Files                                                                                                                                                               | Notes                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. PDF stabilization         | `src/features/pdf/**`, `electron/__tests__/features/pdf/pdfHandlers.test.ts`, this file, `docs/pdfjs-migration-plan.md`                                             | The 9 fixes, the 2 coverage gaps and the documentation sync. One logical commit.   |
| 2. Unrelated feature work    | automation picker, AI sessions/composer, settings sync, dialog behaviour, language store, `usePdfWorkspaceState` + `usePdfPlaceholderState` relink, and their tests | Belongs to other workstreams. **Do not fold into the PDF commit.**                 |
| 3. `docs/CODING_STANDARD.md` | replaces a stale hardcoded test count with a count-free statement                                                                                                   | Repo-wide doc hygiene, same thread as the Phase 10 baseline refresh. Not PDF work. |

Note that group 2's untracked `src/__tests__/features/pdf/components/pdfPlaceholder/usePdfPlaceholderState.test.tsx`
sits under `features/pdf/` but belongs to the relink workstream, not to group 1.

Phase 4's manual smoke was resolved by user validation in the real application, and the
post-Phase-10 stabilization tree has since had a further **manual session in the
development environment in which the user reported no issue**. Both were manual, and
neither was a per-item walk of a list. The Phase 5, 6, 7, 8A and 8B interactive lists are
therefore **still open** — they are the only thing Phase 8B could not verify, and neither
Phase 9, Phase 10 nor the stabilization round touched them.

## Post-Phase-10 Stabilization

Proven defects found by auditing the migrated code rather than by running it. Each is
pinned by a test that fails without the fix. Items 1–7 are the first round (verified and
committed together with it); 10 and 11 are the follow-up round, which re-verified all
nine and added two more.

| #   | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                   | Root cause in one line                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A canvas is capturable only for the page it is holding.** `nativePdfDom.ts` exports `NATIVE_CANVAS_PAGE_ATTRIBUTE`; `useNativePdfRender` removes it before its first `await` and writes it back only after `renderPage` resolves past the `cancelled` guard; `findNativePageCanvas` now requires the page box **and** the canvas to name the same page, and `findPageCanvas`'s cache re-validates against exactly those conditions. | `data-native-pdf-page` is React _state_ — the page being asked for. `pageRenderer` deliberately never clears the canvas (Known Issue 22), so between a page turn and its render commit the page box already says N while the canvas still shows N−1. A capture in that window sent the **previous page's image labelled N**.                            |
| 2   | **A failed `load()` destroys its own loading task** (`engine/documentManager.ts`).                                                                                                                                                                                                                                                                                                                                                    | A rejected `task.promise` releases nothing in PDF.js; `getDocument` had already spawned a dedicated `PDFWorker` thread, and only `PDFDocumentLoadingTask#destroy()` terminates it. Each failed load left an unreachable orphan worker.                                                                                                                  |
| 3   | **A rejected temporary capture load releases its manager** (`engine/captureDocument.ts`).                                                                                                                                                                                                                                                                                                                                             | `release()` is only reachable once the promise resolves, and a rejected load is the _common_ case for the temporary path — it exists for the moments there is nothing to borrow.                                                                                                                                                                        |
| 4   | **Emptying the search input clears the highlights** (`PdfToolbar.tsx`).                                                                                                                                                                                                                                                                                                                                                               | The search bar's inline `clear` X goes through the same callback as typing; the debounce's `if (keyword.trim())` therefore did nothing, and `clearHighlights()` was unreachable from that path.                                                                                                                                                         |
| 5   | **`/UserUnit` is folded into `--total-scale-factor`** (`useNativePdfDocument.ts` → `useNativePdfController.ts` → `NativePdfViewer.tsx`).                                                                                                                                                                                                                                                                                              | PDF.js's `PageViewport` does `scale *= userUnit` before sizing, so the canvas was `scale × userUnit` while the CSS layers were laid out at `scale`. For a `/UserUnit 2` document every word and every annotation hitbox sat at half size in the top-left quadrant.                                                                                      |
| 6   | **A superseded capture is silent** (`usePdfCaptureActions.ts`).                                                                                                                                                                                                                                                                                                                                                                       | The inner `showError` skipped the supersession guard every other `showError` honours, so a double-clicked capture could raise "capture failed" next to the image its successor queued.                                                                                                                                                                  |
| 7   | **IPC zoom-in is clamped like zoom-out** (`usePdfViewerZoomIpc.ts`).                                                                                                                                                                                                                                                                                                                                                                  | One direction clamped and the other did not, contradicting invariant 11 as written. Latent only: the channel clamps.                                                                                                                                                                                                                                    |
| 8   | **New `src/__tests__/features/pdf/viewport/usePdfWheelNavigation.test.tsx`**.                                                                                                                                                                                                                                                                                                                                                         | `usePdfWheelNavigation` is all of wheel navigation and had **zero** coverage after the `usePdfNavigation` tests were deleted with that hook.                                                                                                                                                                                                            |
| 9   | **New `pdfHandlers.test.ts` case** for the `safeSend` `isDestroyed` guard commit `38c8a4c` added.                                                                                                                                                                                                                                                                                                                                     | Every other mock sender lacks `isDestroyed`, so the guard's actual purpose was never exercised.                                                                                                                                                                                                                                                         |
| 10  | **A named-destination lookup that rejects resolves to "no destination"** (`nativePdfLinkService.ts`).                                                                                                                                                                                                                                                                                                                                 | The `getDestination` await was unguarded while its `getPageIndex` sibling was guarded, contradicting the module's own "Nothing here rejects" promise. PDF.js wires `goToDestination` into a link `onclick` without awaiting it, so a corrupt `/Dests` tree surfaced as an unhandled rejection and an error toast over a link the reader merely clicked. |
| 11  | **A file switch cancels the pending search debounce** (`PdfToolbar.tsx`).                                                                                                                                                                                                                                                                                                                                                             | The file-change effect cleared the overlay but not the timer, so a keyword typed for the previous file fired up to 300 ms later and highlighted the **old document's term on the new document's page**.                                                                                                                                                 |

Two tests changed **assertions** rather than adding cases, and both changes are
behavioural, not cosmetic:

- `captureDocument.test.ts` — a test literally named _"propagates a failed load without
  leaking a task"_ asserted `expect(destroy).not.toHaveBeenCalled()`, pinning the leak
  its own name described. Now `toHaveBeenCalledTimes(1)`.
- `findPageCanvas.test.ts` — the fixture stamps the committed-page attribute, and the
  page-turn case now asserts that **neither** page is served from a canvas whose render
  has not committed. This is the corrected contract fix 1 establishes.

Two production changes already in the tree before either round are load-bearing for the
same reason and are recorded here so the next agent does not "simplify" them: `renderError`
is keyed to `(page, scale)` and cleared on leaving `ready`, because the error shell
removes the canvas; and `useNativePdfDocument` withholds the outgoing document's metadata
during an identity-changing render, so `initialPage` and the fit effect cannot read it.

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
   **Phase 10 corrected the premise of this item.** The half that was closed is the
   renderer half, and it is closed and live. The _producer_ half never existed:
   `electronAPI.showPdfContextMenu` has **zero callers in `src/`**, so
   `pdfHandlers.ts` has never been able to build that menu and nothing has ever sent
   `TRIGGER_PDF_VIEWER_ZOOM` or `TRIGGER_SCREENSHOT`. Both events' renderer consumers
   are mounted and correct, but they are consumers of an event nobody emits. See
   _Deferred-Debt Decisions_ §2 — this is a product decision, not cleanup, and it
   means "context-menu zoom" on the interactive smoke list cannot currently pass.
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
still live, so **it was deliberately left alone** through Phase 10 as well. Removing it
needs the eslint conflict resolved first, and that is not cleanup.

## Native PDF Engine

`src/features/pdf/engine/` — React-free, DOM-free, viewer-free, asserted by test.
Direction is `UI → engine → pdfjs-dist`; the reverse is forbidden.

| File                    | Responsibility                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfWorker.ts`          | publishes `GlobalWorkerOptions.workerSrc` once — the **only** assignment in the codebase                                                                                                                                                           |
| `pdfDocumentOptions.ts` | the single authoritative `getDocument` parameter builder: scripting + asset policy                                                                                                                                                                 |
| `documentManager.ts`    | owns the `PDFLoadingTask`; load / reload / getDocument / getPage / destroy, generation-based stale-load protection. A failed load disposes its own task — the one path that has to, because a rejected `task.promise` leaves a worker thread alive |
| `pageCache.ts`          | page number → `PDFPageProxy`; clearable, rejected lookups not cached                                                                                                                                                                               |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, supersede-cancel, typed cancellation                                                                                                                                                            |
| `captureDocument.ts`    | the engine's public **capture/document adapter**: handle creation + the temporary isolated load. A load that never resolves hands its teardown to `manager.destroy()`, because the caller never receives the object                                |
| `index.ts`              | barrel: exactly `createPdfDocumentManager`, `createPageRenderer`, `isRenderCancelled` and their types — the entry point for everything except capture                                                                                              |

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

| File                             | Responsibility                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nativePdfBounds.ts`             | `clampPdfPage` (1-based) and `clampPdfScale` on the shared `PDF_ZOOM_*`                                                                                                                                                |
| `nativePdfDom.ts`                | the viewer's markup contract + the page/canvas/text/annotation/search lookups. Also owns `NATIVE_CANVAS_PAGE_ATTRIBUTE`, the marker a canvas carries for the page it is _holding_ — half of what makes a capture exact |
| `nativePdfTextLayer.css`         | PDF.js's text-layer layout, scoped to `data-native-pdf-*`                                                                                                                                                              |
| `nativePdfAnnotationLayer.css`   | PDF.js's `.annotationLayer` layout rules, scoped the same way                                                                                                                                                          |
| `nativePdfSearchLayer.css`       | the search overlay + highlight layout, scoped to `data-native-pdf-search-*`                                                                                                                                            |
| `nativePdfLinkService.ts`        | PDF.js's link-service surface over the page state + `openExternal`                                                                                                                                                     |
| `nativePdfSearch.ts`             | the search engine: page text, literal matching, `Range` geometry                                                                                                                                                       |
| `nativeZoomControls.tsx`         | render-prop zoom components for the shared toolbar, incl. `aria-keyshortcuts`                                                                                                                                          |
| `useNativeCoalescedScale.ts`     | the one-zoom-per-frame channel                                                                                                                                                                                         |
| `useNativePdfEngine.ts`          | 1 × `createPdfDocumentManager()` + 1 × `createPageRenderer()` per mount                                                                                                                                                |
| `useNativePdfDocument.ts`        | `(pdfUrl, reloadKey)` → status, `numPages`, first-page size and `/UserUnit`; withholds the outgoing document's metadata during an identity-changing render                                                             |
| `useNativePdfCaptureDocument.ts` | publishes the mounted document to the capture registry, token-scoped                                                                                                                                                   |
| `useNativePdfPageState.ts`       | 1-based clamped `currentPage`; consumes `initialPage` once per identity                                                                                                                                                |
| `useNativePdfScaleState.ts`      | numeric clamped `scale`, fit once per document identity                                                                                                                                                                |
| `useNativePdfRender.ts`          | one page → one canvas, supersede-cancel                                                                                                                                                                                |
| `useNativePdfTextLayer.ts`       | one page → one PDF.js `TextLayer`, supersede-cancel, page cache                                                                                                                                                        |
| `useNativePdfAnnotationLayer.ts` | one page → one PDF.js `AnnotationLayer` + link service, supersede-destroy                                                                                                                                              |
| `useNativePdfSearch.ts`          | keyword → highlight rectangles: lifecycle + `highlight`/`clearHighlights`                                                                                                                                              |
| `useNativePdfController.ts`      | composition, the toolbar contract, and the shared-hook wiring                                                                                                                                                          |

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
  `textLayerError` / `annotationLayerError`. `renderError` is keyed to the `(page, scale)`
  that produced it and is cleared as soon as the status leaves `ready`, because the
  error shell removes the canvas and a stale failure would keep the replacement page
  from ever mounting one.
- **Canvas, text layer and annotation layer share one viewport.** The canvas is painted
  at `getViewport({ scale })`, which PDF.js computes as `scale × userUnit`, so
  `--total-scale-factor` on the page box is that same product (`scale * pageUserUnit`) —
  not the bare scale. Publishing only the scale mislaid both layers on any document
  declaring `/UserUnit != 1`.
- **A canvas is capturable only while it is holding the requested page.**
  `useNativePdfRender` removes `data-native-pdf-canvas-page` before its first `await` and
  writes it back only after `renderPage()` resolves past the `cancelled` guard, so the
  interval between a page turn and its render commit — and the whole of a zoom re-render —
  is refused rather than labelled with a page it is not showing. See _Known Issues_ 25.
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
    Two markers have to agree: `data-native-pdf-page` names the page the viewer is
    _asking for_ (React state, so it flips on commit) and `data-native-pdf-canvas-page`
    names the page the canvas is _holding_ (`useNativePdfRender` writes it only on render
    commit). `findNativePageCanvas` answers `null` unless both name the same page, and
    `findPageCanvas`'s cache re-checks exactly that, so it can never serve a canvas the
    lookup would have refused.
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

**This is a measurement, not an invariant.** It is the only full `npm test` run
recorded for Phase 10, taken on the tree below. Phase 9 removed vacuous and duplicate
test files, so the old Phase-7/8B figures were hundreds of tests too high and were
replaced rather than adjusted. Whoever changes the suite should re-measure instead of
editing the numbers to taste.

```
Measured at:   50bd7ea (code) on 2026-10-07
Command:       npm test  (vitest run)
Test files:    330 passed / 330
Tests:         3828 passed | 2 skipped | 0 failed | 0 todo   (3830 total)
Duration:      255.32s
```

`vitest.config.mts` includes exactly `src/__tests__/**` and `electron/__tests__/**`,
which is 237 + 93 = **330** files on disk — the reported file count matches the tree,
so nothing was silently excluded. The **2 skips** are pre-existing and host-specific:
`electron/__tests__/core/ConfigManager.extended.test.ts` guards two POSIX `chmod`
tests with `skip: os.platform() === 'win32'`, so the number is 2 on Windows and 0
elsewhere.

**This block is not re-measured since `50bd7ea`.** Commits and an uncommitted
stabilization tree have landed since; the suite has not been re-run in full, so treat the
figures above as a past measurement, not a current one. The on-disk suite has since grown
past the 330 files the run reported. Per the rule below, the next agent who changes the
suite re-measures rather than editing these numbers.

### Targeted sets re-run during Phase 10

```
src/__tests__/features/pdf + src/__tests__/architecture
  + src/__tests__/shared/ipcChannels.test.ts + electron/__tests__
                162 files · 2200 passed · 2 skipped · 0 failed
```

### Static gates (all green at 50bd7ea)

`typecheck`, `lint`, `format:check`, `analyze:css`, `analyze:architecture`,
`analyze:file-sizes`, `ci:check-hygiene`, `ci:check-version`, `check:audit`,
`check:electron-security`, `git diff --check`. `check:audit` reports a clean shipped
tree with 0 exceptions. `check:electron-security` reports no HIGH/CRITICAL.

### Build (at 50bd7ea)

`npm run build` (`tsc -b` + renderer + backend) succeeds. `npm run build:renderer:electron`
emits **one** PDF chunk (`vendor-pdf-DSIvYwED.js`, 436.85 kB), **one** worker
(`pdf.worker.min-CjEcRF4W.mjs`) and the full `dist/pdfjs/` tree (200 files). Zero RPV
and zero PDF.js 3 traces in `dist/`. `npm ls pdfjs-dist` → `pdfjs-dist@6.4.299`,
one resolved runtime.

## Deferred-Debt Decisions (Phase 10)

Eight items were explicitly deferred by Phase 9. All eight are now **settled**.
Recorded here so no future agent re-audits them.

| #   | Item                                    | Verdict                                |
| --- | --------------------------------------- | -------------------------------------- |
| 1   | `useNativePdfController` `enabled` knob | **KEPT** — settled, do not re-audit    |
| 2   | `SHOW_PDF_CONTEXT_MENU`                 | **KEPT / DEFERRED** — product decision |
| 3   | `SELECT_FOLDER`                         | **REMOVED** (commit `09c2037`)         |
| 4   | `data-native-pdf-annotation-page`       | **REMOVED** (commit `ee43fa2`)         |
| 5   | `data-native-pdf-search-page`           | **REMOVED** (commit `ee43fa2`)         |
| 6   | `semver` dev dependency                 | **REMOVED** (commit `8e80064`)         |
| 7   | `@types/semver` dev dependency          | **REMOVED** (commit `8e80064`)         |
| 8   | stale regression-baseline counts        | **REPLACED** with a measured run       |

**1 — `enabled`: KEEP.** It is genuine `VITE_NATIVE_PDF_VIEWER` residue — its own doc
comment says "The feature flag.", and it was introduced in `53c253b` behind that flag,
which `19ac492` deleted, leaving the literal `true` in `usePdfViewerState.ts:89`. It
is threaded into **9** sub-hooks, so removal is a 16-file / ~57-line change across the
entire native rendering + lifecycle boundary, and it would delete 5 tests whose subject
("the viewer is off") has no production referent. **Rejected on cost, not on merit**:
zero architectural benefit, maximum blast radius, in a phase whose mandate is no
architectural churn. It also has no half-measure — dropping it from the controller
while keeping the sub-hook parameters would leave 9 permanently-`true` dead
parameters. The sub-hook `enabled` guards are **not** dead: the real lifecycle
vocabulary in that file is `status === 'ready'`, `isReady`, `documentKey` and
`engine() !== null`, and the shared viewport hooks keep their own independent
`enabled` either way. If a future phase does want this gone, it needs its own phase.

**2 — `SHOW_PDF_CONTEXT_MENU`: KEPT, deferred to a product decision.** Proven
caller-less: `electronAPI.showPdfContextMenu` (`electron/preload/index.ts:72`) has zero
callers in `src/`, no dynamic dispatch exists anywhere (`ipcRenderer[...]`,
`Record<channel, …>`, `Object.keys(IPC_CHANNELS)` all absent), and this has been true
since the repository's first commit. **But it is not deleted**, because it is the sole
producer of `TRIGGER_SCREENSHOT` and `TRIGGER_PDF_VIEWER_ZOOM`, whose renderer
consumers (`usePdfViewerEffects`, `usePdfViewerZoomIpc`) are mounted and correct.
Deleting it would orphan two more chains, so the cascade — not the channel — is the
decision. The real question is whether the native Electron PDF menu should exist at
all; the renderer already has its own React `ContextMenu`, and `usePdfViewerMenuItems`
omits zoom on purpose because the toolbar owns it. **This needs a human.**

**3 — `SELECT_FOLDER`: REMOVED.** Six sites, zero test changes. Zero `ipcRenderer.invoke`
reaches it, `usePdfApi` exposes no wrapper, and no button, menu item, accelerator,
drag-drop handler or i18n key drives it. Caller-less at every historical state checked
(`ea9f623`, `90d4b0c`, `a2b43e4`). `openDirectory` is now at zero occurrences repo-wide.
Removing it is pure attack-surface reduction; `contextIsolation`, `sandbox`,
`requireTrustedIpcSender`, the external-URL checks and the permission handlers are
untouched.

**4 & 5 — the two `-page` layer attributes: REMOVED.** Their only consumers were 7
test assertions that re-checked React state the code already holds. No CSS rule, no
`querySelector`, no `dataset`, no `getAttribute` in production, no doc, and the
repository has no e2e harness at all. Contrast the siblings that _are_ load-bearing:
`data-native-pdf-text-page` backs `findNativeTextLayerForPage`, and `data-native-pdf-page`
is one of the **two** markers that make `findNativePageCanvas` refuse a wrong-page canvas
(the other is `data-native-pdf-canvas-page`, added by the stabilization round — see
_Post-Phase-10 Stabilization_ #1). Neither removed attribute had a selector constant or a
lookup function. Both layers are ref-addressed, so their page comes from React state and
from `searchLayer.closest(NATIVE_PAGE_SELECTOR)`. Two `waitForFrames` conditions were
**rebuilt, not deleted**, and both are stricter than what they replaced — the old
page-change wait was satisfied by a re-render from `currentPage` alone, so it would
have passed with no new `AnnotationLayer` ever constructed.

**6 & 7 — `semver` / `@types/semver`: REMOVED.** No `import`, `require()` or dynamic
`import()` of `semver` anywhere in `src/`, `electron/`, `shared/`, `scripts/` or config,
and no file imports a semver type. The two places that look like they need it both
hand-roll it: `scripts/check-version-consistency.mjs:11` uses a local regex plus exact
string equality against `` `v${version}` ``, and `electron/core/updater.ts#isNewer`
`parseInt`s dot-split segments. `@types/semver` is not ambient either — both leaf
tsconfigs set `"types": ["node"]`, so `@types/*` is opted-in and narrowed.
`semver` survives as a transitive dep of cspell, patch-package, eslint-plugin-unicorn,
`@typescript-eslint/*`, electron, electron-builder and the commitlint chain, so no tool
loses access to it; only the root declaration is gone.

## Interactive Smoke State

**USER-OWNED. One manual session has been run on the current tree and the user reported
no issue. That is weak positive evidence, not a per-item sign-off: do not mark any line
below PASS on the strength of it.**

- **USER-VERIFIED (manual)**: the user exercised the viewer in the development
  environment on the post-Phase-10 stabilization tree and reported no issue. Manual,
  user-driven; **not** an automated smoke, E2E or screenshot comparison, and not a
  walk of this list item by item.
- **Phase 4**: resolved — the user manually exercised the viewer and reported no issue.
- **Phase 5**: still open individually. A manual session has now looked at the native text
  layer and reported no issue, but that is not a sign-off of the Phase 5 line.
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
  QuizLab's own markup. (They now have their own test suite, which cannot substitute for
  a real keypress in a real window.)
- **Phase 8B follow-up (vertical centering)**: outstanding. jsdom has no box model, so
  `nativePageLayout.test.tsx` pins the _structural_ contract (which element scrolls, which
  element carries `m-auto`, which subtree moves together) and nothing more. The manual
  session reported no issue, which is weak positive evidence for this invariant and not a
  measurement of it; treat "the page is vertically centered" as unverified.
- **Phase 10 finding that changes the list**: the "Electron context-menu zoom" smoke item
  **cannot pass as written**. The native Electron menu is unreachable — nothing calls
  `electronAPI.showPdfContextMenu` — so a right-click shows only the renderer's own React
  menu (add page text to AI, send page as image, crop screenshot, reload). If the user
  expects a native menu with Zoom In / Zoom Out / Reset, that is **missing capability,
  not a regression**; report it rather than filing it against this branch's parity work.
  The keyboard-zoom item is unaffected and still testable from the toolbar.

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
    an eslint peer conflict; removing it needs that conflict resolved first and was left
    alone through Phase 10.
19. **`nativePageLayout.test.tsx` cannot measure layout.** jsdom performs no box model —
    every rect is `0×0`, `scrollHeight === clientHeight`, and no margin is ever resolved —
    so the file asserts the structural layout contract instead and says so in its header.
    A future agent must not "upgrade" it by fabricating pixel geometry: that would assert
    the helper's arithmetic rather than the browser's. The vertical-centering invariant is
    confirmed by the interactive smoke list, not by that suite.
20. **The native Electron PDF context menu is unreachable, and has been since the first
    commit.** `pdfHandlers.ts` builds a real `Menu` with full-page screenshot, area
    screenshot, Zoom In / Zoom Out / Reset Zoom and Reload, and forwards the zoom items
    over `TRIGGER_PDF_VIEWER_ZOOM` — but `electronAPI.showPdfContextMenu` has **zero
    callers in `src/`**, so the menu is never built and neither `TRIGGER_SCREENSHOT` nor
    `TRIGGER_PDF_VIEWER_ZOOM` is ever emitted. The renderer has its own React
    `ContextMenu` instead, and `usePdfViewerMenuItems` omits zoom on purpose because the
    native controller owns its scale outright. So the "Electron context-menu zoom"
    parity item above is closed only on the renderer half, and the interactive-smoke line
    for context-menu zoom **cannot pass** until a human decides whether that menu should
    exist. Phase 10 kept the channel for exactly this reason; see _Deferred-Debt
    Decisions_ §2.
21. **The page transition's ramp is 5 % opacity, not a fade.** `NATIVE_PAGE_TRANSITION_START_OPACITY`
    is `0.95`, and the reason is structural rather than aesthetic, so a future agent must not
    "improve" it upward. The four layers do not finish together: the canvas commits first and
    fires `onRenderCommitted`, while the text layer is still on its own `getPage` /
    `getTextContent()` / stream render and the annotation layer on its own `getPage` /
    `getAnnotations()` / build. For that interval the page box holds a canvas with no words on
    it. A 0.55 floor turned the interval into a visible blink — the ramp was dimming the only
    layer that had arrived — so the fix is to make the interim state _invisible_ rather than to
    avoid it. Waiting for the layers instead would delay the presentation by however long a text
    layer takes to drain, which is the "navigation, blank wait, then animation" shape that feels
    sluggish, and a document whose text layer fails outright would never present a turn at all.
    **Do not deepen this ramp, and do not gate the transition on layer readiness.**
22. **`pageRenderer` never clears the canvas.** It sizes the canvas only when the size actually
    changes, because assigning `canvas.width`/`canvas.height` resets the backing store
    _unconditionally_ — the assignment is the reset. An unguarded assignment blanked the canvas
    at navigation time on every same-size page turn, before PDF.js had painted an operator, and
    the gap was **white** rather than merely empty because PDF.js's `beginDrawing` fills the page
    background `#ffffff` before it draws. That was the white flash, and it was not render
    latency. It was also a layout win to skip: the canvas's intrinsic size is its layout size, so
    a redundant assignment is a redundant resize of the page box and of the `m-auto` margins that
    centre it. Nothing else clears the canvas and nothing needs to — PDF.js fills the whole canvas
    at the start of every render, so a genuine size change overwrites the old page by itself.
    **This also makes `onRenderCommitted` a meaningful signal rather than a race**, which is what
    `useNativePdfRender` and the whole transition timing rest on. Do not reintroduce the
    unconditional assignment "to be safe", and do not add a `clearRect` in its place.
23. **`useNativePdfController`'s `enabled` parameter is dead weight** — always `true` in
    production, genuine feature-flag residue, threaded into 9 sub-hooks. Kept in Phase 10
    because removal is a 16-file change across the whole native boundary for no
    architectural gain. Do not re-audit it; read _Deferred-Debt Decisions_ §1 instead.
24. **`/UserUnit` is read from page 1 and published document-wide.**
    `viewport.userUnit` comes from `firstPage.getViewport({ scale: 1 })`, so
    `pageUserUnit` is a document-scoped number, not a per-page one. That is correct for
    every document that does not set `/UserUnit` (all of them) and for the documents that
    do, because exporters set it uniformly; it is only wrong for a document whose pages
    declare _different_ `/UserUnit` values, where each canvas is painted at its own
    userUnit while all three layers are laid out at page 1's. Page 1 is the only place a
    fit-scale input already comes from, and adding a per-page lookup would cost an async
    round trip per page turn to fix a case no known exporter produces. Recorded so a future
    agent does not mistake the scoping for an oversight.
25. **The canvas legitimately holds the previous page between a turn and its render
    commit.** This is the direct consequence of Known Issue 22: not clearing the canvas
    is correct for presentation and wrong for capture, and
    `data-native-pdf-canvas-page` exists to reconcile them. **Do not reintroduce the
    unconditional `canvas.width` / `canvas.height` assignment in `pageRenderer` expecting
    capture to be unaffected** — that is precisely the interval the committed-page marker
    closes, and the white flash Known Issue 22 describes would return with it.
26. **`renderError` is keyed to `(page, scale)` and cleared on leaving `ready`.** Worth
    recording because it changes the meaning of a controller field and because it exists
    only because the error shell replaces the canvas: a failure left standing would keep
    the replacement page from ever mounting a canvas to render into.

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

- `src/features/pdf/ui/hooks/**`, `src/features/pdf/viewport/**`,
  `src/features/pdf/interaction/**`
- `src/features/pdf/text/normalizePdfText.ts`, `text/usePdfTextActions.ts`, `text/types.ts`
- `src/features/pdf/store/**` and
  `hooks/{readingHistoryRepository,useReadingProgressPersistence,usePdfViewerEffects}.ts`
  (`usePdfNavigation.ts` was deleted in Phase 8B; only these three remain)
- `src/features/pdf/native/**` + `engine/**` — the migration's output; the
  naming is settled, the behaviour is not. `enabled` is settled too: see
  _Deferred-Debt Decisions_ §1 before touching it. The stabilization round did change six
  files here, so "unchanged" here means unchanged _by a phase_, not frozen forever.
- `electron/features/pdf/pdfHandlers.ts` — kept only under _Deferred-Debt Decisions_ §2.
  (Its test changed in the stabilization round; the handler itself did not.)
- `package.json`, `package-lock.json`, `.npmrc` (`legacy-peer-deps` needs the eslint
  peer conflict resolved first; the two `semver` entries are already gone)
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

**None pending from cleanup.** Phases 9 and 10 are both closed, and the stabilization
round is closed too. The branch is prepared for a commit and then a merge decision.

The merge decision still needs its **own authorisation** and is not part of any cleanup
phase.

Open candidates, none of which is cleanup:

1. **The interactive smoke list.** This is still the real next step. One manual session has
   reported no issue, but jsdom cannot see layout, so geometry, real selection, link
   hitboxes, highlight alignment, capture fidelity and keyboard zoom are all still
   unproven item by item, and only a human in a real window can settle them. Read the
   Phase 10 note in _Interactive Smoke State_ before running the context-menu line.
2. **Decide the native Electron PDF context menu** — build the sender for
   `SHOW_PDF_CONTEXT_MENU`, or delete the handler and the two `TRIGGER_*` chains it
   feeds. That is a product decision with a dependency-cascade consequence, deliberately
   not taken in Phase 10. See _Deferred-Debt Decisions_ §2.
3. Remove `.npmrc`'s `legacy-peer-deps=true` once the eslint peer conflict that still
   needs it is resolved. Deliberately untouched; the flag is real, not stale.
4. `npm run analyze:deadcode` may still name migration scaffolding that was left
   deliberately reachable. Read the finding against _Deferred-Debt Decisions_ before
   acting on it.
5. If `useNativePdfController`'s `enabled` really is to go, that is its own phase sized
   for a 16-file change — not a cleanup appendage.

## Do Not Do Yet

- Do not re-audit the eight items in _Deferred-Debt Decisions_. They are settled with
  evidence; re-deriving them is how this repository grew a 700-line handoff.
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
- Do not deepen `NATIVE_PAGE_TRANSITION_START_OPACITY` above `0.95`, gate the page transition on
  layer readiness, or move the ramp earlier than the render commit. See _Known Issues_ 21.
- Do not assign `canvas.width` / `canvas.height` unconditionally in `pageRenderer`, and do not
  add a `clearRect` there. See _Known Issues_ 22.
- Do not add, remove or hand-set `data-native-pdf-canvas-page` anywhere but
  `useNativePdfRender`, and do not capture from `[data-native-pdf-canvas]` without it. It is
  the only thing standing between a capture and the previous page's pixels. See
  _Known Issues_ 25.
- Do not publish a bare `scale` as `--total-scale-factor`. It has to be
  `scale * pageUserUnit`, or every `/UserUnit != 1` document misplaces its text and links.
- Do not rename the native viewer or the `native/` boundary. That is a separate phase.

## Resume Checklist

1. Read this file.
2. Run `git status --short`, `git branch --show-current`, `git rev-parse HEAD`,
   `git rev-parse origin/refactor/native-pdfjs-viewer`,
   `git rev-list --left-right --count origin/master...HEAD`. **The tree is dirty right
   now**, by design — read _Current State_ → _Uncommitted Work_ and the
   _Post-Phase-10 Stabilization_ list before touching anything, and stop if the tree is
   dirty in a way neither describes.
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
