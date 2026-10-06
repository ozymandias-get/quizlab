# Moving off pdfjs-dist 3.x

Planning document. No upgrade has been performed; this records what a move would
require and what currently blocks it, so the decision can be made deliberately
instead of discovered during an install.

Current state: `pdfjs-dist@3.11.174` (exact pin, plus an `overrides` entry) and
`@react-pdf-viewer/{core,page-navigation,search,zoom}@3.12.0`.
Open advisory accepted in `security/audit-exceptions.json`: `CVE-2024-4367`
mitigated by `isEvalSupported: false`, entry expires **2026-12-31**.

Everything under "verified" was read out of the installed packages and this
repository. Anything that could not be checked offline is called out as such.

---

# Part I — Phase 1 baseline: native PDF.js viewer

Added on `refactor/native-pdfjs-viewer`, branched from `master` `5a47228`. No
production code, dependency, lockfile or `.npmrc` change was made; this part is
discovery plus the verified upgrade deltas in Part II.

Registry access **was** available for this baseline, so the two questions Part I
previously had to leave open ("could not be verified") are now answered from the
npm registry and from an unpacked `pdfjs-dist@6.4.299` tarball.

## 1. Dependency graph (verified)

```
quizlab-reader@6.6.0
├── pdfjs-dist@3.11.174            (dependency, exact pin; also in `overrides`)
└── @react-pdf-viewer/core@3.12.0
    │   peerDependencies: { pdfjs-dist: "^2.16.105 || ^3.0.279", react: ">=16.8.0" }
    │   bundle: lib/cjs/core.js → single reference: require('pdfjs-dist')
    │   ⇒ ONE engine instance, resolved from the root node_modules copy
    ├── @react-pdf-viewer/page-navigation@3.12.0   → core (deduped)
    ├── @react-pdf-viewer/search@3.12.0            → core (deduped)
    └── @react-pdf-viewer/zoom@3.12.0              → core (deduped)
```

- `npm ls pdfjs-dist` → `3.11.174` at the root, **deduped**, and marked
  `overridden` (the `overrides` entry at `package.json:273`).
- The plugin packages declare **no** `pdfjs-dist` at all; they only depend on
  `@react-pdf-viewer/core@3.12.0`.
- `@react-pdf-viewer/core` publishes **only** `lib/cjs/` with **no** `module`
  field, and references the peer exactly once as
  `var PdfJsApi = require('pdfjs-dist')`. There is no alternative import path.

**Worker ownership.** `src/features/pdf/ui/components/PdfWorkerHost.tsx` imports
`Worker` from `@react-pdf-viewer/core` and feeds it
`import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'`. Same npm
package the viewer requires. Mounted once from `LeftPanel`, so the worker
outlives individual open/close cycles and tab switches.

**PDFDocumentProxy ownership.** The viewer creates it. QuizLab does not create a
second one in the normal path; it _borrows_ it through
`src/features/pdf/lib/activePdfDocumentRegistry.ts`, a hand-written structural
mirror (`as never` / `as unknown as` casts) populated from the viewer's
`onDocumentLoad` event and read back by the capture pipeline. Only when the
registry misses does `renderPageToImage` call `pdfjsLib.getDocument` itself and
destroy what it created.

## 2. PDF feature file map (all production files)

`src/features/pdf/` — 79 files. Public entry points are only `index.ts` (light),
`viewer.ts` (heavy, lazy-loaded), `types.ts` (type-only), all allow-listed in
`.dependency-cruiser.cjs` `PUBLIC_FEATURE_ENTRYPOINTS` and mirrored in
`eslint.config.mjs`.

| Domain                   | Files                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry points / docs      | `index.ts`, `viewer.ts`, `types.ts`                                                                                                                                                                                                                           |
| Viewer shell             | `ui/components/PdfViewer.tsx`, `PdfViewerDocument.tsx`, `PdfViewerElement.tsx`                                                                                                                                                                                |
| Worker host              | `ui/components/PdfWorkerHost.tsx`                                                                                                                                                                                                                             |
| Document loading / state | `hooks/usePdfViewerState.ts`, `hooks/usePdfViewerEffects.ts`, `hooks/pdfViewerStateTypes.ts`, `hooks/types.ts`                                                                                                                                                |
| Plugin bridge            | `ui/hooks/usePdfPlugins.ts`                                                                                                                                                                                                                                   |
| DOM adapter              | `lib/pdfViewerDom.ts`                                                                                                                                                                                                                                         |
| Document registry        | `lib/activePdfDocumentRegistry.ts`                                                                                                                                                                                                                            |
| Page → image             | `lib/renderPageToImage.ts`                                                                                                                                                                                                                                    |
| Navigation               | `ui/hooks/usePdfNavigation.ts`, `viewport/usePdfWheelNavigation.ts`                                                                                                                                                                                           |
| Zoom                     | `viewport/useCoalescedZoom.ts`, `viewport/usePdfCtrlWheelZoom.ts`, `viewport/usePdfResizeRefit.ts`, `viewport/usePdfViewerZoomIpc.ts`, `hooks/usePdfViewerZoomOrchestrator.ts`, `constants/pdfZoom.ts`, `ui/components/PdfZoomControls.tsx`                   |
| Fit / layout             | `ui/components/usePdfViewerLayout.ts`                                                                                                                                                                                                                         |
| Search                   | `ui/hooks/usePdfSearchStore.ts`, `ui/components/PdfSearchBar.tsx`                                                                                                                                                                                             |
| Text layer extraction    | `text/extractPageTextFromDom.ts`                                                                                                                                                                                                                              |
| Selection                | `text/extractSelectedText.ts`, `text/normalizePdfText.ts`, `text/usePdfTextActions.ts`, `text/types.ts`                                                                                                                                                       |
| Screenshot / capture     | `capture/usePdfCaptureActions.ts`, `capture/findPageCanvas.ts`, `capture/captureCanvasAsBlob.ts`, `capture/types.ts`                                                                                                                                          |
| GPU / canvas cleanup     | `capture/useCanvasGpuCleanup.ts`                                                                                                                                                                                                                              |
| Pan                      | `interaction/usePdfPanTool.ts`, `interaction/panHelpers.ts`                                                                                                                                                                                                   |
| Context menu             | `interaction/usePdfContextMenu.ts`, `ui/components/ContextMenu.tsx`, `hooks/usePdfViewerMenuItems.ts`                                                                                                                                                         |
| Toolbar / page nav       | `ui/components/PdfToolbar.tsx`, `PdfPageNav.tsx`, `PdfAiQuickBar.tsx`, `OverflowMenu.tsx`                                                                                                                                                                     |
| Progress persistence     | `hooks/useReadingProgressPersistence.ts`, `hooks/readingHistoryRepository.ts`, `hooks/usePdfSelection.ts`                                                                                                                                                     |
| Resume / restore         | `hooks/usePdfViewerInitialPageResume` (inside `usePdfViewerEffects.ts`), `hooks/usePdfOpenActions.ts`, `hooks/useShellOpenPdf.ts`                                                                                                                             |
| Error handling           | `errors/pdfRenderErrors.ts`                                                                                                                                                                                                                                   |
| PDF tabs                 | `store/usePdfTabStore.ts`, `store/pdfTabStoreUtils.ts`, `ui/components/PdfTabStrip.tsx`, `PdfTabItem.tsx`, `TabContextMenu.tsx`, `pdfTabStripUtils.ts`, `usePdfTabStripDerived.tsx`, `usePdfTabStripRoving.ts`, `useTabEditing.ts`, `hooks/usePdfTabState.ts` |
| Shell integration        | `ui/components/PdfPlaceholder.tsx` + `pdfPlaceholder/*`, `ui/components/GoogleDrivePanel.tsx`, `hooks/useDriveViewRetirement.ts`, `ui/hooks/usePdfShortcuts.ts`, `ui/hooks/index.ts`                                                                          |
| Styling                  | `src/shared/styles/modules/_pdf-viewer.css`, `src/shared/styles/modules/_pdf-placeholder.css`                                                                                                                                                                 |

## 3. React-PDF-Viewer usage graph

`rg -n "@react-pdf-viewer" src electron shared` → **44 matches in 28 files**
(16 of those files are tests). Everything outside tests:

**Runtime imports (13 sites, 9 production files)**

| File                                                                                                                                  | What it imports                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ui/components/PdfWorkerHost.tsx`                                                                                                     | `Worker` (value) + the `?url` worker asset                                                                           |
| `ui/components/PdfViewerElement.tsx`                                                                                                  | `Viewer`, `ScrollMode`, `ViewMode`, `SpecialZoomLevel`, types `Plugin` / `DocumentLoadEvent` / `LoadError` / `PdfJs` |
| `ui/components/PdfViewer.tsx`                                                                                                         | 4 CSS files: `core`, `page-navigation`, `zoom`, `search` `lib/styles/index.css`                                      |
| `ui/hooks/usePdfPlugins.ts`                                                                                                           | `pageNavigationPlugin`, `searchPlugin` (+ `RenderHighlightsProps`), `zoomPlugin`, `Plugin`                           |
| `viewport/usePdfResizeRefit.ts`                                                                                                       | `SpecialZoomLevel` (value)                                                                                           |
| `viewport/usePdfViewerZoomIpc.ts`                                                                                                     | `SpecialZoomLevel` (value)                                                                                           |
| `viewport/usePdfCtrlWheelZoom.ts`                                                                                                     | `SpecialZoomLevel` (type only)                                                                                       |
| `viewport/useCoalescedZoom.ts`                                                                                                        | `SpecialZoomLevel` (type only)                                                                                       |
| `hooks/usePdfViewerState.ts`, `hooks/usePdfViewerEffects.ts`, `hooks/pdfViewerStateTypes.ts`, `hooks/usePdfViewerZoomOrchestrator.ts` | `SpecialZoomLevel` / `DocumentLoadEvent` (types only)                                                                |

`electron/` and `shared/` contain **no** pdfjs or viewer imports. The only
`shared/` mentions are an IPC channel name (`shared/constants/ipcChannels.ts:20`)
and a doc comment (`shared/types/pdf.ts:16`).

**DOM selectors the app reaches into**

`rg -n "rpv-core__|core__page|data-virtual-index" src` → 88 matches in 5 files.
All are centralized in **`src/features/pdf/lib/pdfViewerDom.ts`** (the single
owner, with a header comment documenting how each selector was verified against
the shipped `core@3.12.0` bundle):

| Constant                   | Value                                                                                       | Consumer                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `PAGE_LAYER_CLASS`         | `rpv-core__page-layer`                                                                      | `text/extractPageTextFromDom.ts`                           |
| `TEXT_LAYER_SELECTOR`      | `.rpv-core__text-layer`                                                                     | `extractPageTextFromDom.ts`, `text/extractSelectedText.ts` |
| `INNER_CONTAINER_SELECTOR` | `[data-testid="core__inner-container"]`                                                     | `interaction/panHelpers.ts`                                |
| `pageLayerSelectors(n)`    | `.rpv-core__page-layer[data-virtual-index="n-1"]`, `[data-testid="core__page-layer-{n-1}"]` | `capture/findPageCanvas.ts`, `extractPageTextFromDom.ts`   |
| (inline)                   | `rpv-search__highlight`                                                                     | `ui/hooks/usePdfPlugins.ts:43`                             |

**CSS selectors.** `rg -n "rpv-" src` → **77 occurrences in 6 files**; 38 of
them are CSS, all in `src/shared/styles/modules/_pdf-viewer.css` (10 distinct
classes, 26 rule blocks). The remaining 39 are in `pdfViewerDom.ts` (5),
`usePdfPlugins.ts` (1) and three test files.

## 4. Feature ownership split

### A — Provided by `@react-pdf-viewer` (must be re-implemented natively)

| Capability                                    | How it is provided today                                                                         | Native equivalent                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------- | -------------------------- |
| Canvas page rendering                         | `<Viewer>` + `ViewMode.SinglePage`                                                               | `PDFPageProxy.render()` onto a canvas               |
| Page virtualization / lazy rasterization      | internal                                                                                         | manual intersection-observer page mounting          |
| Text layer                                    | viewer's own, `rpv-core__text-layer` spans                                                       | `TextLayer` class exported by pdfjs 6               |
| Annotation layer                              | viewer's own, `rpv-core__annotation-layer`                                                       | `AnnotationLayer` class exported by pdfjs 6         |
| Link handling / `LinkService`                 | viewer internal — **no JS in this repo references annotations or links at all** (`rg "annotation | linkService                                         | getAnnotations"` returns only CSS) | `LinkService` from pdfjs 6 |
| Search (find + highlight geometry)            | `searchPlugin` + `safeRenderHighlights`                                                          | manual `getTextContent()` scan + overlay divs       |
| Zoom (`zoomTo`, `ZoomIn/Out`, `CurrentScale`) | `zoomPlugin`                                                                                     | `page.getViewport({ scale })` + our own state       |
| Page jump                                     | `pageNavigationPlugin().jumpToPage`                                                              | scroll container + `scrollTo`                       |
| `onPageChange` / `onDocumentLoad` / `onZoom`  | `<Viewer>` props                                                                                 | `page.render` completion + scroll observer          |
| `renderLoader` / `renderError`                | `<Viewer>` props                                                                                 | ours (both already rendered by us inside the slots) |
| Scroll mode / view mode enums                 | `ScrollMode.Page`, `ViewMode.SinglePage`                                                         | ours                                                |
| Dark theme default                            | `theme={{ theme: 'dark' }}` + plugin CSS                                                         | ours                                                |
| Viewer stylesheet                             | 4 imported `index.css` files                                                                     | native `pdf_viewer` CSS we author ourselves         |

### B — QuizLab's own code on top of the viewer

AI text selection (`text/usePdfTextActions.ts` + `extractSelectedText.ts` +
`normalizePdfText.ts`), page-text extraction to AI, high-DPI screenshot
(`capture/*` + `lib/renderPageToImage.ts`), page→PNG, area/crop screenshot via
Electron, active-document registry, progress persistence + resume, custom page
navigation state machine, wheel gesture recognition, Ctrl+wheel zoom, resize
refit, native-menu zoom IPC, pan tool, context menu, GPU/canvas cleanup +
pixel budget, render-error guard, PDF tab store/strip, Google Drive tab,
placeholder/recent-files UI, `Ctrl+O` / `Ctrl+F` shortcuts.

## 5. Feature parity matrix

Difficulty: **S** = substantial rewrite · **M** = moderate · **L** = light.
"Native replacement" is what pdfjs-dist 6 already exposes.

| #   | Feature                                   | Current owner               | Current implementation                                                                       | Difficulty | Native PDF.js replacement            | Regression risk | Test                                 |
| --- | ----------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ------------------------------------ | --------------- | ------------------------------------ |
| 1   | PDF open (picker / drop / OS association) | QuizLab                     | `usePdfSelection`, `useSharedDragDrop`, `useShellOpenPdf`                                    | L          | untouched                            | Low             | TESTED                               |
| 2   | PDF close                                 | QuizLab                     | `usePdfTabStore.closePdfTab` → `PdfViewer` clears persistent state                           | L          | untouched                            | Low             | TESTED                               |
| 3   | Multiple PDF tabs                         | QuizLab                     | `store/usePdfTabStore.ts` + `PdfTabStrip`                                                    | L          | untouched                            | Low             | TESTED (store) / UNTESTED (strip UI) |
| 4   | Page navigation (buttons, jump)           | RPV + QuizLab state machine | `pageNavigationPlugin().jumpToPage` + `usePdfNavigation`                                     | M          | scroll container                     | Medium          | TESTED                               |
| 5   | Current-page tracking                     | QuizLab                     | `usePdfNavigation` `handlePageChange` on viewer event                                        | M          | scroll/render observation            | Medium          | TESTED                               |
| 6   | Single-page mode                          | RPV                         | `viewMode={ViewMode.SinglePage}`                                                             | M          | mount one page at a time             | High            | TESTED (prop only)                   |
| 7   | Zoom (toolbar + scale readback)           | RPV                         | `zoomPlugin` → `zoomTo`, `CurrentScale`                                                      | M          | own scale state + viewport           | Medium          | PARTIAL                              |
| 8   | Ctrl/Meta+wheel zoom                      | QuizLab                     | `viewport/usePdfCtrlWheelZoom.ts` (capture, passive:false, 40 ms throttle)                   | L          | unchanged                            | Low             | UNTESTED                             |
| 9   | Fit page (both axes)                      | QuizLab                     | `useFitScale` min-axis + 1 % quantization; used as resize-refit target                       | M          | compute from viewport                | Medium          | TESTED (pure fn)                     |
| 10  | Fit width                                 | RPV                         | `defaultScale={SpecialZoomLevel.PageWidth}`                                                  | M          | `containerW / pageW`                 | Medium          | TESTED (prop only)                   |
| 11  | Pan (drag to scroll)                      | QuizLab                     | `interaction/usePdfPanTool.ts` + `panHelpers`                                                | M          | our scroll container                 | Medium          | PARTIAL                              |
| 12  | Text selection → AI                       | QuizLab (on RPV text layer) | `usePdfTextActions` listeners → `extractSelectedText`                                        | **S**      | `TextLayer` we mount                 | **High**        | PARTIAL                              |
| 13  | Context menu (right click)                | QuizLab                     | `usePdfContextMenu` + `usePdfViewerMenuItems`                                                | L          | unchanged (own divs)                 | Low             | TESTED                               |
| 14  | Copy selection                            | browser default             | No clipboard code exists — relies on the viewer's text layer being selectable                | L          | `user-select` on our text layer      | Low             | UNTESTED                             |
| 15  | Search (find)                             | RPV                         | `searchPlugin` + `safeRenderHighlights`                                                      | **S**      | manual text scan                     | **High**        | PARTIAL                              |
| 16  | Search highlight rendering                | QuizLab (on RPV geometry)   | `usePdfPlugins.safeRenderHighlights` reuses `rpv-search__highlight` + `pdf-highlight-fadein` | **S**      | own overlay                          | **High**        | UNTESTED                             |
| 17  | Next / previous match                     | **absent**                  | No such code exists — search is Enter-to-run, Escape-to-clear                                | —          | n/a                                  | —               | n/a                                  |
| 18  | Links                                     | RPV                         | viewer-internal; no JS in repo                                                               | M          | `LinkService`                        | Medium          | UNTESTED                             |
| 19  | Annotations (render layer)                | RPV                         | viewer-internal; CSS only in repo                                                            | M          | `AnnotationLayer`                    | Medium          | UNTESTED                             |
| 20  | Reading progress                          | QuizLab                     | `useReadingProgressPersistence` + `readingHistoryRepository` (localStorage)                  | L          | unchanged                            | Low             | TESTED                               |
| 21  | Restore page on open                      | QuizLab                     | `usePdfViewerInitialPageResume` (fit-scale then 3×rAF then jump)                             | M          | same ordering                        | Medium          | TESTED                               |
| 22  | Page screenshot (full page, high-DPI)     | QuizLab                     | `usePdfCaptureActions` → `renderPageToImage` (scale 4.0) → AI queue                          | **S**      | `PDFPageProxy.render`                | **High**        | PARTIAL                              |
| 23  | Selection screenshot (crop)               | QuizLab + Electron          | `startScreenshot({captureKind:'selection'})` → main-process crop                             | L          | unchanged                            | Low             | TESTED                               |
| 24  | Page → PNG                                | QuizLab                     | `canvas.toBlob`/`toDataURL` in `renderPageToImage` + `captureCanvasAsBlob`                   | M          | own canvas                           | Medium          | UNTESTED (high-DPI path)             |
| 25  | Send text to AI                           | QuizLab                     | `extractCurrentPageText` (idle-deferred) → `queueTextForAi`                                  | **S**      | `getTextContent()` or our text layer | **High**        | PARTIAL                              |
| 26  | Send image to AI                          | QuizLab                     | `queueImageForAi(dataUrl\|blobUrl, {page, captureKind})`                                     | **S**      | as #22                               | **High**        | TESTED (queue) / UNTESTED (render)   |
| 27  | Document reload                           | QuizLab                     | `viewerReloadKey` bump → `<Viewer key={pdfUrl:reloadKey}>` remount                           | L          | re-run `getDocument`                 | Low             | TESTED                               |
| 28  | Large PDF handling                        | RPV + QuizLab               | viewer virtualization + `activePdfDocumentRegistry` reuse + GPU pixel budget                 | **S**      | must rebuild                         | **High**        | PARTIAL                              |
| 29  | Canvas / GPU cleanup                      | QuizLab                     | `useCanvasGpuCleanup` MutationObserver + 50 MP budget                                        | M          | unchanged (observes our container)   | Medium          | TESTED                               |
| 30  | Error handling                            | QuizLab                     | `errors/pdfRenderErrors.ts` guard on `unhandledrejection`                                    | M          | re-verify markers against 6.x        | Medium          | TESTED                               |
| 31  | `Ctrl+O` open shortcut                    | QuizLab                     | `usePdfShortcuts`                                                                            | L          | unchanged                            | Low             | TESTED                               |
| 32  | `Ctrl+F` search shortcut                  | QuizLab                     | `usePdfShortcuts` + `usePdfSearchStore`                                                      | L          | unchanged                            | Low             | TESTED                               |
| 33  | Native-menu zoom (Electron)               | QuizLab                     | `usePdfViewerZoomIpc` → coalesced zoom                                                       | L          | unchanged                            | Low             | TESTED                               |
| 34  | Wheel page-turn gesture                   | QuizLab                     | `viewport/usePdfWheelNavigation.ts` (idle 240 ms, opposite lock 900 ms)                      | L          | unchanged                            | Low             | TESTED                               |
| 35  | Resize refit to fit                       | QuizLab                     | `viewport/usePdfResizeRefit.ts` (150 ms debounce, panel/nav locks)                           | L          | unchanged                            | Low             | TESTED                               |
| 36  | Dark theme over the viewer                | QuizLab CSS                 | `_pdf-viewer.css` `!important` overrides + `theme={{theme:'dark'}}`                          | M          | own CSS                              | Medium          | PARTIAL                              |
| 37  | Scroll-snap suppression                   | QuizLab CSS                 | `_pdf-viewer.css:45-54` `scroll-snap-type/align: none !important`                            | L          | our scroll CSS                       | Low             | UNTESTED                             |
| 38  | Google Drive tab                          | QuizLab                     | `GoogleDrivePanel` + `useDriveViewRetirement`                                                | L          | untouched                            | Low             | TESTED                               |
| 39  | Placeholder / recent files / relink       | QuizLab                     | `PdfPlaceholder` + `pdfPlaceholder/*`                                                        | L          | untouched                            | Low             | PARTIAL                              |
| 40  | Focus mode shell wiring                   | QuizLab                     | `FocusOverlay` / `LeftPanel` lazy-load `@features/pdf/viewer`                                | L          | untouched                            | Low             | PARTIAL                              |

**Totals:** 40 features · **high risk: 7** (#6, 12, 15, 16, 22, 25, 26, 28 — eight
rows counting 22/25/26 separately) · medium: 14 · low: 18.
**Fully UNTESTED rows: 6** (#8, 14, 17-absent, 18, 19, 37) plus the high-DPI
render path (#22/#24/#26) and `PdfTabStrip` internals.

## 6. PDFDocumentProxy lifecycle (real structure)

```
PDF file on disk
  → usePdfSelection / useSharedDragDrop / useShellOpenPdf
  → usePdfTabStore.openPdf(...)  →  PdfFile { path, streamUrl }
  → PdfViewer (light state) ──> PdfViewerDocument ──> usePdfViewerState
  → PdfViewerElement
      <Viewer fileUrl={pdfUrl}
              transformGetDocumentParams={transformDocParams /* isEvalSupported:false */}
              onDocumentLoad={safeDocumentLoad} />
          │
          ├─ require('pdfjs-dist')  →  pdfjs-dist@3.11.174 (deduped, ONE engine)
          │     workerSrc ────────── supplied by <Worker workerUrl={pdfjsWorkerUrl}>
          │                          mounted once by PdfWorkerHost (LeftPanel)
          │     getDocument()  →  PDFLoadingTask  →  PDFDocumentProxy
          │
          └─ onDocumentLoad(e)
                ├─ e.doc.fingerprints[0]  → fingerprint
                └─ setActivePdfDocument(e.doc, pdfUrl, fingerprint)   ← ownership handover
                       lib/activePdfDocumentRegistry.ts  (module-level singleton)

capture / screenshot
  usePdfCaptureActions.handleFullPageScreenshot
    1. renderPageToImageFallback(pdfUrl, page, {scale: 4.0, maxPixels 20 MP})
         a. getActivePdfDocument(pdfUrl)   ← REUSE, shouldDestroy = false
         b. else getDocument({url, isEvalSupported:false}); shouldDestroy = true
         pdf.getPage(n) → page.getViewport({scale}) → canvas → toBlob → blobUrl
    2. fallback A: findPageCanvas(page) → cloneCanvasAtScale()   (viewer's live canvas)
    3. fallback B: findPageCanvas with progressive retry (10 × 30..210 ms ≈ 900 ms)
    4. fallback C: renderPageToImageFallback(pdfUrl, page, {scale: 2})
    5. fallback D: canvas.toDataURL (jpeg>12 MP @0.95 / png)  → captureCanvasAsBlob
    → queueImageForAi(dataUrl | blobUrl, { page, captureKind: 'full-page' })

destroy
  • proxy the registry owns: destroyed by pdf.js when the loading task is torn
    down — i.e. when <Viewer> unmounts (key = `${pdfUrl}:${viewerReloadKey}`)
  • proxy capture created itself: `pdf.destroy()` in a `finally` (renderPageToImage:176-180)
  • registry entries: `clearActivePdfDocument()` on unmount
    (PdfViewerElement:63) and on every `pdfUrl` / `viewerReloadKey` change
    (PdfViewerElement:72)
  • `getActivePdfDocument` returns null when `destroyed === true`, and clears
    the registry — this is why a Reload can never hand capture a dead proxy
  • deliberate: capture does NOT call `PDFPageProxy.cleanup()` on the viewer's
    page proxies, because that drops the shared decoded-object cache
    (`objs.clear()`) and forces a full font/image re-decode on the next repaint
```

## 7. Worker lifecycle

| Question                          | Answer                                                                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where imported                    | `src/features/pdf/ui/components/PdfWorkerHost.tsx:2` — `import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'`; the `Worker` **component** itself is re-exported by `@react-pdf-viewer/core` and imported on line 1       |
| How Vite bundles it               | `?url` makes Vite emit the file as a hashed asset and hand the component a URL string. `vite.config.mts:13` routes both `pdfjs-dist` and `@react-pdf-viewer` into a `vendor-pdf` chunk; `assetsInlineLimit: 4096` keeps it a real file. |
| How it reaches the Electron build | `package.json` `build.files = ["dist/**/*"]`, so the emitted `dist/assets/pdf.worker.min-<hash>.js` ships inside the packaged app. `extraResources` is unrelated (icon, extensions).                                                    |
| Runtime URL                       | Set by RPV's `<Worker workerUrl>` → its `PDFWorker` port. Independently, `renderPageToImage.ts:120-122` lazily sets `GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl` **only if unset**, on the self-load path.                          |
| Electron main                     | Zero references. Nothing serves or rewrites the asset.                                                                                                                                                                                  |
| `GlobalWorkerOptions` direct use  | One site: `renderPageToImage.ts:120-121`.                                                                                                                                                                                               |

## 8. React-PDF-Viewer coupling

- **Runtime imports:** 13 sites / 9 production files (table in §3).
- **DOM selectors owned:** 5 selectors in `lib/pdfViewerDom.ts` + 1 inline
  (`rpv-search__highlight`). 3 further class names
  (`data-page-number`, `.pdf-page-wrapper`, `.rpv-core__text-layer-basic`) were
  deliberately removed after being proven absent from the v3 bundle.
- **CSS selectors:** 10 distinct `rpv-*` classes, 26 rule blocks, 38
  occurrences, 100 % namespaced under the app-owned `.pdf-viewer-container`.
  Categorised:

  | Category    | Rules       | Notes                                                                                                                                                                                                                                                                                         |
  | ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | layout      | 9           | `inner-container`/`inner-pages` scrollbar-gutter; `viewer` 100 % + `contain`; `inner-page`/`page-layer` sizing; `canvas-layer` opacity+`contain`; `canvas { display:block }`                                                                                                                  |
  | theme       | 8           | `background-color: oklch(var(--background)) !important` on `viewer`/`inner-pages`/`inner-page`/`page-layer`; `panel-resizing` white-flash suppression (5 selectors); `minimal-button` recolour; scrollbar restyling                                                                           |
  | interaction | 5           | text-layer cursor/`user-select`; `spinner` hidden while resizing; `pdf-pan-mode-active/dragging` cursors; pan-mode `user-select:none`                                                                                                                                                         |
  | selection   | 8           | `::selection` + `::-moz-selection` on text-layer spans (amber, `0 0 0 999px` ring); span `line-height:1.42` + padding/margin hitbox inflation; `color:transparent` on the text layer; `pdf-selection-active` glow + gradient + animated border + pointer arrow                                |
  | search      | 0 CSS rules | coupling is JS-only: `safeRenderHighlights` reuses `rpv-search__highlight` for geometry, and `pdf-highlight-fadein` (`_pdf-viewer.css:298-302`)                                                                                                                                               |
  | workaround  | 11          | `scroll-snap-type/align: none !important`; `transition:none` on `inner-page`/`canvas-layer` while resizing; `color:transparent` on the text layer (v3 renders glyphs to canvas); `line-height` + hitbox padding; `backface-visibility:visible` on all three layers; `display:block` on canvas |

- **Plugin dependencies:** `pageNavigationPlugin`, `zoomPlugin({enableShortcuts:true})`,
  `searchPlugin({renderHighlights: safeRenderHighlights})`, all created
  unconditionally every render and pinned to the first-render instances via
  `useRef` (`usePdfPlugins.ts:68-101`) — because RPV plugins call React hooks
  internally. All three are load-bearing.
- **App-owned DOM hooks the viewer CSS matches:** `.pdf-viewer-container` (44 CSS
  lines), `.pdf-canvas-container`, `[data-pdf-page-loader]`,
  `.pdf-selection-active`, `.pdf-pan-mode-active`, `.pdf-pan-mode-dragging`,
  `body.panel-resizing`. All six are emitted by QuizLab code, so they survive
  the migration. (`scrollbar-gutter-stable` is applied in
  `PdfViewerDocument.tsx:71` but has **no definition anywhere** — dead class;
  the intended effect comes from `_pdf-viewer.css:16-19`.)

## 9. Screenshot / page-image pipeline

```
user action
  ├─ toolbar "send page as image" / context-menu item  → handleFullPageScreenshot
  └─ Electron onTriggerScreenshot('full')              → same handler
                                                          (usePdfViewerEffects.ts:47-53)
       ↓
  usePdfCaptureActions.handleFullPageScreenshot
    stamps requestId + pdfUrl + pageAtCaptureTime (isCurrentCapture())
    ↓
  1. renderPageToImageFallback(pdfUrl, page, {scale: 4.0, maxPixels: 20_000_000})
       ├─ reuse getActivePdfDocument(pdfUrl)  →  PDFPageProxy.render → canvas → toBlob
       └─ else getDocument({url, isEvalSupported:false}) → render → toBlob → blob.destroy()
       ↓  FileReader → data URL (preferred)
       ↓  blob URL (fallback)
  2. findPageCanvas(page) → cloneCanvasAtScale(canvas, 4.0, 20 MP)   ← viewer's live canvas
  3. findPageCanvas(page) with 10 progressive retries (30→210 ms, ≈900 ms total)
  4. renderPageToImageFallback(pdfUrl, page, {scale: 2})
  5. canvas.toDataURL(jpeg@0.95 if >12 MP else png) → captureCanvasAsBlob
  6. showError('toast_capture_failed')
       ↓
  queueImageForAi(dataUrl | blobUrl, { page, captureKind: 'full-page' })
       ↓
  AppToolContext queue → AI draft image  (identical-data-URL captures are not deduped)
```

Selection/crop screenshot is a different path and does **not** touch PDF.js:
`handleAreaScreenshot()` → `startScreenshot({ page, captureKind: 'selection' })`
→ Electron main-process window crop.

Key invariants: request stamping so stale renders are dropped **and their
object URLs revoked**; pixel budgets at 20 MP (render) and 12 MP (canvas); the
`finally`-scoped `destroy()` that only tears down a proxy this call created.

## 10. Text selection pipeline

```
pdf.js text layer spans (rpv-core__text-layer)      ← owned by RPV
  → browser selection (window.getSelection)
  → usePdfTextActions  (usePdfTextActions.ts:109-247)
      document pointerdown/pointerup  (capture phase)
      document selectionchange
      container scroll  → 150 ms freeze window (isScrolling)
      rAF-coalesced scheduleSelectionUpdate()
  → extractSelectedText(selection, container)  (extractSelectedText.ts)
      containment check: commonAncestor ∪ (anchor∧focus) ∪ (overlap ∧ (anchor∨focus))
      extractOrderedSelectionText():
        container.querySelector('.rpv-core__text-layer')   ← DOM DEPENDENCY
        collectTextItems()  → span.getBoundingClientRect()
        intersect with range.getClientRects()
        orderTextItems()    → X-cluster into columns, Y-sort within, line-merge
      normalizePdfText()  (ligature expansion, NFC, whitespace/line-break fixups)
      pill placement: below range end, flip above, clamp X, respect bottom bar (80 px)
  → container.classList.toggle('pdf-selection-active', text && position)
  → onTextSelection(text, position) → app store → AI bubble
```

**Multi-page selection is not supported** by design: only
`container.querySelector(TEXT_LAYER_SELECTOR)` — the _first_ text layer in the
container — is scanned. In `ViewMode.SinglePage` that happens to be the visible
page, so this is consistent today but is a latent assumption.

Fallback: if `extractOrderedSelectionText` returns null, `normalizePdfText(selection.toString())`
is used instead.

DOM dependencies: `.rpv-core__text-layer`, the span-per-glyph structure, and
per-span `getBoundingClientRect()` geometry. **This is the single most fragile
part of a native migration**, because we would own the text layer instead of
reading the viewer's.

Whole-page text (for "add page text to AI") uses the same selector chain:
`extractPageTextFromDom(page)` → `pageLayerSelectors` → `.rpv-core__text-layer`
→ coordinate-ordered text → `textContent` fast path → `innerText` slow path
(triggered by <5 chars or the suspicious-glyph run `¸ˆ˜`) → page-layer
`textContent` fallback.

## 11. Search pipeline

```
Ctrl/Cmd+F  → usePdfShortcuts (only when the active tab is kind==='pdf' && file)
            → usePdfSearchStore.open()
            → PdfSearchBar (auto-focus after SEARCH_INPUT_FOCUS_MS)
Enter       → onSearch()                       [PdfToolbar.tsx:103-107, debounced]
             search.highlight(keyword)          ← RPV searchPlugin
                ├─ RPV finds matches, calls renderHighlights(props)
                └─ safeRenderHighlights(props)   ← QuizLab's renderer
                      props.highlightAreas + props.getCssProperties(area)
                      → div.rpv-search__highlight[data-index]
                        opacity 0 → animation pdf-highlight-fadein 400 ms delay
                        (prefers-reduced-motion: static opacity 0.3)
                      → geometry comes from the search plugin's own stylesheet
clear       → onClear() → clearHighlights() + closeSearch()
file change → useEffect → clearHighlights() + closeSearch()   [PdfToolbar.tsx:84-86]
```

- **State owner:** `usePdfSearchStore` (zustand: `isOpen` / `open` / `close`).
- **Plugin owner:** `searchPlugin` from `@react-pdf-viewer/search`.
- **Result count / current result:** **not implemented.** No `nextMatch`,
  `prevMatch`, `findNext`, `findPrevious` or match-count code exists anywhere in
  `src`. Search is single-shot highlight-all.
- **Highlight DOM:** fully owned by `safeRenderHighlights` except the
  `rpv-search__highlight` class, whose positioning CSS ships with the search
  plugin.
- **Navigation:** none beyond highlighting. No auto page jump on match.

## 12. Navigation and zoom — viewer-specific vs product requirement

### Viewer-specific (goes away or must be re-derived)

| Item                                                                                                                 | Why it is viewer-specific                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePdfNavigation` **jump-target/ack state machine** (`navigationTargetPageRef`, 450 ms settle, 1200 ms ack timeout) | exists solely to suppress the viewer's late `onPageChange` callbacks for the page being torn down. A native viewer that only reports the page it has actually rendered removes the whole class of bug. **Must be re-derived, not deleted blindly.** |
| `usePdfWheelNavigation` `preventDefault` + `stopPropagation`                                                         | relies on `ScrollMode.Page` already not scrolling, so the wheel event must be swallowed to convert it into a page turn                                                                                                                              |
| `usePdfViewerInitialPageResume` 3×rAF wait                                                                           | waits for the viewer to commit its fit-zoom re-render and re-measure before jumping                                                                                                                                                                 |
| `usePdfResizeRefit` → `SpecialZoomLevel.PageWidth`                                                                   | the viewer owns "fit width" math                                                                                                                                                                                                                    |
| `useCoalescedZoom` doc comment                                                                                       | names `RenderingCancelledException` / "canvas context is locked" races as SinglePage-mode artefacts                                                                                                                                                 |
| `transformGetDocumentParams` / `<Viewer key>` reload                                                                 | viewer remount is the reload mechanism                                                                                                                                                                                                              |

### Product requirement (survives verbatim)

| Item                                                                                                   | Why it is a product rule |
| ------------------------------------------------------------------------------------------------------ | ------------------------ |
| one page per wheel gesture, 240 ms idle unlock, 900 ms opposite-direction lock                         | reading UX               |
| Ctrl/Meta+wheel zoom, 40 ms throttle, suppressed while panning                                         | reading UX               |
| zoom step 0.1, min 0.1, max 5.0                                                                        | `constants/pdfZoom.ts`   |
| refit-to-fit after resize settles (150 ms), locked during panel drag and within 500 ms of a navigation | reading UX               |
| fit scale quantized to 1 % so ±1 px noise cannot trigger a repaint                                     | reading UX + perf        |
| 20 px container inset before computing fit scale                                                       | layout                   |
| reading progress debounce 300 ms, flush on `beforeunload`/`pagehide`                                   | persistence              |
| progress flush-then-resume ordering                                                                    | persistence correctness  |
| `Ctrl+O` / `Ctrl+F` scoping                                                                            | product                  |

**Single zoom channel.** Every programmatic zoom source
(`usePdfResizeRefit`, `usePdfViewerZoomIpc`, `usePdfCtrlWheelZoom`, the fit-scale
effect, the resume flow) funnels through `useCoalescedZoom(zoomTo)` → one
`zoomTo` per animation frame. This is a load-bearing invariant.

## 13. Security baseline (current — do not change in this phase)

| Knob                                                                        | Current state                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isEvalSupported`                                                           | `false` at **both** `getDocument` paths: `PdfViewerElement.tsx:34-37` (`transformGetDocumentParams`, stable module-level reference so `<Viewer>` never reloads) and `renderPageToImage.ts:124`. CVE-2024-4367 mitigation. Asserted by `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts:93-104`. |
| `enableScripting`                                                           | **not set anywhere.** On 3.11.174 it is annotation-layer-only, absent from `DocumentInitParameters`, and a runtime no-op for `getDocument`.                                                                                                                                                                     |
| `cMapUrl` / `standardFontDataUrl` / `iccUrl` / `wasmUrl` / `useWorkerFetch` | **none set.** On 3.x this happens to work because `useWorkerFetch` resolves falsy when those are unset and pdf.js falls back to main-thread factories.                                                                                                                                                          |
| `useWasm`                                                                   | not set (3.x has no wasm dir).                                                                                                                                                                                                                                                                                  |
| `Worker` ownership                                                          | one app-owned worker for the whole renderer (`PdfWorkerHost`).                                                                                                                                                                                                                                                  |
| Accepted advisory                                                           | `security/audit-exceptions.json`, `CVE-2024-4367`, expires 2026-12-31; pinned by `src/__tests__/architecture/security-gate-wiring.test.ts` (`installed: '3.11.174'`).                                                                                                                                           |
| Electron main / `shared/`                                                   | zero pdfjs references.                                                                                                                                                                                                                                                                                          |
| Unhandled rejections                                                        | `errors/pdfRenderErrors.ts` filters `RenderingCancelledException` and the two pdf.js render-race messages; installed by `PdfWorkerHost`.                                                                                                                                                                        |

---

# Part II — Blockers (verified on master `5a47228`)

## 1. The viewer cannot accept pdfjs 4.x/5.x/6.x

`@react-pdf-viewer/core@3.12.0` declares:

```json
"peerDependencies": { "pdfjs-dist": "^2.16.105 || ^3.0.279" }
```

`^3.0.279` is `>=3.0.279 <4.0.0`, so 4.x and 5.x are outside the range, and there
is no `peerDependenciesMeta` escape hatch. The plugin packages do not declare
`pdfjs-dist` at all; they depend on `@react-pdf-viewer/core@3.12.0`.

The viewer also consumes the peer as CommonJS with no alternative path —
`@react-pdf-viewer/core/lib/cjs/core.js` contains exactly one reference,
`var PdfJsApi = require('pdfjs-dist')`, and the package publishes only `lib/cjs/`
with no `module` field.

**Consequence: the two cannot be moved independently.** Any pdfjs major bump
requires a viewer major bump in the same change. _Verified._

**NEW — registry check (network available this phase).** `npm view
@react-pdf-viewer/core version` → **`3.12.0`**, i.e. the peer range is still
`^2.16.105 || ^3.0.279` at the newest published release. **No
`@react-pdf-viewer` release supports pdfjs 4.x, 5.x or 6.x.** Replacing the
viewer is therefore a **prerequisite**, not a follow-up. _Now verified; this
closes the "could not be verified" gap the first draft of this document left
open._

## 2. `legacy-peer-deps=true` disables the peer guard

The repository's `.npmrc` contains exactly one line:

```
legacy-peer-deps=true
```

This is the most important operational finding. npm will install a
peer-incompatible tree **without raising `ERESOLVE`**, so the peer range that
makes blocker 1 non-negotiable is not enforced at install time. The only
remaining guard is `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts`,
which fails _after_ a successful install and a successful build.

Removing the flag is not done here. It was added by a single commit with no
rationale in the message (`2617810`, "chore: add legacy-peer-deps to .npmrc"),
and the flag should be removed, or the coupling test widened, as part of the
migration commit itself.

#### What the flag is actually suppressing

Answered offline by walking all 1287 installed packages and checking every one of
their 226 non-optional `peerDependencies` against the version npm actually
resolved. Two are unsatisfied, and **neither is the PDF viewer**:

| Package                         | Declares peer      | Installed |
| ------------------------------- | ------------------ | --------- |
| `eslint-plugin-jsx-a11y@6.10.2` | `eslint@^3 … ^9`   | `10.5.0`  |
| `eslint-plugin-react@7.37.5`    | `eslint@^3 … ^9.7` | `10.5.0`  |

So the real cause is the eslint 10 pin — `overrides` already forces both plugins
to resolve `eslint` to `10.5.0`, but their _declared_ ranges still stop at 9.x,
and only this flag suppresses the resulting `ERESOLVE`. One further peer is
absent rather than unsatisfied: `app-builder-lib@26.15.3` peers
`electron-builder-squirrel-windows@26.15.3`.

`pdfjs-dist@3.11.174` satisfies the viewer's `^3.0.279` exactly, so the PDF
stack contributes nothing here.

**Consequence for the migration:** deleting `.npmrc` as step 1 below will fail
with an `ERESOLVE` naming eslint plugins, not PDF. That is expected and not a
pdf problem — resolve the eslint peers first (or keep the flag and add the CI
assertion the plan recommends instead), then change one variable at a time.

## 3. The pdfjs 6 asset surface is larger than 3.x, and `isEvalSupported` is gone

`node_modules/pdfjs-dist@3.11.174` ships `build/`, `cmaps/`, `standard_fonts/`,
`web/`, `legacy/`, `image_decoders/`, `types/`. It has **no `wasm/` directory**,
**no `.wasm` file** and **no `.mjs` file** anywhere in the tree. It also has no
`files` field, so the shipped surface is whatever the release pipeline globbed.

`package.json` `build.files` is `["dist/**/*"]`. The current build output contains
the worker (`dist/assets/pdf.worker.min-<hash>.js`) and **zero** `.bcmap`,
`.pfb`, `.ttf` or `.wasm` files.

**Verified against an unpacked `pdfjs-dist@6.4.299` tarball (554 files, 8.1 MB):**

| Directory                                      | 3.11.174                                                                       | 6.4.299                                                                                                                      | Note                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `build/`                                       | `pdf.js`, `pdf.min.js`, `pdf.worker.js`, `pdf.worker.min.js`, `pdf.sandbox.js` | **`pdf.mjs`, `pdf.min.mjs`, `pdf.worker.mjs`, `pdf.worker.min.mjs`, `pdf.sandbox.mjs`, `pdf.sandbox.min.mjs`** + maps        | every `build/` entry becomes `.mjs`; `pdf.worker.entry.js` is gone. `package.json` `main` is `build/pdf.mjs`, `types` is `types/src/pdf.d.ts` |
| `wasm/`                                        | absent                                                                         | **present**: `jbig2.wasm`, `openjpeg.wasm`, `qcms_bg.wasm`, `quickjs-eval.wasm` + 3 `*_nowasm_fallback.js` + 6 LICENSE files | must be added to the packaged output **and** pointed at by `wasmUrl`                                                                          |
| `iccs/`                                        | absent                                                                         | **present**: `CGATS001Compat-v2-micro.icc`                                                                                   | pointed at by `iccUrl`                                                                                                                        |
| `cmaps/`                                       | present                                                                        | 169 files                                                                                                                    | `cMapUrl`                                                                                                                                     |
| `standard_fonts/`                              | present                                                                        | 16 files                                                                                                                     | `standardFontDataUrl`                                                                                                                         |
| `legacy/`, `web/`, `types/`, `image_decoders/` | present                                                                        | 100 / 86 / 151 / 3 files                                                                                                     |                                                                                                                                               |

Build cost: `pdf.min.mjs` 448 KB, `pdf.worker.min.mjs` 1 235 KB,
`pdf.sandbox.min.mjs` 65 KB. The worker roughly doubles versus
`pdf.worker.min.js` on 3.x, and the sandbox becomes a real decision (see §4).

Related: the app sets **none** of `cMapUrl`, `standardFontDataUrl`,
`useWorkerFetch`, `iccUrl` or `wasmUrl` anywhere. On 3.11.174 that happens to
work, because `build/pdf.js` resolves `useWorkerFetch` to falsy when those URLs
are unset and falls back to main-thread factories. In 6.4.299 the same line is
explicit:

```js
const useWorkerFetch = typeof src.useWorkerFetch === "boolean"
  ? src.useWorkerFetch
  : !!(BinaryDataFactory === DOMBinaryDataFactory &&
      cMapUrl && cMapPacked && standardFontDataUrl && wasmUrl && /* … */);
```

so leaving them unset keeps the old fallback but gives up worker-side fetching.
It is an accident of the current defaults, not a decision.

## 4. Security posture changes on 6.x: `isEvalSupported` is removed, not renamed

Verified against the unpacked 6.4.299 build:

| Search            | `pdf.mjs` | `pdf.worker.mjs` | `types/`                                                                                                |
| ----------------- | --------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `isEvalSupported` | **0**     | **0**            | **0**                                                                                                   |
| `enableScripting` | 11        | –                | present on `annotation_layer*.d.ts` and `web/pdf_viewer.d.ts`, **absent from `DocumentInitParameters`** |
| `quickjs`         | 0         | 0                | – (`pdf.sandbox.mjs` only)                                                                              |

Consequences:

1. **`isEvalSupported: false` cannot be carried over.** The knob is gone from
   6.x entirely. The `CVE-2024-4367` acceptance in
   `security/audit-exceptions.json` therefore has to be re-evaluated against
   6.x, not re-dated — the vulnerable code path no longer exists. **This has to
   be re-audited, not assumed fixed.**
2. **`enableScripting: false` becomes meaningful** — `pdf.mjs:20874` reads
   `enableScripting: params.enableScripting === true`, gating PDF JavaScript
   _actions_ (`data.actions` + `hasJSActions`). It is still **not declared on
   `DocumentInitParameters`**, so both call sites will need an explicit cast.
3. **`quickjs-eval.wasm` is only referenced by `pdf.sandbox.mjs`.** If
   `enableScripting` stays false and no sandbox is loaded, that 4th wasm blob
   is dead weight in the package. Decide explicitly whether to ship the sandbox
   at all.
4. `GlobalWorkerOptions` still exists (`types/src/display/worker_options.d.ts`)
   and gains **`workerPort`**, which accepts a pre-built `Worker` instance —
   useful for keeping the "one worker for the whole renderer" invariant without
   RPV's `<Worker>` component.

## 5. `enableScripting: false` cannot be set type-safely on 3.x

The flag exists in the 3.11.174 bundle (12 occurrences) but **only in the
annotation layer** — `_setDefaultPropertiesFromJS` and friends return early when
it is unset. `getDocument` never reads it and `pdf.worker.js` contains zero
occurrences, so on 3.x it is a runtime no-op.

It is also **absent from `DocumentInitParameters`**
(`types/src/display/api.d.ts` declares `isEvalSupported` at line 132 and no
`enableScripting`); the only declarations are on `AnnotationLayerParams` and
`AnnotationLayerBuilderOptions`.

So at the two call sites:

- `src/features/pdf/lib/renderPageToImage.ts` — `getDocument({...})` passes an
  object literal directly, so excess-property checking applies and
  `enableScripting` would need a cast.
- `src/features/pdf/ui/components/PdfViewerElement.tsx` — `transformDocParams`
  types against `PdfJs.GetDocumentParams` imported from **`@react-pdf-viewer/core`**,
  whose own declaration omits `isEvalSupported` too. It compiles today only
  because the return type is inferred, which drops object-literal freshness.

Conclusion: `isEvalSupported: false` stays as the CVE-2024-4367 mitigation on
both sites; `enableScripting` is added **during** the upgrade, where it both
becomes meaningful and type-checks.

## 6. The coupling test fails by design on any version bump

`src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts` hard-fails in
several places at once:

| Line    | Assertion                                                        |
| ------- | ---------------------------------------------------------------- |
| 43, 90  | `VIEWER_PEER_RANGE` must equal the viewer's declared range       |
| 52–60   | `pdfjs-dist` must be an exact version, not a range               |
| 62–66   | `overrides['pdfjs-dist']` must equal the dependency              |
| 68–83   | the installed version must satisfy the peer range                |
| 93–104  | `isEvalSupported: false` on both `getDocument` sites             |
| 106–113 | the worker must come from `pdfjs-dist` via the literal specifier |

This is intentional anti-accident drift protection and must be rewritten
deliberately during the migration, not deleted. Rows 43/68–83/90 become
**moot** once the viewer is gone; rows 52–60/62–66 (exact pin + `overrides`) and
93–104 (`isEvalSupported: false`, which no longer exists in 6.x) and
106–113 (worker specifier) must all be **rewritten**.

## What is not a blocker

- **Deprecated pdf.js APIs.** There is **no `@deprecated` tag anywhere** in
  `pdfjs-dist@3.11.174`'s type surface. Migration risk here is not
  deprecation-driven.
- **`isEvalSupported` behavior.** Genuinely honoured end to end on 3.11.174:
  read at `pdf.js:929`, forwarded at 987 and 998, enforced at the eval gate at
  6197, with 31 further references in `pdf.worker.js`. (It is still absent in
  6.x — see blocker 4.)
- **Module format interop.** The CJS/ESM shim at `renderPageToImage.ts:118-119`
  is the only place that needs attention, and `src/types/assets.d.ts` already
  declares a catch-all `declare module '*?url'`, so a renamed worker specifier
  still type-checks. On 6.x the shim becomes unnecessary: `main` is
  `build/pdf.mjs`, so Vite resolves real ESM named exports.
- **Main process.** `electron/` and `shared/` contain no pdfjs references at
  all; nothing about the PDF asset path is served or rewritten there. Verified
  again this phase: the only `shared/` hits are an IPC channel constant and a
  doc comment.
- **Text layer / annotation layer / search primitives.** `pdfjs-dist@6.4.299`
  exports `TextLayer`, `TextLayerImages`, `AnnotationLayer`,
  `AnnotationEditorLayer`, `AnnotationEditorUIManager`, `XfaLayer`,
  `RenderingCancelledException`, `PasswordException`, `AbortException` and
  `version` from `types/src/pdf.d.ts`. Everything QuizLab currently reads out of
  RPV's DOM is a first-class export of the engine.

## Files a migration would touch

Blocking:

- `package.json` — the two exact pins, the four viewer versions, `build.files`
- `package-lock.json` — regenerated
- `.npmrc` — blocker 2
- `src/features/pdf/ui/components/PdfWorkerHost.tsx` — worker specifier, `<Worker>`
- `src/features/pdf/lib/renderPageToImage.ts` — worker specifier, CJS/ESM shim,
  `getDocument` params
- `src/features/pdf/ui/components/PdfViewerElement.tsx` — `transformGetDocumentParams`,
  `enableScripting`
- `src/types/assets.d.ts` — the literal worker declaration becomes dead
- `src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts` — blocker 6
- `security/audit-exceptions.json` — `installed` version, advisory ids, expiry
- `vite.config.mts` — `vendor-pdf` chunking and the `EVAL` warning filter
- `src/__tests__/architecture/security-gate-wiring.test.ts` — pins
  `installed: '3.11.174'` and the advisory id
- `src/shared/styles/modules/_pdf-viewer.css` — all 26 `rpv-*` rule blocks

New (native viewer surface, no current equivalent):

- `src/features/pdf/engine/*` — document/viewer/search controllers, worker
- `src/features/pdf/lib/pdfViewerDom.ts` — rewritten against our own markup
- `src/features/pdf/ui/components/PdfViewerElement.tsx` — rewritten

Re-verification required, not necessarily edits:

- `src/features/pdf/lib/pdfViewerDom.ts` — five selectors were read out of
  `core@3.12.0`'s own bundle; a viewer major bump invalidates all of them and
  silently breaks text extraction, selection, pan and capture
- `src/features/pdf/lib/activePdfDocumentRegistry.ts` — hand-written structural
  mirror of `PDFDocumentProxy`, reached through `as never` /
  `as unknown as` casts that defeat compiler checking
- `src/features/pdf/errors/pdfRenderErrors.ts` — its markers were deliberately
  scoped to what 3.11.174 and core@3.12.0 actually emit
- Tests that `vi.mock('@react-pdf-viewer/core', …)` against 3.12.0's exports:
  `LeftPanel.test.tsx`, `PdfViewer.test.tsx`, `usePdfResizeRefit.test.tsx`,
  `usePdfViewerZoomIpc.test.tsx`
- `src/features/pdf/ui/hooks/usePdfPlugins.ts` — the plugin-bridge hook has no
  native counterpart and its contract (`plugins`, `jumpToPageRef`, `ZoomIn`,
  `ZoomOut`, `CurrentScale`, `zoomTo`, `highlight`, `clearHighlights`) is consumed
  by `usePdfViewerState` and `PdfToolbar`
- `src/features/pdf/constants/pdfZoom.ts` — the comment ties `PDF_ZOOM_STEP` to
  "the @react-pdf-viewer/zoom toolbar step"; natively it is just our step

---

# Part III — Test coverage

40 test files under `src/__tests__/features/pdf/` (~317 `it(`/`test(`), plus
`src/__tests__/architecture/pdfjs-engine-worker-coupling.test.ts` (6 tests) and
`src/__tests__/platform/electron/api/usePdfApi.test.tsx`.

| Bucket                                                     | Verdict                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text extraction (page DOM text)                            | TESTED                                                                                                                                                      |
| Text selection (drag → AI)                                 | PARTIAL — `extractSelectedText` + `normalizePdfText` TESTED; `usePdfTextActions` listener wiring UNTESTED                                                   |
| Capture / screenshot                                       | TESTED                                                                                                                                                      |
| Page → high-DPI image                                      | **UNTESTED** — `renderPageToImage` is only `vi.mock`ed; `usePdfScreenshot.test.tsx` passes no `pdfUrl`, so neither high-DPI branch executes                 |
| Search                                                     | PARTIAL — bar + store + shortcut TESTED; highlight execution UNTESTED                                                                                       |
| Navigation                                                 | TESTED (16 tests across 3 files)                                                                                                                            |
| Zoom                                                       | PARTIAL — constants, IPC, coalescing, layout, refit TESTED; `usePdfCtrlWheelZoom`, `PdfZoomControls`, `PdfPageNav`, `usePdfViewerZoomOrchestrator` UNTESTED |
| Progress persistence / resume                              | TESTED                                                                                                                                                      |
| PDF tabs                                                   | PARTIAL — store TESTED (28 tests); `PdfTabStrip`, `PdfTabItem`, `TabContextMenu`, `pdfTabStripUtils`, `useTabEditing`, roving UNTESTED                      |
| Pan                                                        | PARTIAL — helpers + toolbar toggle TESTED; `usePdfPanTool` drag UNTESTED                                                                                    |
| Context menu                                               | TESTED                                                                                                                                                      |
| GPU / canvas cleanup                                       | TESTED                                                                                                                                                      |
| Error handling                                             | TESTED (guard); `renderError` / `renderLoader` UI UNTESTED                                                                                                  |
| Worker coupling / engine pinning                           | TESTED (architecture)                                                                                                                                       |
| View mode / single page                                    | TESTED (asserted prop only) — scroll mode, theme, reload key, registry wiring UNTESTED                                                                      |
| Links / annotations                                        | UNTESTED (no app code)                                                                                                                                      |
| Search next/prev match                                     | absent from the product                                                                                                                                     |
| Google Drive tab, toolbar quick bar, open/drop, focus mode | TESTED / PARTIAL                                                                                                                                            |

**Four tests mock `@react-pdf-viewer/core`; none mock `pdfjs-dist`.** Every mock
will need rewriting or deleting with the viewer.

Largest concrete gaps to close **before** touching the renderer:
`renderPageToImage` high-DPI path, `usePdfTextActions` selection wiring,
`usePdfPanTool` drag, `usePdfCtrlWheelZoom`, `PdfTabStrip` internals, search
highlight execution, `captureCanvasAsBlob`'s JPEG threshold.

## Phase 2 result — regression baseline closed

Six of those seven gaps are now covered on `refactor/native-pdfjs-viewer`. No
production code changed; 125 tests were added across 7 files (44 PDF test files /
442 tests, up from 40 / 317).

| New file                                                       | Tests | What it now pins                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/pdf/lib/renderPageToImage.test.ts`                   | 27    | borrowed-proxy reuse and that the borrowed proxy is **never** destroyed (success _and_ failure path), destroyed-proxy eviction, self-load `getDocument` params, `finally` destroy on all three exits, the pixel budget for both callers, the clone fallback, `toBlob` → null fall-through |
| `features/pdf/capture/captureCanvasAsBlob.test.ts`             | 11    | the strict `>` JPEG threshold at 11.997 MP / exactly 12 MP / 12.001 MP, option overrides, rejection on a null blob                                                                                                                                                                        |
| `features/pdf/capture/usePdfCaptureActions.test.ts` (extended) | +19   | all five rungs of the capture ladder, the 12 MP `toDataURL` guard, request-id staleness across a re-render, GPU-released canvas re-validation                                                                                                                                             |
| `features/pdf/text/usePdfTextActions.test.tsx`                 | 23    | capture-phase listener registration, out-of-container and detached-anchor selectionchange, the 150 ms scroll lock, rAF coalescing and unmount cancellation, the `pdf-selection-active` class, `requestIdleCallback` vs the 500 ms timeout fallback                                        |
| `features/pdf/interaction/usePdfPanTool.test.tsx`              | 19    | primary-button-only drag, pointer capture/release lifecycle, scrollable-ancestor resolution, the `INNER_CONTAINER_SELECTOR` fallback, pan-mode toggling, unmount cleanup                                                                                                                  |
| `features/pdf/viewport/usePdfCtrlWheelZoom.test.tsx`           | 16    | `{ passive: false, capture: true }` registration, modifier handling, clamps from `constants/pdfZoom`, pan-mode suppression, the 40 ms throttle                                                                                                                                            |
| `features/pdf/ui/usePdfPluginsHighlights.test.tsx`             | 14    | `safeRenderHighlights` output geometry, guards, `pdf-highlight-fadein` and the `prefers-reduced-motion` branch                                                                                                                                                                            |

Still open: `PdfTabStrip` internals, `usePdfViewerState` /
`usePdfViewerZoomOrchestrator`, `PdfZoomControls`, `PdfPageNav`.

Each new suite was mutation-validated: 19 deliberate production mutations were
injected one at a time and 19/19 were caught by the intended tests, then reverted.

### Two behaviours pinned as-is, worth knowing before rewriting them

1. **The pixel budget is enforced to within a rounding epsilon, not exactly.**
   `renderWithPdfJs` derives the downscale ratio from the _rounded_ viewport
   dimensions, then rounds the rescaled dimensions again without re-checking
   them (`renderPageToImage.ts:139-146`). An A0 page rendered at the capture call
   site's scale 4 / 20 MP comes out at 20 001 639 px — 0.008 % over. Harmless,
   but a rewrite that re-checks the budget will not be behaviour-preserving in
   the strict sense, and the tests deliberately allow a 0.1 % tolerance.
2. **The `anchorNode.isConnected` guard in `handleSelectionChange` is almost
   dead code.** For a detached anchor with real selected text, both the guarded
   and unguarded paths end up silent. The guard is observable in exactly one
   case: a non-collapsed range whose text is empty, where without it a 50 ms
   timeout would clear the pill from an already-torn-down page. It is pinned
   for that case only.

---

# Part IV — Performance baseline (must survive)

| Mechanism                                       | Where                                                                                    | Notes                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Page virtualization / lazy rasterization        | RPV internals                                                                            | only renders pages near the viewport; **must be rebuilt**                                                                     |
| Worker reuse                                    | `PdfWorkerHost` mounted once in `LeftPanel`                                              | survives open/close and tab switches; pdfjs 6's `GlobalWorkerOptions.workerPort` can reproduce it                             |
| Document cache / reuse                          | `activePdfDocumentRegistry`                                                              | capture reuses the live proxy instead of re-fetching a large file; `destroyed` check prevents dead-proxy use after a reload   |
| Page-proxy cache                                | `PDFDocumentProxy` per-page cache                                                        | capture deliberately does **not** call `PDFPageProxy.cleanup()`, because that clears `objs` and forces a font/image re-decode |
| Canvas GPU release                              | `useCanvasGpuCleanup` MutationObserver                                                   | zeroes `width`/`height` on every canvas that leaves the DOM, synchronously                                                    |
| Total pixel budget                              | 50 MP cap, off-screen largest-first demotion                                             | protects HiDPI and textbook-length documents                                                                                  |
| rAF zoom coalescing                             | `useCoalescedZoom`                                                                       | one `zoomTo` per frame; primary defence against `RenderingCancelledException` / "canvas context is locked"                    |
| Resize debounce + locks                         | `usePdfResizeRefit` (150 ms), `useContainerSize` (500 ms nav lock, 50 ms panel throttle) | prevents repaint storms                                                                                                       |
| Fit-scale quantization                          | 1 % dead-zone                                                                            | ±1 px container noise must not repaint                                                                                        |
| GPU containment                                 | `contain: layout paint` / `contain: strict` in `_pdf-viewer.css`                         | must be reproduced in our CSS                                                                                                 |
| Text-extraction fast path                       | `textContent` first, `innerText` only for <5 chars or suspicious glyphs                  | one batched layout pass instead of per-span `getComputedStyle`                                                                |
| Idle-deferred page text                         | `requestIdleCallback(timeout: 2000)` with a 500 ms `setTimeout` fallback                 | keeps extraction off the render path                                                                                          |
| Selection rAF coalescing + 150 ms scroll freeze | `usePdfTextActions`                                                                      | avoids work during scroll                                                                                                     |
| Page/canvas lookup caching                      | `findPageCanvas` cache, `PAGE_LAYER_CACHE` keyed by page, both `isConnected`-revalidated |                                                                                                                               |
| Capture request stamping                        | `captureRequestIdRef` + `pdfUrl` check                                                   | drops and **revokes** stale renders                                                                                           |
| Highlight fade-in delay                         | 400 ms `pdf-highlight-fadein`                                                            | dozens of highlight divs must not compete with page rasterization                                                             |
| Manual chunking                                 | `vendor-pdf` in both `rollupOptions` and `rolldownOptions`                               | keeps pdf.js out of the main chunk                                                                                            |

---

# Part V — Target architecture

## Dependency rules this must respect

`.dependency-cruiser.cjs`:

- `no-cross-feature-internals:*` — `pdf` may reach another feature only via
  `src/features/<other>/index.ts`.
- `app-no-feature-internals` — `app/` and `shared/` may only import
  `@features/pdf`, `@features/pdf/viewer`, `@features/pdf/types`,
  `@features/ai/aiViewSurface`, `@features/ai/viewState`,
  `@features/screenshot/tool` (allow-list is mirrored in `eslint.config.mjs`).
- `no-circular`, `renderer-no-electron-direct`, `shared-core-no-electron`,
  `no-nodejs-from-browser`.

Current internal layering already separates cleanly, and the migration should
keep that shape rather than introduce new class hierarchies:

```
app  →  @features/pdf (index: light hooks/stores)  |  @features/pdf/viewer (heavy)
```

## Proposed target (minimal, convention-matching)

```
src/features/pdf/
├── index.ts                    unchanged — light entry point
├── viewer.ts                   unchanged — heavy entry point, still lazy
├── types.ts                    unchanged
├── engine/                     NEW — replaces RPV; no React
│   ├── pdfWorker.ts            workerSrc / workerPort setup, GlobalWorkerOptions,
│   │                           getDocument + isEvalSupported/enableScripting policy
│   ├── documentManager.ts      PDFLoadingTask + PDFDocumentProxy ownership,
│   │                           load/reload/destroy, active-proxy publication
│   ├── pageRenderer.ts         PDFPageProxy.render → canvas, cancellation,
│   │                           render budget/cancellation
│   ├── pageCache.ts            per-page proxy + viewport reuse
│   └── searchController.ts     getTextContent scan → match ranges → overlay model
├── lib/
│   ├── activePdfDocumentRegistry.ts   KEPT, but typed against the real
│   │                                  pdfjs types instead of the structural mirror
│   ├── renderPageToImage.ts           kept; ESM shim and worker specifier updated
│   └── pdfViewerDom.ts                REWRITTEN: selectors for OUR markup,
│                                      but the same public surface, so
│                                      capture/text/pan callers do not change
├── text/                       kept as-is (normalizePdfText, extractSelectedText,
│                               orderTextItems/collectTextItems)
├── capture/                    kept as-is
├── interaction/                kept as-is
├── viewport/                   kept as-is
└── ui/components/
    ├── PdfViewerElement.tsx    rewritten: our scroll container, our page mount,
    │                           our scale/page state, no <Viewer>
    ├── PdfTextLayer.tsx        NEW: mounts pdfjs TextLayer for the current page
    ├── PdfAnnotationLayer.tsx  NEW: mounts pdfjs AnnotationLayer (links)
    ├── PdfSearchOverlay.tsx    NEW: renders the highlight overlay from
    │                           searchController output (keeps pdf-highlight-fadein)
    └── PdfToolbar / PdfPageNav / PdfZoomControls
                                kept; re-plumbed to our zoom/page API
```

Two explicit design decisions:

1. **`engine/` must contain no React.** That preserves the property that makes
   `renderPageToImage` work in a non-React context and keeps the lazy chunk
   boundary at `viewer.ts`. RPV forced the opposite (plugins call React hooks —
   see the `usePdfPlugins` comment), which is why `usePdfPlugins` needs its
   first-render-instance pinning hack.
2. **Do not create a class hierarchy.** The engine surface should be plain
   factory functions returning plain objects, matching `lib/activePdfDocumentRegistry.ts`
   and `lib/renderPageToImage.ts`, which are already module-level functions with
   module-level state. `PdfDocumentManager` as a _class_ would be the only such
   abstraction in the feature.

---

# Part VI — PDF.js 6 target

**Target: `pdfjs-dist@6.4.299` — VERIFIED against the npm registry this phase.**
`npm view pdfjs-dist dist-tags` → `{"latest": "6.4.299"}`;
`npm view pdfjs-dist time.modified` → `2026-10-03T16:47:40Z`.
Available 6.x line, oldest first: `6.0.227`, `6.1.200`, `6.2.108`, `6.3.289`,
`6.4.299`. Predecessor stable is `5.7.284`.

Because 6.4.299 was published three days ago, **pin exactly and re-verify before
Phase 2**; do not use a caret range.

Verified 6.x deltas that change the plan (blocker 4 above, summarised):

| Item                                                                         | 3.11.174                      | 6.4.299                                  | Action                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Module format                                                                | UMD `build/pdf.js`            | ESM `build/pdf.mjs`                      | drop the `default ?? module` shim                                         |
| Worker asset                                                                 | `build/pdf.worker.min.js?url` | `build/pdf.worker.min.mjs?url`           | update specifier; `declare module '*?url'` already covers it              |
| `isEvalSupported`                                                            | present, honoured             | **removed**                              | re-audit `CVE-2024-4367`; drop the flag                                   |
| `enableScripting`                                                            | no-op for `getDocument`       | read at `pdf.mjs:20874`; untyped         | add `enableScripting: false` **with a cast**                              |
| `wasmUrl` / `iccUrl` / `cMapUrl` / `standardFontDataUrl`                     | unset, harmless               | `wasmUrl` gates `useWorkerFetch` default | ship `wasm/`, `iccs/`, `cmaps/`, `standard_fonts/` and configure all four |
| `GlobalWorkerOptions`                                                        | `workerSrc` only              | `workerSrc` + `workerPort`               | use `workerPort` to keep one worker                                       |
| `TextLayer`, `AnnotationLayer`, `LinkService`, `RenderingCancelledException` | not exported                  | all exported from `types/src/pdf.d.ts`   | replaces every RPV DOM reach-in                                           |

---

# Part VII — Migration phases

| Phase                                            | Scope                                                                                                                                                                                                    | Exit criteria                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — baseline (this document)**                 | discovery + verified deltas only                                                                                                                                                                         | branch pushed, no source change ✔                                                                                                                                    |
| **2 — close the test gaps**                      | add regression tests for `renderPageToImage` (high-DPI + fallback), `usePdfTextActions` selection wiring, `usePdfPanTool` drag, `usePdfCtrlWheelZoom`, search highlight execution, `PdfTabStrip`         | the behaviours a rewrite would silently break are pinned **before** any renderer change ✔ (125 tests added; `PdfTabStrip` and the two viewer-state hooks still open) |
| **3 — native engine skeleton, viewer untouched** | `engine/` (worker, documentManager, pageRenderer), packaged assets (`wasm/`, `iccs/`, `cmaps/`, `standard_fonts/`) + `build.files`, security policy flip, rewrite `pdfjs-engine-worker-coupling.test.ts` | RPV still renders; the new engine passes its own tests; `pdfjs-dist@6.4.299` installed; `npm run analyze:*` clean                                                    |
| **4 — canvas + page/scale state**                | `PdfViewerElement` renders pages itself; keep `viewMode` single-page, `defaultScale` PageWidth, dark theme, `onPageChange`/`onDocumentLoad`/`onZoom` equivalents                                         | open/close, tab switch, page nav, zoom, fit, reload all behave identically; screenshot + selection still pass                                                        |
| **5 — text layer + selection**                   | `PdfTextLayer`, `extractPageTextFromDom`, `extractSelectedText` retargeted at our markup                                                                                                                 | the Phase-2 selection tests pass unchanged                                                                                                                           |
| **6 — annotation layer + links**                 | `PdfAnnotationLayer`, `PdfTextLayer`, `LinkService`                                                                                                                                                      | links and form widgets behave as they do under RPV                                                                                                                   |
| **7 — search**                                   | `PdfSearchController` + `PdfSearchOverlay`, reusing `pdf-highlight-fadein` and `rpv-search__highlight` geometry                                                                                          | highlight execution passes the Phase-2 tests                                                                                                                         |
| **8 — drop RPV**                                 | delete the four packages, `usePdfPlugins`, the 4 CSS imports, all 26 `rpv-*` rule blocks, `lib/pdfViewerDom.ts`'s RPV selectors; rewrite the 4 tests that mock `@react-pdf-viewer/core`                  | `rg "@react-pdf-viewer\|rpv-"` returns nothing; no `?url` worker import from the viewer                                                                              |
| **9 — cleanup**                                  | `.npmrc` (after the eslint peers), `vite.config.mts` `vendor-pdf`/`EVAL` filter, `security/audit-exceptions.json`, `knip`/`ts-prune` pass, delete `patches`-adjacent stubs                               | `npm run analyze:all` clean, `npm audit` clean without an exception                                                                                                  |

---

# Part VIII — Risks

| Risk                                                                    | Severity | Mitigation                                                                                                                                                         |
| ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Text-selection regression (column ordering, pill placement, multi-page) | **High** | Phase-2 tests first; `collectTextItems`/`orderTextItems` are pure and already reused by both extractors                                                            |
| High-DPI page render regression (the AI image feature)                  | **High** | Phase-2 tests first; keep the 20 MP budget and the 4-stage fallback ladder                                                                                         |
| Lazy rasterization loss → slow / memory-heavy large PDFs                | **High** | rebuild visibility-driven page mounting deliberately; keep the 50 MP canvas budget                                                                                 |
| Search highlight geometry loss                                          | **High** | `safeRenderHighlights` becomes `PdfSearchOverlay`; keep `pdf-highlight-fadein` and the geometry contract                                                           |
| `CVE-2024-4367` acceptance becomes stale/wrong on 6.x                   | **High** | re-audit the advisory in Phase 3; the knob is gone, so the exception entry cannot simply be re-dated                                                               |
| Packaged asset growth (wasm + iccs + cmaps + fonts + a 2× worker)       | Medium   | decide `wasmUrl`/`iccUrl`/`standardFontDataUrl` explicitly; consider `useWasm:false` if JBIG2/OpenJPEG are not needed; skip the sandbox if `enableScripting:false` |
| `RenderingCancelledException` noise changes shape                       | Medium   | re-derive the markers in `pdfRenderErrors.ts` against 6.x                                                                                                          |
| DOM/CSS rewrite churn                                                   | Medium   | every `rpv-*` rule is already namespaced under `.pdf-viewer-container`; migrate rule-by-rule against the parity matrix                                             |
| `.npmrc` removal fails on eslint peers and looks like a PDF regression  | Medium   | Phase 9 only, after the eslint peers are resolved                                                                                                                  |
| Installed-version drift (6.4.299 is 3 days old)                         | Medium   | exact pin; re-verify before Phase 3                                                                                                                                |
| `knip`/`ts-prune` flag newly-unused exports during the rewrite          | Low      | run `analyze:deadcode` in every phase                                                                                                                              |

---

# Part IX — Rollback strategy

Per-phase, because the phases are ordered so that each one is independently
revertable:

1. **Phases 2–3** touch only tests and new `engine/` files plus packaging —
   revert = delete the branch's new files and the `pdfjs-dist` pin change.
2. **Phase 4–7** keep RPV in the tree but bypassed. Rollback = flip the
   `<Viewer>` branch back; no dependency has moved yet, so no reinstall.
3. **Phase 8** removes the packages. Rollback =
   `git revert` + `npm ci` from the pre-Phase-8 `package-lock.json`. Keep the
   Phase-8 `package.json`/`package-lock.json` pair in a tag or a revertable
   commit so the exact pre-removal tree is recoverable.
4. **Phase 9** — `.npmrc` removal is a one-line revert; keep it last for that
   reason.
5. Branch-level safety: `refactor/native-pdfjs-viewer` is never merged to
   `master` until Phase 9 passes. `master` remains a working RPV + pdfjs 3.x
   build throughout, so any rollback is "stop shipping the branch", not
   "reconstruct the old viewer".

---

# Part X — Recommendation and Go/No-Go

## Can native PDF.js provide the required capabilities?

| Capability        | Available in `pdfjs-dist@6.4.299`                                                                                             | Verified how                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Canvas rendering  | yes — `PDFPageProxy.render({canvasContext, viewport})`                                                                        | already used by `renderPageToImage.ts` on 3.x                       |
| Text layer        | yes — `TextLayer` exported from `types/src/pdf.d.ts`                                                                          | exported name present                                               |
| Annotation layer  | yes — `AnnotationLayer`, `AnnotationEditorLayer`, `AnnotationEditorUIManager`, `XfaLayer`                                     | exported names present                                              |
| Search            | yes, by construction — `PDFPageProxy.getTextContent()` gives the item stream; highlight geometry is then our own overlay math | `getTextContent` is the same primitive RPV's search plugin consumes |
| Links             | yes — `LinkService`                                                                                                           | exported                                                            |
| Navigation events | yes — derived from page render completion + scroll position; **no built-in `onPageChange`**, this is ours to build            | not an engine feature                                               |
| Zoom              | yes — `page.getViewport({scale})`                                                                                             | already used on 3.x                                                 |
| Selection         | yes — but only because we would mount the `TextLayer` ourselves; the engine ships no selection manager                        | `TextLayer` export                                                  |

Every RPV-provided capability QuizLab depends on has a first-class engine
equivalent. Nothing in the parity matrix requires re-implementing a PDF
primitive; the work is concentrated in **page mounting/virtualization, highlight
geometry and the DOM adapter**.

## Decision: **GO WITH RISKS**

Reasons:

1. **No `@react-pdf-viewer` release supports pdfjs ≥ 4** (verified: latest is
   still `3.12.0` with `pdfjs-dist: ^2.16.105 || ^3.0.279`). The dependency is
   pinned to a 3.x engine by its own peer range, so "upgrade pdfjs" and "replace
   the viewer" are the same project — there is no smaller path.
2. **The engine already does everything required**, as first-class exports. The
   migration is a viewer replacement, not a PDF reimplementation.
3. **The feature-specific work is already ours.** Selection ordering,
   normalization, capture, progress, resume, pan, zoom orchestration, wheel
   gestures and GPU cleanup are all QuizLab code that does not change meaning.
   Only the ~7 high-risk rows (text layer ownership, highlight geometry, page
   virtualization, high-DPI render) are genuinely at risk.
4. **The accepted `CVE-2024-4367` exception expires 2026-12-31** and its
   mitigation knob does not exist in 6.x, so there is a hard external deadline
   regardless of preference.

Conditions on the GO:

- **Phases 2 and 3 must complete before any renderer change.** Four of the
  highest-risk behaviours currently have no regression test.
- **`CVE-2024-4367` must be re-audited in Phase 3**, not re-dated. The
  vulnerable path is gone in 6.x; the exception needs a real disposition.
- **Package the wasm/icc/cmap/standard-font assets and set all four URLs
  explicitly** rather than relying on 6.x defaults that silently fall back to
  main-thread factories.
- **Do not treat "no `@deprecated` in 3.x" as "no migration work"** — the risk is
  in RPV's DOM, not in pdf.js's API surface.

## Recommendation

1. **Phase 2 (next):** close the four test gaps — `renderPageToImage`
   (high-DPI + each fallback rung), `usePdfTextActions` selection wiring,
   `usePdfPanTool` drag, `usePdfCtrlWheelZoom` — plus a search-highlight
   execution test. No dependency change, no renderer change.
2. **Then Phase 3:** the `engine/` skeleton with RPV still rendering, plus the
   packaging work and the security-policy flip. This is the phase where
   `pdfjs-dist@6.4.299` lands and `pdfjs-engine-worker-coupling.test.ts` is
   rewritten.
3. **Size it as a viewer migration, not a dependency bump.** The work is
   dominated by the DOM adapter, page virtualization and packaging — not by the
   version number.
4. **Keep one worker for the whole renderer**, reproduced with
   `GlobalWorkerOptions.workerPort` so the `PdfWorkerHost` invariant survives.
5. **Keep every programmatic zoom on the single rAF-coalesced channel.** It is
   the cheapest defence against render races and it is already the architecture.
