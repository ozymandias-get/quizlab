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

> **As shipped.** This is the legacy path's pipeline and it is unchanged. Phase 7 ported
> the _algorithm_ behind it — the DOM walk, the per-run `Range` measurement, the
> single-space skip, the `top`/`left` ordering, the fade-in and the reduced-motion branch
> — onto the native text layer; see the Phase 7 section. Note what that algorithm is: the
> plugin never uses `PDFFindController`, so the migration's parity target was always this
> DOM walk and never a PDF.js internals.

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

## Phase 3 attempt — BLOCKED before any implementation

Phase 3's premise is that a native engine can be built **in parallel** while the
existing `@react-pdf-viewer` viewer keeps rendering unchanged. That premise is
false. Single `pdfjs-dist@6.4.299` cannot coexist with the pinned viewer.

Everything below was measured on this branch by installing 6.4.299, running the
gates, and then **reverting to `master`'s dependency state**. The branch carries
no production, dependency or configuration change from this phase; only this
section was added.

### Blocker 1 — the build fails: the worker asset was renamed

pdfjs 6 ships `build/` as ESM only. Measured `node_modules/pdfjs-dist@6.4.299/build`:

```
pdf.mjs  pdf.min.mjs  pdf.sandbox.mjs  pdf.sandbox.min.mjs  pdf.worker.mjs  pdf.worker.min.mjs
```

There is no `pdf.worker.min.js`. Two call sites still request it:

- `src/features/pdf/ui/components/PdfWorkerHost.tsx:2` — the viewer's worker
- `src/features/pdf/lib/renderPageToImage.ts:4` — the capture path

```
$ npm run build:renderer:electron
✗ Build failed
Error: [vite]: Rolldown failed to resolve import
"pdfjs-dist/build/pdf.worker.min.js?url" from
".../src/features/pdf/ui/components/PdfWorkerHost.tsx".
```

**The `.mjs` specifier itself is fine.** An isolated Vite build whose only import
was `pdfjs-dist/build/pdf.worker.min.mjs?url` succeeded in 28 ms and emitted
`assets/pdf.worker.min-<hash>.mjs` (1 264 kB). So the fix is a two-line rename —
but both files are explicitly out of scope for a phase that must leave the
existing viewer untouched.

### Blocker 2 — typecheck fails: `isEvalSupported` no longer exists

```
$ npm run typecheck
src/features/pdf/lib/renderPageToImage.ts(124,61): error TS2353:
  Object literal may only specify known properties,
  and 'isEvalSupported' does not exist in type 'DocumentInitParameters'.
```

Expected — the knob was removed in 4.x, which is why Phase 1 flagged it. But
`renderPageToImage.ts` is the capture path the phase also forbids touching.

### Blocker 3 — the viewer cannot run at all: two pdfjs APIs RPV calls are gone

`@react-pdf-viewer/core@3.12.0` does `require('pdfjs-dist')` and dereferences six
symbols off that namespace. Measured against the installed 6.4.299:

```
{ "version": "6.4.299", "missing": ["renderTextLayer", "SVGGraphics"] }
```

`SVGGraphics` was removed in 4.x. So was `renderTextLayer`, the function RPV
calls on its **per-page text-layer hot path**:

```js
// node_modules/@react-pdf-viewer/core/lib/cjs/core.js:2150
renderTask.current = PdfJsApi__namespace.renderTextLayer({
  container: containerEle,
  textContent,
  textContentSource,
  viewport
})
```

With that symbol `undefined`, **every page render** throws
`TypeError: PdfJsApi__namespace.renderTextLayer is not a function`, and the
`.then(...)` that would call `onRenderTextCompleted()` never runs — so RPV's page
render lifecycle never completes either. The consequences are exactly the two
highest-risk features in the parity matrix:

- no text layer ⇒ `extractPageTextFromDom` returns nothing ⇒ **"send page text to
  AI" dead**
- no text layer ⇒ `extractSelectedText` finds no spans ⇒ **"send selection to AI"
  dead**, plus `pdf-selection-active` and the pill never appear

The remaining four symbols (`getDocument`, `GlobalWorkerOptions`,
`PasswordResponses`, `PDFWorker`) do still exist, so this is not a total
import failure — it fails at first paint, which is worse for diagnosis.

Repairing Blocker 3 means patching or forking the viewer, which the phase
explicitly forbids. That is the hard stop.

### What was verified and still holds

These facts survive the decision, because they are properties of pdfjs 6 itself:

| Check                 | Result                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installed content     | `build/pdf.mjs` 841 kB, `build/pdf.worker.min.mjs` 1 235 kB, `web/pdf_viewer.mjs` 312 kB — **all present**                                                                                            |
| `wasm/`               | **present** — 13 files, 1.47 MB: `jbig2.wasm`, `openjpeg.wasm`, `qcms_bg.wasm`, `quickjs-eval.wasm` + 3 `*_nowasm_fallback.js`                                                                        |
| `iccs/`               | **present** — 2 files, ~10 kB (`CGATS001Compat-v2-micro.icc`)                                                                                                                                         |
| `cmaps/`              | **present** — 169 files, 1.11 MB                                                                                                                                                                      |
| `standard_fonts/`     | **present** — 16 files, 0.76 MB                                                                                                                                                                       |
| `main` / `types`      | `build/pdf.mjs` / `types/src/pdf.d.ts`; **no `exports` field**                                                                                                                                        |
| Engine-level API      | `TextLayer`, `TextLayerImages`, `AnnotationLayer`, `LinkService`, `RenderingCancelledException`, `PasswordException`, `AbortException` all exported                                                   |
| `GlobalWorkerOptions` | has both `workerSrc` and `workerPort`                                                                                                                                                                 |
| Worker specifier      | `.mjs?url` resolves and emits correctly under Vite                                                                                                                                                    |
| Lockfile churn        | `+326 / −150`, entirely pdfjs-related: dropped 3.x optional deps (`canvas`, `nan`, `path2d-polyfill`, `simple-get`, `simple-concat`) for 6.x's optional `@napi-rs/canvas`. **No unrelated upgrades.** |
| `npm ls`              | root `pdfjs-dist@6.4.299`, RPV `3.12.0` deduped onto it, `overridden`. Install succeeds only because `legacy-peer-deps=true` suppresses `ERESOLVE`.                                                   |

### Audit disposition — CVE-2024-4367 is genuinely resolved by 6.4.299

```
$ npm audit --omit=dev          # no pdfjs advisory at all
$ npm run check:audit
[audit] FAILED
  pdfjs-dist is no longer reported — remove the exception
```

The repo's own gate produced the disposition this plan called for. The
vulnerable eval-based font path no longer exists in 6.x at all — `isEvalSupported`
has **zero** occurrences in `build/pdf.mjs`, `build/pdf.worker.mjs` and `types/` —
so the advisory is resolved by the version, not by a workaround. When 6.4.299
becomes installable, the entry in `security/audit-exceptions.json` must be
**deleted**, not re-dated, and no replacement exception should be invented.
It was deliberately left in place here, because reverting to 3.11.174 brings the
advisory back and `npm run check:audit` correctly fails without it.

### Decision required — single version vs temporary dual version

This is a call for the maintainer, not for the implementation phase. Both options
were scoped; neither was started.

**Option A — single pdfjs 6, upgrade the viewer in the same change.**
Requires resolving Blocker 3, i.e. a viewer release that uses `TextLayer` and
`SVGFactory` instead of `renderTextLayer` and `SVGGraphics`. `npm view
@react-pdf-viewer/core version` still returns **3.12.0**, so this means replacing
the viewer (the Phase 4–8 plan) with **no working viewer in the interim** — the
app cannot ship PDF between now and Phase 8. It is the end state, but it is a
large-bang cut, not an incremental migration.

**Option B — temporary dual version: RPV on pdfjs 3, native engine on pdfjs 6.**
Npm cannot express this for a single root dependency, so it needs one of:

- an npm alias, e.g. `"pdfjs-6": "npm:pdfjs-dist@6.4.299"`, with the native
  engine importing `pdfjs-6` and `@react-pdf-viewer` keeping its `pdfjs-dist@3.11.174`.
  Both trees coexist; the RPV `require('pdfjs-dist')` stays on 3.x.
- keeping `pdfjs-dist@3.11.174` as the root pin and resolving 6.4.299 under a
  second path via a Vite alias (weaker: it breaks `require()` interop for RPV).

Option B unblocks the whole plan: Phase 3 (engine + worker + assets + security)
becomes possible with zero viewer risk, and the RPV removal in Phase 8 also
deletes the second copy. Cost: two pdf.js runtimes in the bundle, so
`vendor-pdf` chunking and bundle size need measuring, and the engine must never
share a `PDFWorker` or a `GlobalWorkerOptions` with the viewer — the "one worker"
invariant becomes one worker _per engine_.

**Recommendation: Option B via the npm alias.** It is the only path that keeps
the shipped viewer working while the native engine is built, and it is
reversible: dropping the alias and the alias import restores a single-version
tree with one commit.

### Consequence for the phase table

| Phase                        | Status                                                   |
| ---------------------------- | -------------------------------------------------------- |
| 1 — baseline                 | done                                                     |
| 2 — regression baseline      | done                                                     |
| 3 — native engine foundation | **BLOCKED** by the RPV/pdfjs 6 runtime incompatibility   |
| 3B — dual-runtime foundation | done — **Option B approved and implemented** (see below) |
| 4–8 — viewer migration       | unblocked                                                |
| 9 — cleanup                  | unchanged                                                |

## Phase 3B — dual-runtime native engine foundation

**Decision: Option B approved.** Two PDF.js runtimes are now installed on
purpose so the native engine can be built while `@react-pdf-viewer` keeps
shipping unchanged. This is a deliberate, temporary architecture — see
[Exit plan](#phase-3b-exit-plan) for how it is removed.

### Dependency graph

```
quizlab-reader@6.6.0
├── pdfjs-dist@3.11.174          exact pin + overrides → legacy runtime
│   └── @react-pdf-viewer/core@3.12.0  (require('pdfjs-dist'), peer ^2.16.105 || ^3.0.279 ✓)
│       ├── page-navigation@3.12.0   ├── search@3.12.0   └── zoom@3.12.0
├── pdfjs-6 → npm:pdfjs-dist@6.4.299 → native runtime
│   └── consumed only by src/features/pdf/engine/**
└── (transitive: @napi-rs/canvas + 10 platform binaries — pdfjs 6's optional dep)
```

Verified: `overrides["pdfjs-dist"]` did **not** hijack the alias. Npm keys
overrides by dependency name, and the alias resolves as `name: "pdfjs-dist",
version: "6.4.299"` under a separate tree entry. Lockfile churn was **+279 /
−0** — purely additive (`node_modules/pdfjs-6`, `@napi-rs/canvas` and its
platform binaries), no unrelated upgrades. Local Node is v24.13.0, which
satisfies pdfjs 6's `engines: >=22.13.0 || >=24`.

### Native engine

`src/features/pdf/engine/` — six files, **zero** React/DOM/UI/zustand/RPV
imports. Dependency direction `UI → engine → pdfjs-6`, asserted by
`src/__tests__/architecture/pdfjs-dual-runtime.test.ts`.

| File                    | Responsibility                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `pdfWorker.ts`          | publishes `pdfjs-6.GlobalWorkerOptions.workerSrc` once; exports the resolved `.mjs` URL |
| `pdfDocumentOptions.ts` | the single `getDocument` parameter builder: scripting + asset policy                    |
| `documentManager.ts`    | owns the `PDFLoadingTask`, with load / reload / getDocument / destroy                   |
| `pageCache.ts`          | page number → `PDFPageProxy`, clearable, rejections not cached                          |
| `pageRenderer.ts`       | `PDFPageProxy` → viewport → canvas → `RenderTask`, with cancellation                    |
| `index.ts`              | barrel                                                                                  |

Two pdf.js 6 API changes shaped this:

- **`PDFDocumentProxy.destroy()` no longer exists** in 6.x — the proxy has only
  `cleanup()`. `PDFDocumentLoadingTask.destroy()` is now the teardown call that
  "aborts all network requests and destroys the worker". The manager therefore
  tears down through the _loading task_, never through a document. The legacy
  `renderPageToImage.ts:178` still calls `destroy()` on the document, which is
  correct for 3.11.174 and must keep doing so until the viewer is gone.
- **`DocumentInitParameters.url` is typed `string | URL` only** in 6.x; the
  `TypedArray | ArrayBuffer` variants the 3.x declaration accepted are gone. The
  engine's `PdfDocumentSource` derives from `getDocument`'s own signature rather
  than deep-importing the type, because the package's root type entry does not
  re-export it and there is no `exports` map to make a deep path safe.

### Worker strategy: `workerSrc`, not `workerPort`

`workerPort` would make the `Worker` instance explicit but moves its whole
lifetime into our code, and pdf.js would then no longer own the global worker.
The "one worker per runtime" invariant is a property of `workerSrc` already:
pdf.js lazily creates one `PDFWorker` bound to the module instance it was
configured on. That is the mechanism the legacy path already relies on, so the
native path inherits a proven pattern instead of inventing one.

Verified in a real build: `pdfjs-6/build/pdf.worker.min.mjs?url` resolves and
emits `pdf.worker.min-<hash>.mjs` at 1 264 kB.

### Worker and runtime isolation

Both runtimes are asserted separate at test time:

- `pdfjs-dist.GlobalWorkerOptions` and `pdfjs-6.GlobalWorkerOptions` are
  **different objects**; the installed versions differ (`3.11.174` vs `6.4.299`)
- initializing the native worker leaves the legacy `workerSrc` untouched
  (asserted with a sentinel value)
- no `workerPort` is ever set on either namespace, so a port cannot be shared

Chunking was split accordingly: `vendor-pdf-legacy` (3.x + RPV) and
`vendor-pdf-native` (6.x). Folding them into one chunk would make it impossible
to delete either runtime later without re-deriving what the other contains.

### Asset packaging

Staged from `node_modules/pdfjs-6` into `dist/pdfjs/` — 200 files, 3.36 MB:
`cmaps/` 169 files 1.11 MB · `standard_fonts/` 16 files 0.76 MB · `wasm/`
13 files 1.47 MB · `iccs/` 2 files ~10 kB.

No new dependency. A small inline Vite plugin in `vite.config.mts` serves the
files from `node_modules` in dev (`configureServer`) and copies them in the build
(`closeBundle`). Two alternatives were rejected: committing 3.4 MB of binaries to
`public/`, and adding a copy plugin for one directory. `closeBundle` runs after
Vite has written output _and_ after `emptyOutDir` wiped it, so `dist/pdfjs`
cannot accumulate stale files — and the hook only ever adds files under its own
directory; nothing generic is deleted.

### `useWorkerFetch`: deliberately unset

Read out of 6.4.299 rather than guessed. PDF.js computes it as

```js
useWorkerFetch = … && isValidFetchUrl(cMapUrl, document.baseURI) && …
```

and `isValidFetchUrl` requires an `https?:` protocol. So the default is correct
for both environments this app runs in:

- dev, base `http://localhost:5173/` → `true`, worker-side `fetch`
- packaged Electron, base `file://` → `false`, main-thread factories

and `fetchData` itself falls back to `XMLHttpRequest` for non-http(s) URLs,
accepting `status === 0`, which is what a `file://` read reports. Pinning
`useWorkerFetch` in our options would override a scheme-aware decision and break
one of the two environments.

Asset URLs are built from `import.meta.env.BASE_URL` (`'./'` in a production
build), so the same options work in dev, in a production build and in the
packaged app. No absolute or machine-specific path is embedded — asserted by test.

### Security status, per runtime

**Legacy runtime — `pdfjs-dist@3.11.174`** (shipped, via `@react-pdf-viewer`)

- `isEvalSupported: false` retained on both 3.x `getDocument` call sites
- advisory **still reported**: `GHSA-wgrm-67xf-hhpq` (CVE-2024-4367), severity
  high, range `<=4.1.392`, against `node_modules/pdfjs-dist`
- exception in `security/audit-exceptions.json`: **KEPT UNCHANGED** — same
  advisory ids, same `installed: 3.11.174`, same expiry 2026-12-31. Not extended,
  not duplicated, not rewritten.

**Native runtime — `pdfjs-6` / `pdfjs-dist@6.4.299`**

- `enableScripting: false` on every native `getDocument` path, via a narrow local
  intersection (`DocumentInitParameters & { enableScripting?: boolean }`) because
  PDF.js reads the flag but does not declare it. No `as any`.
- `isEvalSupported` **not passed** — removed in 4.x
- advisory: **none**. `npm audit` does not report the alias; the range
  `<=4.1.392` does not cover 6.4.299. No exception needed, none added.

This is why the Phase 3 disposition could not simply be applied: in the earlier
single-version experiment the exception went stale because 3.11.174 was gone
from the tree. Here 3.11.174 is still shipped, so the exception remains correct.
`npm run check:audit` passes with 1 accepted exception across 153 reachable
packages (up from 140 — pdfjs 6's tree).

### Test results

| Suite                                                                       | Tests                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `features/pdf/engine/*` (options, worker, manager, page cache, renderer)    | 59                                                         |
| `architecture/pdfjs-dual-runtime.test.ts`                                   | 20                                                         |
| `architecture/pdfjs-engine-worker-coupling.test.ts` (legacy half, rescoped) | 6                                                          |
| **Full suite**                                                              | **346 files, 3728 passed, 2 pre-existing skips, 0 failed** |

`npm run build:renderer:electron` passes and emits both the legacy
`pdf.worker.min-<hash>.js` (1 087 kB) and the staged `dist/pdfjs/` tree. All 502
Phase 2 PDF regression tests still pass, which is the real evidence that the
shipped viewer is untouched.

### Phase 3B exit plan

The dual runtime is scaffolding. When native viewer feature parity is complete
(Phase 8), remove it in this order:

1. delete `@react-pdf-viewer/{core,page-navigation,search,zoom}`
2. delete `PdfWorkerHost` and the legacy `pdf.worker.min.js?url` import
3. delete `vendor-pdf-legacy` from `vite.config.mts` and rename
   `vendor-pdf-native` back to `vendor-pdf`
4. delete `pdfjs-dist@3.11.174` and its `overrides` entry
5. delete the `pdfjs-6` alias; make `pdfjs-dist` the direct `6.4.299` pin
6. rewrite the engine's imports from `pdfjs-6` → `pdfjs-dist`
7. delete `pdfjs-dual-runtime.test.ts` and rescope or delete
   `pdfjs-engine-worker-coupling.test.ts` (its peer-range rows become meaningless)
8. delete the `CVE-2024-4367` exception from `security/audit-exceptions.json`
   (it goes stale the moment 3.11.174 leaves the tree) and drop the
   `isEvalSupported: false` call sites, which stop type-checking on 6.x
9. revisit the `wasm`/`icc`/`cmap`/font asset staging — after step 5 the package
   is read from `node_modules/pdfjs-dist` instead of `node_modules/pdfjs-6`

Steps 5 and 6 are the only ones that touch engine source; everything else is
deletion.

---

## Phase 4 — native canvas viewer + page/scale state

**The first UI consumer of the native engine, behind a build-time flag.** The
legacy `@react-pdf-viewer` path is unchanged and remains the default; the native
path is opt-in and deliberately incomplete.

### The flag

`VITE_NATIVE_PDF_VIEWER`, read in `features/pdf/native/nativePdfViewerFlag.ts`.
Only the exact string `true` opts in — `false`, `0`, `1`, `yes`, `TRUE` (with or
without whitespace) and an absent variable all resolve to the legacy viewer.
`import.meta.env` is read _inside_ the function, not captured at module load, so
the same code path serves dev, a production build and the packaged app and the
switch stays testable without a build.

The read happens exactly once, in `PdfViewerDocument`, at the highest level that
owns both renderers. Nothing below re-reads it, so the two paths cannot disagree
about which one is live.

### The native boundary

```
PdfViewerDocument
   ├─ flag off (default) ──► PdfViewerElement ──► @react-pdf-viewer <Viewer> ──► pdfjs-dist@3.11.174
   └─ flag on            ──► NativePdfViewer  ──► @features/pdf/engine        ──► pdfjs-6 (6.4.299)
```

Every production file that imports `@features/pdf/engine` lives in
`features/pdf/native/` plus one presentational component,
`features/pdf/ui/components/NativePdfViewer.tsx`. That is asserted by
`src/__tests__/architecture/pdfjs-dual-runtime.test.ts`, which also asserts the
inverse — no `@react-pdf-viewer` **import specifier** and no `rpv-*` string in
that boundary. (Comments in the boundary legitimately name the package they are
deliberately not using, so the check matches imports, not prose.)

| File                         | Responsibility                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `nativePdfViewerFlag.ts`     | the opt-in, and its parsing rule                                                       |
| `nativePdfBounds.ts`         | `clampPdfPage` (1-based) and `clampPdfScale`, on the shared `PDF_ZOOM_*` constants     |
| `useNativeCoalescedScale.ts` | the one-zoom-per-frame channel, numeric only                                           |
| `useNativePdfEngine.ts`      | **ownership**: one `createPdfDocumentManager()` + one `createPageRenderer()` per mount |
| `useNativePdfDocument.ts`    | `(pdfUrl, reloadKey)` → `ready` + `numPages` + first-page size                         |
| `useNativePdfPageState.ts`   | 1-based `currentPage`, clamped; progress emitted through the existing callback         |
| `useNativePdfScaleState.ts`  | numeric `scale`, clamped, fit applied once per document identity                       |
| `useNativePdfRender.ts`      | one page → one canvas, supersede-cancel, cancellation is not an error                  |
| `useNativePdfController.ts`  | the composition, and the toolbar contract                                              |
| `nativeZoomControls.tsx`     | render-prop zoom components for the shared toolbar                                     |

### Ownership

The engine instances are created in an **effect**, not during render, and
destroyed in that effect's cleanup: `renderer.cancel()` first (so an in-flight
render stops while its page proxy is still usable), then `manager.destroy()`,
which is the single owner of `PDFLoadingTask` teardown in PDF.js 6. Creating them
per render would abandon a loading task or a canvas-locked `RenderTask` without
cancelling it — the leak that produces "multiple render() operations".

The instances are read through a stable `NativePdfEngineHandle` accessor rather
than carried as render values: they only exist after the enabling effect has run,
and a possibly-`null` object in render position would restart every downstream
effect on each `null → instance` transition.

Effect order inside the controller is load-bearing exactly once and is commented
where it matters: the engine-creating effect is declared before the document
loading effect, so the engine exists by the time the document hook runs its body.

### Document identity and stale work

Document identity is `(pdfUrl, reloadKey)` — the same pair the legacy `<Viewer
key={...}>` uses to decide it must remount. Reload of the same file is a new
identity: the URL is unchanged but the user asked for a fresh document.

Two independent guards cover two different windows:

1. the engine's generation counter makes a superseded `load()` resolve to `null`
   and destroys the abandoned task
2. the UI's per-effect `cancelled` flag drops anything that settles after the
   identity changed or the viewer went away — including the `getPage(1)` that
   measures the page, which is a separate await

Both are tested against the _real_ engine with only `pdfjs-6` faked
(`getDocument` plus a `RenderTask.cancel()` that really rejects with the typed
`RenderingCancelledException`). A test that mocked the engine would have proved
only that the viewer calls its collaborators.

### Page and scale state

Page indexing is **1-based** throughout, matching PDF.js `getPage`. The only
0-based value in the system is RPV's `onPageChange`, which the legacy navigation
hook converts; the native path has no such callback and therefore never has a
0-based number to reconcile.

`clampPdfPage(page, totalPages)` lower-bounds to `1` always, and upper-bounds
only once `totalPages` is known. Forcing `1` while the count is unknown would
fight the resume flow, which legitimately restores a saved page before the new
document's `numPages` arrives. `initialPage` is consumed once per document
identity, not per prop change — it mirrors persisted reading progress and
therefore changes on every page turn.

`SpecialZoomLevel.PageWidth` is **normalised to a real number** on the native
path: there is no numeric scale that means "fit the page" to PDF.js, so the fit is
computed from the shared `useFitScale` (1 %-granularity quantization included)
and applied as an ordinary scale. `SpecialZoomLevel` never enters the native
engine or its hooks.

The initial fit is keyed on document identity in a ref, not as a plain effect
dependency. That is what prevents `fit → render → resize → new fitScale → fit`:
the container size is an _input_ to `fitScale`, and applying the fit changes the
canvas size, which the container observer reports. Container resizes are a
separate lifecycle (`usePdfResizeRefit`), which is the path that is meant to
refit. `PDF_RESIZE_REFIT_DEBOUNCE_MS` (150 ms) is reused unchanged.

Every native zoom source — toolbar buttons, Ctrl+wheel, resize refit, the initial
fit — goes through one rAF-coalesced channel with latest-wins semantics, and every
value is clamped by `clampPdfScale` against the shared `PDF_ZOOM_MIN_SCALE` /
`PDF_ZOOM_MAX_SCALE`. Because the clamped result feeds `setState` directly, a
saturated zoom step returns the current value and React bails out of the render.

### Why `useCoalescedZoom` was not reused

`features/pdf/viewport/useCoalescedZoom.ts` types its channel as
`(scale: number | SpecialZoomLevel) => void` because it feeds RPV's `zoomTo`. The
native path has no such value domain, and widening the shared hook would put an
`@react-pdf-viewer` type into the native path and change a Phase 2-pinned file for
no gain. `useNativeCoalescedScale` is a separate numeric hook with the same shape
and rationale. Phase 2's `useCoalescedZoom` tests are untouched.

### Two small changes to shared zoom hooks

Both are type-level; no behaviour changed, and both Phase 2 suites pass unchanged
apart from the added cases.

| Hook                  | Change                                                                                      | Why                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `usePdfCtrlWheelZoom` | `ZoomTo` narrowed to `(scale: number) => void`                                              | the hook only ever computes numbers; the legacy caller is still assignable by contravariance               |
| `usePdfResizeRefit`   | additive optional 7th parameter `fallbackScale`, defaulting to `SpecialZoomLevel.PageWidth` | lets the numeric-only native caller supply its own fallback while every legacy call site keeps its keyword |

The native controller passes `refitZoomTo = (value: unknown) => typeof value === 'number' ? zoomTo(value) : undefined`
to `usePdfResizeRefit`. Taking the parameter as `unknown` rather than importing
`SpecialZoomLevel` keeps `@react-pdf-viewer` out of the native boundary while the
shared debounce / cooldown / navigation-lock rules run verbatim; the guard is
defensive rather than lossy, because the native caller always passes a number.

`useFitScale`, `useContainerSize`, `useLastNavigationTime`,
`usePdfWheelNavigation` and `usePdfCtrlWheelZoom` are used as-is. The fit inset
is not re-derived: `usePdfViewerState` now also returns `adjustedContainerSize`,
so the native path feeds the _same_ number into the _same_ `useFitScale`. A
single ResizeObserver still watches the single shared container.

### Rendering and cancellation

One `<canvas>` in the DOM at a time, holding the current page, inside the same
`containerRef` the legacy viewer uses. `ViewMode.SinglePage` parity means no page
stack, no prefetch, no second canvas. Canvas sizing is left entirely to
`createPageRenderer`, which derives width/height from the page's own viewport at
the effective scale (rotation included).

The render effect depends on `(document, page, scale)`; any change — or unmount —
runs its cleanup, `renderer.cancel()`. The engine renderer also cancels before it
starts, covering a re-entry the effect cannot see. A cancelled render rejects
with `RenderingCancelledException`, recognised by identity through the engine's
`isRenderCancelled`, and is dropped without touching state: no user-facing error
and no console noise. A genuine failure is _not_ swallowed; it becomes
`renderError` and the viewer shows the fallback.

One deliberate cost: because the fit commits on the next animation frame, the
first render of a document happens at the placeholder scale `1` and is superseded
a frame later. In practice it is cancelled mid-flight, so the user never sees it.
Avoiding it entirely would require the render effect to read a mutable
"fit pending" flag set by an earlier hook in the same commit — a fragile
cross-hook ordering dependency for a few ms of work.

**DPR is unchanged.** The engine sets `canvas.width/height` from the viewport, so
the canvas is 1 CSS pixel per device pixel on a HiDPI display. That is a
deliberate Phase 4 decision: DPR support belongs with the capture pipeline's
high-DPI work and needs its own proof, not a quiet change to the renderer.

### Toolbar

No toolbar rewrite. `PdfToolbar` already takes its zoom controls as render-prop
components (`ZoomComponent` / `CurrentScaleComponent`); native state has no
plugin but the shape is the same, so `nativeZoomControls.tsx` supplies it and the
toolbar's three buttons, percentage readout and tooltips are reused untouched.
`PdfViewerDocument` binds the native controller's `currentPage`, `totalPages`,
previous/next/jump and the three zoom components when the flag is on.

`useNativeZoomControls` rebuilds the three components when the scale changes.
`PdfToolbar` and `PdfZoomControls` are both memoised, and their props are
otherwise referentially stable, so without that rebuild the percentage readout
would keep showing the pre-zoom value while the canvas was already at the new
scale. The zoom _handlers_ are stable, so a scale change recreates nothing inside
the buttons.

**Bounded, not silently broken.** `PdfToolbar` gained one optional
`nativeCanvasMode` prop. When it is set:

- the search bar is not rendered (search has no native implementation)
- the AI quick-bar actions that need the page text layer or the capture registry
  are `disabled` with a tooltip saying why
- **reload stays enabled** — it drives a real native document lifecycle

### Deliberately not migrated

TextLayer, AnnotationLayer, links, `PDFFindController`, search highlights, text
selection and extraction, the capture pipeline, `activePdfDocumentRegistry`, the
context menu, `usePdfViewerZoomIpc` (its reset target hard-codes
`SpecialZoomLevel.PageWidth`), the reading-progress persistence architecture, and
all CSS. The native path emits progress through the _existing_
`onReadingProgressChange` callback with the legacy shape, so the persistence
pipeline keeps working without being touched.

### Verification

| Suite                                                              | Tests                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `features/pdf/native/*` (flag, bounds, coalescing, zoom controls)  | 28                                                         |
| `NativePdfViewer.test.tsx` (lifecycle, page, scale, render, races) | 29                                                         |
| `viewerFeatureFlagBoundary.test.tsx`                               | 5                                                          |
| `PdfToolbar.test.tsx` + `usePdfResizeRefit.test.tsx` (new cases)   | 6                                                          |
| `architecture/pdfjs-dual-runtime.test.ts` (new boundary block)     | 6                                                          |
| **Full suite**                                                     | **352 files, 3799 passed, 2 pre-existing skips, 0 failed** |

Build: `npm run build:renderer:electron` now emits **both** workers in the normal
app build — the check that could not be made in Phase 3B:

| Artifact                             | Size     |
| ------------------------------------ | -------- |
| `pdf.worker.min-<hash>.js` (legacy)  | 1 062 kB |
| `pdf.worker.min-<hash>.mjs` (native) | 1 235 kB |
| `vendor-pdf-legacy-<hash>.js`        | 459 kB   |
| `vendor-pdf-native-<hash>.js`        | 437 kB   |

Each chunk contains only its own runtime's version string (`3.11.174` /
`6.4.299`) and references only its own worker asset, so the native import did not
silently resolve to the legacy PDF.js. The `dist/pdfjs/` tree is unchanged: 200
files (cmaps 169, standard_fonts 16, wasm 13, iccs 2).

**Manual smoke: resolved by user manual validation.** The Phase 4 agent had no
interactive environment, so this item was carried as outstanding. The user has
since manually exercised the Phase 4 native viewer in the real application and
reported **no visible issue**. That is the whole of the claim — it is not
evidence about anything Phase 4 could not exercise itself.

## Phase 5 — native text layer + selection

**QuizLab's selection behaviour moved onto PDF.js's renderer.** Nothing in the
selection system was rewritten: `usePdfTextActions` is untouched, and what changed
is that the DOM it reads is now ours. The exit criterion was the Phase 2 selection
suite passing **unchanged**, and it does — `usePdfTextActions.test.tsx`,
`extractSelectedText.test.ts` and `extractPageTextFromDom.extended.test.ts` are
byte-identical to their Phase 2 form.

### The API that actually exists in 6.x

Verified against `node_modules/pdfjs-6` (`pdfjs-dist@6.4.299`) — `types/src/display/text_layer.d.ts`
plus the implementation in `build/pdf.mjs`:

```js
new TextLayer({ textContentSource, container, viewport })
TextLayer#render(): Promise<void>   // resolves when the stream is drained
TextLayer#cancel(): void            // rejects render() with AbortException
TextLayer#update({ viewport, onBefore? }): void
TextLayer#textDivs / #textContentItemsStr   // output, initially []
```

`renderTextLayer(...)` — the pre-4.x function RPV still calls, and the reason
Phase 3 was blocked — **does not exist**. `pdfjs-6` does not export the
`TextContent` type either, only the class, so the hook derives the type from
`Awaited<ReturnType<PDFPageProxy['getTextContent']>>` rather than hand-writing a
mirror of it. `container` must be an `HTMLElement`, which is the whole reason the
layer lives in the viewer boundary and not in `engine/`.

`update()` exists and is deliberately **unused**. It relayouts the existing runs
for a new scale instead of rebuilding them, which is the cheaper zoom — but it is
a second code path whose correctness across the same three races would need its
own proof, and this phase is about parity. Recorded here as the obvious next
optimisation, not as an omission.

### Ownership

| File                                | Responsibility                                                              |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `native/nativePdfDom.ts`            | the native markup contract: page / canvas / text-layer / text-run selectors |
| `native/nativePdfTextLayer.css`     | PDF.js's text-layer layout contract, scoped to `data-native-pdf-*`          |
| `native/useNativePdfTextLayer.ts`   | one page → one `TextLayer`, supersede-cancel, page-level text cache         |
| `text/pdfTextLayerSource.ts`        | resolves _either_ renderer's text layer, and how to read its runs           |
| `ui/components/NativePdfViewer.tsx` | the page box that gives canvas and layer a shared viewport                  |

`usePdfTextActions` is deliberately **not** wired into the native controller at
all. It is already mounted by `usePdfViewerState` against the shared viewer
container, it is markup-agnostic, and both extractors now resolve whichever layer
is mounted. That is the structural reason there is no second selection system.

### DOM structure

```
.pdf-canvas-container                      scroll + GPU containment (QuizLab class)
└── [data-native-pdf-page="4"]             position: relative; --total-scale-factor
    ├── canvas[data-native-pdf-canvas]     the glyphs
    └── [data-native-pdf-text-layer]       PDF.js's TextLayer container
        └── span[role="presentation"] × N  one run per PDF.js text item
```

The page box exists because both sides of the pair are sized from the same
viewport: the canvas by `pageRenderer`, the layer by `--total-scale-factor × <page
size in points>` plus PDF.js's own `setLayerDimensions`. Siblings inside one box
is what makes the two agree at every scale and every rotation. Page identity
moved from the canvas to the page box in this phase, so "the page element" is
never ambiguous to a `querySelector`; the canvas and the layer are addressed by
their own attributes, and the layer additionally carries
`data-native-pdf-text-page` so "the text of page N" is one attribute selector and
so a race has a testable outcome.

**No RPV class is faked.** Every selector is `data-native-pdf-*`. The legacy
`rpv-core__*` vocabulary stays in `lib/pdfViewerDom.ts` and nothing crosses.

### `role="presentation"` is the text-run selector

PDF.js 6 emits one `<span role="presentation">` per text item, but for a tagged PDF
it also nests those inside `span.markedContent` wrappers while walking the
structure tree. `collectTextItems` reads each match's own `textContent` and
`getBoundingClientRect()`, so a blanket `span` query would count every word twice —
once on its run, once on the union rect of a wrapper. `role="presentation"` is set
on the runs and the `<br>`s and **not** on the wrappers, so it selects exactly the
leaves. That is what makes the native layer readable by the same
geometry-based collector the legacy path uses. (With the default
`includeMarkedContent: false` the wrappers do not appear at all today; the
selector is correct for both settings rather than correct for one.)

### The extractors

`text/pdfTextLayerSource.ts` is the new resolution point. It tries the native
markup first, then the legacy markup, and returns the layer **plus the span
selector that renderer's runs use**. Both extractors go through it, so neither
grows a branch, and the reading order, normalization, `textContent`/`innerText`
fast path and the `>5` length thresholds are shared unchanged.

Selection scope gained one native-only rule. The container-level containment
check already rejected the toolbar and the AI panel; what it could not reject is a
selection _inside_ the panel that did not come from the page text — the canvas, or
the page box. On the native path the layer is addressable, so a selection is only
PDF text when its common ancestor or an endpoint is inside it. **On the legacy
path the check is skipped entirely** (no native layer mounted ⇒ no new way to fail
a selection that used to work), which is what keeps the Phase 2 suite green
without editing it.

The page-layer cache still caches only the page box, never the layer: the layer is
replaced on every zoom and every re-render, so caching it would hand back a layer
belonging to a previous scale.

### Lifecycle, races, caching

One effect, depending on `(enabled, engine, status, container, documentKey,
currentPage, scale)`. Any change or unmount empties the container **before the
first await** and calls `TextLayer#cancel()` on the live instance — the flag alone
would not stop PDF.js appending the rest of the stream into a container that is
about to be reused. Every await is followed by a `cancelled` check, so a late
`getTextContent()` cannot construct a layer over the new page's container and
cannot publish state either. A cancelled layer rejects with `AbortException`,
recognised by name and dropped; a genuine failure becomes `textLayerError`.

`textLayerError` is on the controller but deliberately **not** rendered as the
error shell: a text-layer failure means the page is readable but not selectable,
and hiding a working reader to report a degraded one would be the wrong trade.

One `getTextContent()` per page, per document. The resolved promise is cached for
the current page and cleared when the document identity — `(pdfUrl, reloadKey)`,
the same pair the document hook uses — changes. It caches the _promise_ and writes
only when a lookup starts, so a slow page cannot overwrite a newer entry by
resolving late, and a rejected lookup is dropped rather than cached. Nothing is
cached globally and nothing survives a document change.

### CSS — the one place shared styles were not used

`src/shared/styles/**` is **untouched**. PDF.js writes geometry as CSS custom
properties and expects a stylesheet to turn them into a font size and a transform;
without it the spans render at inherited size, pile up at the top-left, and a
selection highlights the wrong box. So the contract is real, not decorative.

It ships as `native/nativePdfTextLayer.css`, a component-local stylesheet imported
beside the element it styles (which needed one additive declaration,
`declare module '*.css'` in `src/types/assets.d.ts`). It is transcribed from
PDF.js 6's own `web/pdf_viewer.css` reduced to what a read-only text layer needs,
and every rule is keyed on `data-native-pdf-page` / `data-native-pdf-text-layer` /
`.pdf-viewer-container.pdf-*` — attributes only the native viewer emits. No global
leakage, no `rpv-*` reuse, no visual redesign. Three rules are QuizLab's own
rather than PDF.js's, and each preserves existing product behaviour:
`::selection` uses the existing `--selection-color-vivid` token so a highlight
looks identical on both renderers; the pan-mode rule drops `user-select` exactly
as `_pdf-viewer.css` does for the legacy layer; and `pdf-selection-active` gets the
same drop-shadow the legacy rule has, _without_ the `transition` on `filter` — the
legacy stylesheet documents removing that transition for the same reason (it
re-rasterizes the whole layer on every text-layer update).

### AI text actions

"Add current page text to AI" is enabled on the native path and the explanatory
tooltip is gone from it: it reads the page text layer, which now exists. The
`textLayerActionsDisabled` prop became `captureActionsDisabled` and now covers
only the two actions that genuinely have no native implementation — page-as-image
and the crop screenshot, both of which need `renderPageToImage` and
`activePdfDocumentRegistry`. Search stays hidden. Reload was already live and
stays live. The tooltip key changed from `pdf_text_layer_unavailable` (which is
now false) to `pdf_capture_unavailable`; it has no locale entry in either
directory and never did, so nothing was translated away.

The selection flow needs no UI change at all: `onTextSelection` →
`useTextSelection` → `queueTextForAi(text, position)` is the existing app wiring,
and it starts receiving native text as soon as the layer is selectable.

### Deliberately still not migrated

AnnotationLayer, `LinkService`, form widgets, `PDFFindController`, search
highlights, the capture pipeline, `activePdfDocumentRegistry`, the context menu,
selection screenshots, and `usePdfViewerZoomIpc` (its reset target hard-codes
`SpecialZoomLevel.PageWidth`). The `>12 MP` threshold is a capture/serialization
concern and was left exactly where it was.

### Verification

| Suite                                                                        | Tests                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `useNativePdfTextLayer.test.tsx` (mount, shape, viewport, supersede, races)  | 14                                                         |
| `nativeTextSelection.test.tsx` (scope, lifecycle, enablement, order, legacy) | 15                                                         |
| `nativePageText.test.tsx` (content, normalization, scheduling)               | 11                                                         |
| `nativeAiTextActions.test.tsx` (`queueTextForAi` on both paths, legacy)      | 8                                                          |
| `NativePdfViewer.test.tsx` (extended: `getTextContent`, page-box identity)   | 29                                                         |
| `PdfToolbar.test.tsx` (native capability split)                              | 1 updated                                                  |
| `architecture/pdfjs-dual-runtime.test.ts` (text-layer boundary blocks)       | +5                                                         |
| **Full suite**                                                               | **356 files, 3851 passed, 2 pre-existing skips, 0 failed** |

Static gates green: `typecheck`, `lint`, `format:check`, `analyze:architecture`,
`analyze:file-sizes`, `analyze:css`, `ci:check-hygiene`, `check:audit`,
`check:electron-security`, `git diff --check`. `check:audit` still reports exactly
one documented exception (the unchanged `CVE-2024-4367`); `enableScripting: false`
and `isEvalSupported: false` are untouched on their respective runtimes.

Build: `npm run build:renderer:electron` emits **both** workers
(`pdf.worker.min-<hash>.js` 1 062 kB legacy, `pdf.worker.min-<hash>.mjs` 1 235 kB
native), `vendor-pdf-legacy` 459 kB, `vendor-pdf-native` 437 kB, the full
200-file `dist/pdfjs/` tree, and now a third stylesheet chunk
`viewer-<hash>.css` (1 kB) carrying only the native text-layer rules.
`VITE_NATIVE_PDF_VIEWER=true npm run build:renderer:electron` produces the same
artifact set.

### Interactive smoke — outstanding

This environment has no interactive session, so the Phase 5 smoke list could not
be run here: native selection alignment against the painted canvas at several
scales, `Ctrl+C` copy out of the native layer, pan ⇄ text switching, a
multi-document switch, and a large text-dense page for a UI-lock regression. The
automated coverage above is a _proxy_ for that, not a substitute: jsdom has no
layout, so the geometry assertions there are about contract and lifecycle, never
about whether a highlight lands on the right glyph. Those checks are the first
thing a human should run.

## Phase 6 — native annotation layer + links

**The page gained its third layer, and links became real navigation.** PDF.js 6's
own `AnnotationLayer` now renders link annotations (and whatever else the document
carries, display-only) over the canvas and the text layer, and an internal
destination moves QuizLab's own 1-based `currentPage` through the same
`jumpToPage` the toolbar's page box calls. Nothing in the text layer, the
extractors or `usePdfTextActions` changed: the selection suite still passes
byte-identical, which was the exit criterion.

### The API that actually exists in 6.x

Verified against `node_modules/pdfjs-6` (`pdfjs-dist@6.4.299`) —
`types/src/display/annotation_layer.d.ts`, `types/web/pdf_link_service.d.ts` and the
implementation in `build/pdf.mjs`:

```js
new AnnotationLayer({ div, page, viewport, linkService })   // managers optional at runtime
AnnotationLayer#render({ annotations, renderForms, enableScripting, hasJSActions })
AnnotationLayer#update({ viewport })
AnnotationLayer#destroy()
```

Three facts drove the design, and all three were read off the installed source
rather than from documentation:

1. **`AnnotationLayer` has no `cancel()`.** `TextLayer` streams into a container and
   has to be stopped mid-stream; `AnnotationLayer.render()` builds every element
   synchronously and awaits only the aria pass (`this.#structTreeLayer?.getAriaAttributes`,
   empty when no struct tree is passed). So the supersede mechanism is the `cancelled`
   flag plus `destroy()` — _not_ the text layer's shape copied across. Copying it
   would have been a `layer?.cancel()` on `undefined`.
2. **The render is synchronous up to an empty await.** The element loop and
   `#addElementsToDOM`'s `this.div.append(fragment)` both run before `render()`
   returns its promise. That is what makes "check `cancelled` _before_ every
   DOM-touching call, never after" sound: a post-await clear from a stale run would
   erase the page currently on screen, because the layer `div` outlives the effect.
3. **`PDFLinkService` is not exported from `pdfjs-6`'s entry point.** `pdf.d.ts`
   exports `AnnotationLayer`, `AnnotationMode` and `AnnotationType`; `PDFLinkService`
   lives in `types/web/pdf_link_service.d.ts`, reachable only through
   `pdfjs-6/web/pdf_viewer.mjs`.

Also confirmed: `AnnotationType.LINK === 2`, and `AnnotationLayer` is _not_ exported
from the legacy `pdfjs-dist@3.11.174`, which is a second reason the two runtimes
cannot share this layer.

### Why the link service is QuizLab's adapter, not PDF.js's

`PDFLinkService` exists and would have been the obvious choice. Three properties of
the installed implementation ruled it out:

| problem                                  | evidence in `web/pdf_viewer.mjs`                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **it is the whole viewer**               | that module bundles page views, history, find controller, scripting manager, sidebar, thumbnails and l10n — none of which this single-page viewer can use                                             |
| **it needs a `PDFViewer`**               | `goToDestination` ends in `this.pdfViewer.scrollPageIntoView(...)`, and even `get pagesCount()` is `this.pdfViewer.pagesCount`                                                                        |
| **its external links are the browser's** | `addLinkAttributes` assigns a real `href` and a `target` with no click interception, so the outcome depends on `electron/app/window/security.ts`, whose `ALLOWED_EXTERNAL_PROTOCOLS` is `https:` only |

So `nativePdfLinkService.ts` implements the **surface `AnnotationLayer` actually
calls**, read off `build/pdf.mjs` rather than off the type declarations:

| member                 | called from                                             |
| ---------------------- | ------------------------------------------------------- |
| `externalLinkEnabled`  | `addLinkAttributes`                                     |
| `addLinkAttributes`    | `LinkAnnotationElement#render`, the `data.url` branch   |
| `getDestinationHash`   | `_bindLink`, the `data.dest` branch                     |
| `goToDestination`      | `_bindLink`'s `onclick`                                 |
| `getAnchorUrl`         | `_bindNamedAction` / attachment / OCG / JS bindings     |
| `executeNamedAction`   | `_bindNamedAction`                                      |
| `getAttachmentContent` | `#bindAttachment`                                       |
| `executeSetOCGState`   | `#bindSetOCGState`                                      |
| `eventBus` (optional)  | JS-action and widget bindings — absent, and unreachable |

`downloadManager` is never passed, so the attachment path ends in a no-op.

**The link service has one lifetime, and it is the layer's.** A click can only come
from an anchor a live layer rendered, so `createNativePdfLinkService` is called
inside the annotation-layer effect and disposed in that effect's cleanup. That is
what makes a named destination that resolves _after_ a page change, a zoom, a
reload, a document switch or an unmount inert rather than a surprise navigation —
and it is a disposal, not a second state machine.

### Destination resolution, and the one place an off-by-one could hide

`resolveDestinationPage` is a faithful port of the first half of
`PDFLinkService.goToDestination`:

```
string destination ──→ PDFDocumentProxy.getDestination(name)
explicit destination ──→ itself
        │
        ├─ first element is an object (an indirect page ref)
        │     ├─ cachedPageNumber(ref)          → already 1-based
        │     └─ getPageIndex(ref) + 1          → getPageIndex is 0-based
        └─ first element is an integer (a literal page index)
              └─ index + 1                      → the PDF index is 0-based
```

Both branches convert exactly once, and `+ 1` appears nowhere else. Out of range,
negative, unresolvable, non-array and unknown-name destinations all resolve to
"do nothing" — the reader is never moved to page 1 as a fallback. `goToDestination`
never rejects, which matters because `#bindAttachment` awaits `getAttachmentContent`
fire-and-forget and `_bindLink`'s `onclick` returns `false` synchronously.

QuizLab's page state is 1-based; only RPV's `onPageChange` was ever 0-based. A
destination of index `6` on a 12-page document is QuizLab's page **7**, and there
are explicit tests for index 0, the middle, the last index, and both ref branches.

Named actions (`NextPage`, `PrevPage`, `FirstPage`, `LastPage`, `GoBack`,
`GoForward`) are **deliberately inert**. They are not destinations, the legacy
viewer drives its own navigation plugins, and half-implementing them would have
been a guess. Recorded as deferred work.

### External links reuse the app's existing pathway

The repository already had exactly one approved external-link route from the
renderer: `window.electronAPI.openExternal(url)` → IPC `open-external` →
`resolveExternalLink` in the main process → `shell.openExternal`. It is what
`UpdateBanner`, `useSettings` and the Gemini session cards call. Phase 6 reuses it
rather than adding a second one, and adds **no** `window.open`, no `location.href`
and no new Electron handler — asserted by the architecture test.

Two checks run at the renderer boundary, both about _"may this become an actionable
`href` in the document?"_:

- **protocol** — `parseUrlWithAllowedProtocols(url, ['https:', 'mailto:'])`, i.e. the
  same set as `resolveExternalLink`'s `ALLOWED_PROTOCOLS`. `http:` is _not_ included,
  because the shipped main process refuses it and matching it keeps the renderer from
  promising something the main process would reject. `mailto:` **is** included,
  because the app's own external-link policy supports it and the window-level
  interception could never open one.
- **credentials** — a URL carrying `user:pass@` is refused, as in the main process.

The rest of `resolveExternalLink` (the loopback / IPv4-literal / TLD-less host rules)
deliberately stays in the main process. Duplicating it in the renderer would create a
second policy that could drift from the first, which is the exact failure mode the
single-main-process design exists to prevent; a URL that passes the renderer and
fails the main process is simply not opened.

A refused URL gets **no `href` at all** plus `aria-disabled="true"`, and its click is
intercepted. That is what makes `javascript:` non-executable rather than merely
unfollowed: there is nothing left in the DOM for any activation path to act on. The
runtime invariant is unchanged — `enableScripting: false` at the document level _and_
on the annotation layer, plus `hasJSActions: false`, which together stop
`LinkAnnotationElement#_bindJSAction` from ever being reached.

An allowed link keeps PDF.js's anchor contract: `href` and `title` set to the
validated URL, `target` empty unless the document asked for a new window, and
`rel = "noopener noreferrer nofollow"` (PDF.js's own `DEFAULT_LINK_REL`). An internal
link keeps a non-empty app-local fragment href, which is what makes the anchor
Tab-focusable; `Enter` on it dispatches a click, so keyboard and mouse share the one
navigation path. PDF.js's `onclick → return false` is what cancels the fragment
navigation, and the external interceptor adds an explicit `preventDefault()` plus
`stopPropagation()`.

### Ownership

| File                                    | Responsibility                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `native/nativePdfDom.ts`                | the native markup contract, extended with the annotation layer + link selectors |
| `native/nativePdfAnnotationLayer.css`   | PDF.js's `.annotationLayer` layout rules, scoped to `data-native-pdf-*`         |
| `native/nativePdfLinkService.ts`        | PDF.js's link-service surface over the native page state and `openExternal`     |
| `native/useNativePdfAnnotationLayer.ts` | one page → one PDF.js `AnnotationLayer`, supersede-destroy, display intent      |
| `ui/components/NativePdfViewer.tsx`     | the page box that gives all three layers a shared viewport                      |
| `ui/components/PdfViewerDocument.tsx`   | the third ref, alongside `canvasRef` and `textLayerRef`                         |

### DOM structure

```
.pdf-canvas-container                      scroll + GPU containment (QuizLab class)
└── [data-native-pdf-page="4"]             position: relative; --total-scale-factor
    ├── canvas[data-native-pdf-canvas]     the glyphs
    ├── [data-native-pdf-text-layer]       PDF.js's TextLayer container
    └── [data-native-pdf-annotation-layer] PDF.js's AnnotationLayer container
        └── section[data-annotation-id]    one per annotation
            └── a                          the link anchor, wired to the link service
```

That order is PDF.js's, not ours. `LAYERS_ORDER` in `web/pdf_viewer.mjs` numbers a
page's layers `canvasWrapper` 0, `textLayer` 1, `annotationLayer` 2,
`annotationEditorLayer` 3, and `PDFPageView#addLayer` inserts them in exactly that
sequence. The annotation layer therefore sits **above** the text layer, which is what
makes a link clickable; and because the layer is `pointer-events: none` with
`section { pointer-events: auto }`, everywhere it has no section the pointer falls
through to the text layer and selection keeps working. `--total-scale-factor` is still
set once, inline, on the shared page box, so a link's hitbox, a text run's box and the
canvas are all sized from the same number.

### CSS

`native/nativePdfAnnotationLayer.css` is transcribed from PDF.js 6's own
`web/pdf_viewer.css` (`.annotationLayer`), reduced to what a display-only annotation
layer needs. Dropped: the AcroForm widget chrome, the comment-button rules, the
annotation _editor_ layer, and the free-text/highlight editor styles — none of those
features are migrated. Every rule hangs off `[data-native-pdf-annotation-layer]`; no
`rpv-*` name, and `pdf_viewer.css` was not imported wholesale (its global
`.linkAnnotation` / `section` / `input` rules would restyle the legacy viewer's markup
in the same document). `src/shared/styles/**` stays untouched, and the stylesheet
ships in the same `viewer-<hash>.css` chunk as the text layer's, which grew from ~1 kB
to 2.77 kB.

Two QuizLab additions, both declared as such in the file: `cursor: pointer` on a link
anchor (not every engine gives an anchor with an `href` a pointer cursor, and a link
is otherwise indistinguishable from a selection box until hovered) and the
`aria-disabled` cursor. `overflow-wrap` replaces PDF.js's deprecated `word-wrap`
because `analyze:css` rejects the old spelling.

### Forms and scripting

`renderForms: false` is the honest Phase 6 position on AcroForm. A widget with a
baked-in appearance is _not_ re-created as an input, so the canvas keeps showing what
the form looked like when the file was authored and it cannot be edited. Form state,
focus, `annotationStorage` writes, form persistence and saving remain out of scope —
that is Phase 7+ work if it is ever wanted, and nothing in Phase 6 pretends otherwise.

Non-link annotations that PDF.js renders for display — text notes, highlights,
stamps, ink, popups — come through with the library's own behaviour. Highlight and
underline geometry is painted on the canvas by the page renderer; the layer's element
is what the user can click. No annotation editing, no comment manager, no
accessibility manager.

### Deliberately still not migrated

Search and search highlights, `PDFFindController`, the capture pipeline,
`activePdfDocumentRegistry`, the context menu, selection screenshots, named actions,
`executeSetOCGState`, embedded-file attachments, `usePdfViewerZoomIpc`, and zoom
changes implied by a destination (the legacy path ignores those too). RPV, pdfjs 3.x
and the `pdfjs-6` alias are all still in the tree.

### Verification

| Suite                                                                                | Tests                                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `useNativePdfAnnotationLayer.test.tsx` (mount, viewport, supersede, races, clicks)   | 29                                                         |
| `nativePdfLinkService.test.ts` (destinations, broken targets, external, stale)       | 40                                                         |
| `NativePdfViewer.test.tsx` (layer order, scale factor, degraded layer)               | +3                                                         |
| `viewerFeatureFlagBoundary.test.tsx` (three distinct refs)                           | +1                                                         |
| `architecture/pdfjs-dual-runtime.test.ts` (annotation boundary, CSS scope, security) | +4                                                         |
| **Full suite**                                                                       | **358 files, 3928 passed, 2 pre-existing skips, 0 failed** |

The three Phase 2 selection files are still byte-identical, and the new tests were
mutation-checked: dropping the `+ 1` from the page-index conversion fails four
destination tests and three link-click tests; dropping the `cancelled` guard after
`getAnnotations()` fails the page-switch, document-switch and unmount races.

Static gates green: `typecheck`, `lint`, `format:check`, `analyze:architecture`,
`analyze:file-sizes`, `analyze:css`, `ci:check-hygiene`, `check:audit`,
`check:electron-security`, `git diff --check`. `check:audit` still reports exactly one
documented exception (the unchanged `CVE-2024-4367`); `security/audit-exceptions.json`
is untouched; `enableScripting: false` is now asserted in _two_ places, the document
options and the annotation layer.

Build: `npm run build:renderer:electron` emits both workers
(`pdf.worker.min-<hash>.js` 1 062 kB legacy, `pdf.worker.min-<hash>.mjs` 1 235 kB
native), `vendor-pdf-legacy` 459 kB, `vendor-pdf-native` 437 kB, the full 200-file
`dist/pdfjs/` tree, and the `viewer-<hash>.css` chunk (2.77 kB) carrying both native
layer stylesheets. `VITE_NATIVE_PDF_VIEWER=true` produces the same artifact set.

### Interactive smoke — outstanding

This environment still has no interactive session, so the Phase 5 list is **not**
resolved and the Phase 6 list could not be run either. The Phase 6 checks a human
should make, on the same PDFs plus one that has links:

- a link's **hitbox alignment** at 100 %, 150 % and fit, and on a rotated page — jsdom
  has no layout, so the automated tests prove the viewport argument and the layer
  order, never that a rectangle sits over the right glyphs
- the hover tint and the pointer cursor on a link, and that a link is _not_ clickable
  where the annotation layer has no section
- an internal link moving the page, with reading progress following it
- an external link opening in the system browser with **no** renderer navigation and
  no new window inside the app
- `javascript:` and `file://` link annotations doing nothing at all
- text selection with the annotation layer mounted, including a selection that starts
  and ends on either side of a link
- the form case: a PDF with an AcroForm field should look exactly as it did under the
  legacy viewer and not be editable
- the Phase 5 list itself, which is still open: selection alignment at 100 % / 150 % /
  fit, `Ctrl+C`, pan ⇄ text, multi-PDF, and a text-dense page for a UI-lock check

## Phase 7 — native search + highlight overlay

**Search works on the native viewer, and the search UI did not change.** One
`PdfSearchBar`, one `usePdfSearchStore`, one `PdfToolbar`, and the two functions
`@react-pdf-viewer/search` exposes — `highlight(keyword)` and `clearHighlights()` — which
the native controller now also implements. The toolbar switch happens where the renderer
is chosen, so neither the bar nor the store grew a branch, `Ctrl+F` still routes through
the same store, and nothing about the search experience differs between the two paths.

### Why the search engine is ours, not `PDFFindController`

Verified against `node_modules/pdfjs-6` (`pdfjs-dist@6.4.299`),
`types/web/*` and the implementation in `web/pdf_viewer.mjs` (319 973 bytes on disk):

```js
new PDFFindController({ linkService, eventBus, delay = 250, updateMatchesCountOnProgress = true })
```

Three properties of the installed implementation, read off the source rather than the
documentation:

1. **It is only reachable through the web viewer.** `pdfjs-6/web/pdf_viewer.mjs` exports
   it; the package entry point exports `AnnotationLayer`, `AnnotationMode`,
   `AnnotationType` and nothing find-related.
2. **It demands an `EventBus` and dereferences a viewer.** The constructor calls
   `eventBus.on("find" | "findbarclose" | "pagesedited", …)` four times before doing
   anything, and `get pagesCount()` is `this.pdfViewer.pagesCount` — so it is inoperable
   without a `PDFViewer`, exactly as `PDFLinkService` was in Phase 6.
3. **It renders through `PDFPageView`.** Matches are published by dispatching
   `updatetextlayermatches`, which `PDFPageView` receives and turns into highlight
   elements. This viewer has page views of its own making, none of that plumbing.

So the web bundle stays out, and the same reasoning as Phase 6 applies. Asserted by
`pdfjs-dual-runtime.test.ts`: no `pdfjs-6/web/`, no `PDFFindController`, no `EventBus`, no
`PDFViewer` anywhere in `features/pdf/native/**`.

### The legacy path does not use it either — that is the parity target

This is the part that decides the _shape_ of the implementation rather than just ruling
out an import. `@react-pdf-viewer@3.12.0`'s search plugin never reaches for
`PDFFindController`; its `Highlights` component walks the page's text-layer DOM:

1. concatenate every run's `textContent` into one string, with a parallel array of
   `{ char, charIndexInSpan, spanIndex }`;
2. scan it with one **escaped, case-insensitive, global** regexp built from the keyword
   (`new RegExp(escapeRegExp(keyword), 'gi')` — no whole-words mode, no match-case
   toggle, both plugin checkboxes unused by this app);
3. group each match's characters by run and, per group, set a `document.createRange()`
   on that run's first text node, wrap it, read `getBoundingClientRect()`, un-wrap it,
   and express the box as **percentages of the text layer's own rect**;
4. skip a group that is a single whitespace character (the gap between two words);
5. sort by `top`, then `left`, and render one `div` per group through
   `safeRenderHighlights`.

Phase 7 ports _that_ algorithm, so "parity" is a statement about real measured
behaviour rather than about a PDF.js internals this app never used.

### What was carried over, and what was not

| Behaviour                                    | Legacy (RPV plugin)                                | Native (Phase 7)                                         |
| -------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| scope                                        | rendered page                                      | rendered page                                            |
| matching                                     | literal, case-insensitive                          | literal, case-insensitive, scanned without a regexp      |
| across runs / line breaks                    | yes                                                | yes — runs are concatenated with no separator            |
| rectangles                                   | one per run a match touches                        | one per run a match touches; one per client rect per run |
| single-space run                             | skipped                                            | skipped                                                  |
| overlay ordering                             | top, then left                                     | top, then left                                           |
| empty keyword                                | no search                                          | no search                                                |
| fade-in                                      | `pdf-highlight-fadein`, 400 ms delay, `opacity: 0` | same, referenced not redeclared                          |
| reduced motion                               | static `opacity: 0.3`                              | static `opacity: 0.3`                                    |
| `title`                                      | `keywordStr.trim()`                                | `keyword.trim()`                                         |
| next/prev match, match count, auto page jump | absent                                             | absent (deliberately; see below)                         |

**Not reproduced deliberately:** the `gi` regexp's Unicode canonicalization, where
`/s/i` also matches `ſ` (U+017F). Matching folds one UTF-16 code unit at a time with
locale-independent `toLowerCase()` instead. Two reasons, and the second is the load-
bearing one:

- a locale-aware fold (`toLocaleLowerCase`) would make the same document match differently
  depending on the user's locale — the opposite of parity;
- `String#toLowerCase()` on a whole string is **not length-preserving** for every
  character (`'İ'` U+0130 folds to `i` + a combining dot), so a lowercased copy of the page
  would shift every offset after such a character onto the wrong glyph. Per-unit
  comparison keeps every offset an index into the original string, which is also what
  `Range#setStart` takes.

**Scope is the rendered page, deliberately.** The legacy viewer runs
`ViewMode.SinglePage`, so the plugin only ever highlights the current page — and because
it keeps the keyword in its store, the next page's text layer is highlighted as soon as it
renders. The native path reproduces that exactly: one page at a time, query kept across
page changes, rectangles redrawn from the new page's runs. There is **no whole-document
index**: it would extract every page's text in the background to produce nothing a
single-page viewer can show, and it would grow memory with page count. Asserted by
`pdfjs-dual-runtime.test.ts` (neither search file mentions `getTextContent` or `getPage`).

No next/previous match, no `3/27` counter, no page jump. Phase 1 recorded all three as
absent from the product, `src` has no such code on either path, and adding them would be a
new feature rather than a migration.

### Geometry: measured, page-relative, and never scaled

```
range = Range(run.firstChild, matchStartInRun, matchEndInRun + 1)
for each rect in range.getClientRects():
    left   = rect.left - pageBox.getBoundingClientRect().left
    top    = rect.top  - pageBox.getBoundingClientRect().top
    width  = rect.width
    height = rect.height
```

- **A `Range`, never an estimated character width.** A match can occupy more than one box
  (a rotated or wrapped run) and the union rect would highlight text the keyword did not
  match, so each client rect becomes its own highlight element while keeping the index of
  the logical match it belongs to.
- **The page box, not the text layer,** is the reference rect: it _is_ the canvas's box, so
  a page-relative pixel is in the coordinate space the canvas painted in. RPV normalizes
  against the text layer, whose box PDF.js sizes independently and rounds; one pixel of
  disagreement there is one pixel of disagreement with the glyphs.
- **No transform, no scroll offset.** Nothing is multiplied by the scale — the runs are
  already rendered at the current scale — and the overlay is positioned against the page
  box, so a window or container scroll cannot drift it.
- **Rotation needs no case.** The rotation is already folded into both the rendered runs
  and the page box, so a 90° page is the same subtraction with different client
  coordinates.
- `NaN`, `Infinity` and zero-area rects are refused before they reach a style.

### Ownership

| File                                  | Responsibility                                                             |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `native/nativePdfSearch.ts`           | the engine: page text, matching, `Range` geometry, highlight rendering     |
| `native/nativePdfSearchLayer.css`     | overlay + highlight layout, scoped to `data-native-pdf-search-*`           |
| `native/useNativePdfSearch.ts`        | keyword → rectangles: the lifecycle and the two toolbar callbacks          |
| `native/nativePdfDom.ts`              | the search-layer / search-highlight selectors, alongside the other layers  |
| `native/useNativePdfTextLayer.ts`     | `textLayerReady` — the signal search waits for                             |
| `native/useNativePdfController.ts`    | the search handle on the controller, next to the other layer handles       |
| `ui/components/NativePdfViewer.tsx`   | the fourth layer element                                                   |
| `ui/components/PdfViewerDocument.tsx` | the fifth ref, and the renderer switch for `highlight` / `clearHighlights` |
| `ui/components/PdfToolbar.tsx`        | nothing but the removal of the native-mode search hiding                   |

`nativePdfSearch.ts` and `useNativePdfSearch.ts` are split by responsibility — engine and
React — rather than gathered into one file, so the engine stays testable without a
renderer and the lifecycle stays readable without the geometry arithmetic.

### Lifecycle: synchronous, so the dependency list _is_ the invalidation

Both matching and measuring read DOM that already exists, in one pass, exactly as the
plugin's `highlightAll` does inside a render effect. There is no in-flight search, so
there is nothing to cancel and no generation counter to maintain — and the effect's
dependency list names everything that can make a previous rectangle wrong:

| dependency       | what it invalidates                                                       |
| ---------------- | ------------------------------------------------------------------------- |
| `documentKey`    | a reload or a different file: different text, same page number            |
| `currentPage`    | a different page's runs                                                   |
| `scale`          | every run is rebuilt, so every rectangle is stale                         |
| `textLayerReady` | a new generation of runs exists (first render, page change, zoom, reload) |
| `keyword`        | a new query                                                               |
| `enabled`        | the flag was switched off                                                 |

Two details that could have gone wrong and did not:

- **Effect order inside the controller.** `useNativePdfTextLayer` is declared before
  `useNativePdfSearch`, so on a page change or a zoom React runs its cleanup first — and
  that cleanup empties the text-layer container _synchronously_. By the time the search
  effect runs there are no runs to match, the overlay is emptied, and the rectangles are
  re-measured when `textLayerReady` flips back to true against the new scale. Stale
  geometry is removed **before** the replacement exists, never after.
- **`textLayerReady` is a generation signal, not a "there was a layer" flag.** It goes
  `false` the moment a rebuild starts and `true` only after the new `TextLayer` has drained
  its stream. A boolean could not distinguish "the runs I am about to measure" from "a
  layer existed at some point", which is the whole question search asks.

Rapid queries are therefore supersession by construction: `"r"` → `"ra"` → `"rheumatoid"`
runs three searches in order and the last one is what is on screen. It is pinned with the
counts falling 5 → 0 → 2, so a stale rectangle would show up as a leftover rather than as
a plausible total.

`searchError` exists for the same reason `textLayerError` does and is **not** rendered as
the error shell: a search that cannot measure costs the reader their results, not their
page. The overlay is emptied and the error is published; the canvas, the text layer and the
annotation layer are untouched.

### DOM structure and layer order

```
.pdf-canvas-container                      scroll + GPU containment (QuizLab's own class)
└── [data-native-pdf-page="4"]             position: relative; --total-scale-factor
    ├── canvas[data-native-pdf-canvas]     the glyphs
    ├── [data-native-pdf-text-layer]       PDF.js's TextLayer container
    │   └── span[role="presentation"] × N  one run per PDF.js text item
    ├── [data-native-pdf-annotation-layer] PDF.js's AnnotationLayer container
    │   └── section[data-annotation-id] → a   the link anchor
    └── [data-native-pdf-search-layer]     QuizLab's highlight overlay
        └── div[data-native-pdf-search-highlight] × M
            data-native-pdf-search-index   this rectangle
            data-native-pdf-search-match   the logical match it belongs to
```

The first three are PDF.js's `LAYERS_ORDER` and are untouched. The fourth is QuizLab's
own, declared **last in the DOM** and painted by `z-index` instead:

```
canvas              (no z-index)
search overlay      z-index: 1   ← tint over the glyphs
text layer          z-index: 0
annotation layer    z-index: 2   ← links stay the topmost thing under the cursor
```

So the document order is deliberately _not_ the paint order here, which is why it is an
asserted contract in `NativePdfViewer.test.tsx` rather than something left to React's
render order. `pointer-events: none` on the overlay and on each highlight is what makes it
free: the pointer passes through to the text layer, so text selection, `Ctrl+C`, the AI
selection action, panning and `Ctrl`+wheel zoom behave exactly as with no search running,
and a link under a highlight stays clickable.

The overlay is a **sibling** of the text layer, never a child: had it been inside, the
page-text extractor and `Ctrl+C` would read the keyword back out of the highlight elements.
Pinned in `useNativePdfSearch.test.tsx`.

### Highlight visual semantics

The legacy plugin's own stylesheet owns `.rpv-search__highlight` (position, `z-index: 1`,
the translucent yellow `rgba(255, 255, 0, 0.4)`, `border-radius: 0.25rem`). The native
overlay **does not emit that class** — reusing it would let the plugin's CSS style a layer
it knows nothing about and would make the two markups indistinguishable to a reader. So
the two visual properties it inherited are re-declared under
`[data-native-pdf-search-highlight]`, and the geometry plus the motion state stay inline
exactly as `safeRenderHighlights` sets them:

```
normal motion    opacity: 0
                 animation: pdf-highlight-fadein var(--duration-normal) ease
                              var(--duration-deliberate) forwards
reduced motion   opacity: 0.3, no animation at all
title            keyword.trim()
```

`pdf-highlight-fadein` is **referenced, not redeclared** — the keyframes stay in
`src/shared/styles/modules/_pdf-viewer.css`, which is untouched, and the delay is the
same deliberate product behaviour: dozens of highlight divs must not compete with page
rasterization. `prefers-reduced-motion` is read from `window.matchMedia` **once per search
run**, not cached in a second module-level variable; the legacy cache stays in
`usePdfPlugins.ts`, which is at **zero diff**, and the native path has nothing to
invalidate because it measures a handful of times per query.

### Search UI: unchanged, and provably so

| Interaction                  | Behaviour                                  | Where it is implemented                             |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `Ctrl/Cmd+F`                 | opens the shared bar                       | `usePdfShortcuts` → `usePdfSearchStore` (untouched) |
| typing                       | 300 ms debounce, then `highlight(keyword)` | `PdfToolbar` (untouched)                            |
| `Enter`                      | `highlight(keyword)` immediately           | `PdfSearchBar` (untouched)                          |
| `Escape`                     | `clearHighlights()` + close the bar        | `PdfSearchBar` (untouched)                          |
| a different file             | close the bar, empty the keyword, clear    | `PdfToolbar`'s existing effect                      |
| empty / whitespace keyword   | no search                                  | `PdfToolbar`, and the engine guards too             |
| next / previous match, count | **not a feature on either path**           | —                                                   |

The native controller reproduces the legacy surface and nothing more: two functions with
the same names, the same meaning and the same identity stability (`useCallback`, so
`PdfToolbar`'s memoisation still holds).

### Deliberately still not migrated

The capture pipeline, `activePdfDocumentRegistry`, the context menu, selection
screenshots, `usePdfViewerZoomIpc`, RPV itself, pdfjs 3.x and the `pdfjs-6` alias are all
still in the tree. `@react-pdf-viewer/search` is **not** deleted: with the flag off the
legacy path is still shipped and still needs it.

### Verification

| Suite                                                                                | Tests                                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `nativePdfSearch.test.ts` (page text, matching, geometry, highlight DOM)             | 34                                                         |
| `useNativePdfSearch.test.tsx` (overlay, invalidation, degradation, non-interference) | 20                                                         |
| `nativeSearchIntegration.test.tsx` (real `PdfSearchBar` + toolbar, both renderers)   | 6                                                          |
| `NativePdfViewer.test.tsx` (layer order, scale factor)                               | extended                                                   |
| `viewerFeatureFlagBoundary.test.tsx` (search wiring, four distinct refs)             | +2 / extended                                              |
| `PdfToolbar.test.tsx` (the native search bar is live again)                          | 1 rewritten, 1 added                                       |
| `architecture/pdfjs-dual-runtime.test.ts` (search boundary)                          | +5                                                         |
| **Full suite**                                                                       | **361 files, 3996 passed, 2 pre-existing skips, 0 failed** |

Phase 6's baseline was 358 files / 3928 passed / 2 skipped, so Phase 7 adds 3 files and
68 tests. **The Phase 2 search-highlight suite
(`features/pdf/ui/usePdfPluginsHighlights.test.tsx`, 14 tests) is byte-identical** — it
still pins `safeRenderHighlights` against the plugin's own `renderHighlights` prop, and it
was not edited to accommodate anything here. So are the three Phase 2 selection files, for
the fourth phase running.

Static gates green: `typecheck`, `lint`, `format:check`, `analyze:architecture`,
`analyze:file-sizes`, `analyze:css`, `ci:check-hygiene`, `check:audit`,
`check:electron-security`, `git diff --check`. `check:audit` still reports exactly one
documented exception (the unchanged `CVE-2024-4367`); `security/audit-exceptions.json` is
untouched and no exception was added for search.

Build: `npm run build:renderer:electron` emits both workers
(`pdf.worker.min-<hash>.js` 1 062 kB legacy, `pdf.worker.min-<hash>.mjs` 1 235 kB),
`vendor-pdf-legacy` 458.83 kB, `vendor-pdf-native` 436.85 kB, the full 200-file
`dist/pdfjs/` tree, and the `viewer-<hash>.css` chunk (3.19 kB) now carrying all three
native layer stylesheets. `VITE_NATIVE_PDF_VIEWER=true` produces the same artifact set.

### Interactive smoke — outstanding

This environment still has no interactive session, so the Phase 5 and Phase 6 lists are
**not** resolved and the Phase 7 list could not be run either. Phase 7's addition to the
checklist is the one thing jsdom structurally cannot answer: **does a rectangle cover the
glyphs it claims to?** The automated geometry tests prove offsets, page-relative
arithmetic, ordering, invalidation and the DOM contract; `nativeSearchGeometry.ts` is a
declared fake layout, so it cannot prove a highlight lands on the right word. What a human
should look at:

- a highlight sitting **on** the word, not near it — at 100 %, ~150 % and fit
- a keyword that spans two text runs, and one broken across a line break: both parts
  tinted, no rectangle over the gap between them
- the same highlight after a zoom landing on the same word, not on the old geometry
- a link annotation drawn over or next to a highlight: still hoverable, still clickable,
  and the click still navigates
- a text selection started and ended around highlights, then `Ctrl+C`, then "send
  selection to AI" — the copied text must not contain the overlay's own contents
- `Escape` clearing everything and closing the bar; the bar reopening with `Ctrl+F`
- a reload, then a page change, then switching to a second PDF: no results from the
  previous document
- a text-dense page searched repeatedly for a UI lock or a memory climb

The Phase 5 and Phase 6 lists above are still open and should be run in the same session.

## Phase 8A — native capture, active document registry, context-menu parity

The last three legacy-only capabilities. With this phase the native mode renders,
selects, links, searches, captures and serves the same context menu, which is what
"native feature parity" means for Phase 3B's exit plan. Removing RPV is Phase 8B and
happens in a separate change.

### What the capture pipeline looked like before

```
usePdfCaptureActions
  → renderPageToImageFallback(pdfUrl, page, { scale: 4, maxPixels: 20 MP })
      → getActivePdfDocument(pdfUrl)         lib/activePdfDocumentRegistry
      → else import('pdfjs-dist')           ← 3.x getDocument({ isEvalSupported: false })
      → page.render() → canvas → PNG blob → blob URL
      → finally destroy()                    ← PDFDocumentProxy#destroy(), 3.x only
  → findPageCanvas(page)                    ← lib/pdfViewerDom.ts (rpv-* page layers)
  → queueImageForAi(dataUrl | blobUrl, { page, captureKind })
```

Three problems, all of them runtime-shaped rather than behavioural:

1. the fallback load was a **second 3.x `getDocument` call site**, and therefore a
   second thing the `CVE-2024-4367` exception had to name;
2. the registry's stored value _was_ a 3.x `PDFDocumentProxy`, so its liveness check
   read `destroyed` — a field PDF.js 6 removed along with `destroy()`;
3. `findPageCanvas` knew only `rpv-core__page-layer`, and the native viewer emits
   `data-native-pdf-canvas` inside one `[data-native-pdf-page]` box.

### The registry contract, generalised

`ActivePdfDocumentHandle` replaces `ActivePdfDocument`:

```ts
interface ActivePdfDocumentHandle {
  getPage(pageNumber: number): Promise<CaptureDocumentPage>
  isAlive(): boolean
}
```

`getPage` is what capture calls; `isAlive()` is **adapter-provided**, so the store
never reads a version-specific flag and never branches on a pdf.js version. Two
producers:

| Producer              | Handle lifetime                        | `isAlive()`                                                |
| --------------------- | -------------------------------------- | ---------------------------------------------------------- |
| mounted legacy viewer | `PdfViewerElement` (frozen this phase) | `destroyed !== true` (3.x's own flag)                      |
| mounted native viewer | the viewer's `PdfDocumentManager`      | `!manager.destroyed && manager.getDocument() === document` |
| temporary capture     | a throwaway manager capture created    | `!manager.destroyed && manager.getDocument() !== null`     |

The store owns **lookup, identity and liveness** and nothing else. It has no
`destroy()` in its surface at all: capture borrows, and a borrowed handle exposes no
teardown to reach for. Dead entries are evicted on sight, which is what stops a
reload from handing capture a torn-down proxy and silently degrading the screenshot
to a screen-resolution clone.

**Multiple viewers.** `LeftPanel` and `FocusOverlay` can both be mounted on the same
file, and the store is still the single slot it has always been: **the most recent
registration wins**. Deregistration is token-scoped, so a viewer unmounting empties
the slot only when the entry is still its own — strictly better than the legacy
behaviour, and the same rule for both runtimes.

### Registration

`native/useNativePdfCaptureDocument.ts` is the native equivalent of the legacy viewer's
single `onDocumentLoad` call. It registers when `status === 'ready'` — the only state in
which the manager is known to hold the document for `pdfUrl` — and withdraws on a
document identity change, on reload, and on unmount. Every early return happens
**before** any withdrawal, so the inert (flag-off) path can never erase the legacy
viewer's registration.

The interesting part is the reload race, and it is closed twice over: the slot is
withdrawn as soon as the identity changes, _and_ the superseded handle's own
`isAlive()` is already false, because `PdfDocumentManager#load()` disposes the previous
loading task before starting the next one. A capture during that window gets `null` and
temp-loads; it is never handed the previous generation.

### Temporary capture documents

With nothing to borrow, `renderPageToImage` loads one isolated document through
`nativePdfCaptureDocument.loadTemporaryCaptureDocument`, which builds a throwaway
`createPdfDocumentManager()`:

- **one options builder** — `createPdfDocumentOptions`, so `enableScripting: false`,
  `cMapUrl`, `standardFontDataUrl`, `wasmUrl` and `iccUrl` are the engine's, not a
  second copy written next to capture;
- **one worker source** — `load()` calls `initializeNativePdfWorker()`;
- **one teardown** — `release()` is `manager.destroy()`, i.e.
  `PDFDocumentLoadingTask#destroy()`. No page `cleanup()`, no document `destroy()`.

This is why `renderPageToImage.ts` no longer imports `pdfjs-dist`: it imports **no**
PDF.js runtime at all. The legacy viewer is now the only 3.x `getDocument` call site,
which is why `isEvalSupported: false` survives there and nowhere else — and why the
`CVE-2024-4367` exception entry, though it still names the retired second call site in
its prose, is unchanged and still justified.

> **TEMPORARY.** `lib/renderPageToImage.ts` reaching into `features/pdf/native/` for its
> fallback load, and `setActivePdfDocument` accepting a raw 3.x proxy through
> `lib/legacyPdfCaptureDocument.ts`, both exist only while `PdfViewerElement.tsx` is
> frozen. Removal condition: **Phase 8B** — delete `PdfViewerElement.tsx`, then the
> legacy adapter, then make `setActivePdfDocument` take handles only.

### `findPageCanvas`

Renderer-agnostic, native first then legacy, with the cache unchanged (keyed on the page
and dropped as soon as the canvas leaves the DOM, which also distinguishes the two
renderers — a native canvas is never a legacy page layer's canvas). The native lookup
lives in `nativePdfDom.findNativePageCanvas`, and it **validates the page**:

```
[data-native-pdf-page="N"] canvas[data-native-pdf-canvas]
```

The native viewer keeps exactly one canvas, so the page attribute on the page box is the
only thing that can tell a valid lookup from a wrong-page match. Asking for a page that
is not on screen answers `null` rather than returning the current page's pixels under the
wrong label. The zero-size check is shared with the legacy branch, because
`useCanvasGpuCleanup` releases canvases by zeroing them.

### The page number, and why capture needed a ref

`usePdfCaptureActions` takes its page from `usePdfViewerState`, whose `currentPage` comes
from `usePdfNavigation` — driven by RPV's `onPageChange`. On the native path nothing
reports page changes, so that value stays frozen at its initial value while the reader
moves through the document: a capture on page 40 would have sent page 1.

`PdfViewerDocument` now creates a `capturePageRef` before `usePdfViewerState` runs and
writes `isNativeViewer ? nativeViewer.currentPage : currentPage` into it every render —
the same switch that already drives the toolbar's page readout. `usePdfCaptureActions`
reads that ref into the `currentPageRef` it already had, so the "label the AI item with
the page you were looking at when you pressed the button" contract is unchanged. The hook
itself grew no native branch.

### Context menu

No change was needed, and that is the finding. `usePdfContextMenu` listens on the shared
viewer container, `ContextMenu` is one component, and `usePdfViewerMenuItems` builds one
list of four items — add page text to AI, send page as image, crop screenshot, reload.
Three of the four were previously reaching into a legacy-only capability; they now reach
a real one. The renderer branch stayed at the single switch in `PdfViewerDocument`, and
no second menu exists. `nativeCaptureActions.test.tsx` drives the real menu on the real
native canvas to keep it that way.

The crop screenshot turned out not to be a PDF.js path at all: `startScreenshot` hands a
rectangle to the main process, which calls `webContents.capturePage(rect)`. There are no
`.rpv-*` geometry assumptions anywhere in it, so nothing had to be re-derived for the
native page box.

### Pixel thresholds, unchanged

Three separate numbers, deliberately not merged:

| Constant                   | Value        | Owner                                          | Meaning                                          |
| -------------------------- | ------------ | ---------------------------------------------- | ------------------------------------------------ |
| `PDF_RENDER_DEFAULT_SCALE` | `2.0`        | `renderPageToImage`                            | direct-render scale when the caller passes none  |
| `PDF_RENDER_MAX_PIXELS`    | `16_000_000` | `renderPageToImage`                            | direct-render pixel budget (caller passes 20 MP) |
| 12 MP                      | `12_000_000` | `captureCanvasAsBlob` + `usePdfCaptureActions` | PNG vs JPEG serialization decision               |
| `MAX_CANVAS_PIXEL_BUDGET`  | `50_000_000` | `useCanvasGpuCleanup`                          | GPU memory budget over the viewer's canvases     |

None of them moved, and the rounding-epsilon behaviour of the budget (derive the ratio
from the rounded viewport, round again without re-checking — 20 001 639 px against a
20 MP cap) is still deliberately not "fixed", because the regression tests pin it with an
explicit tolerance and re-checking would be a behaviour change rather than a repair.

### What is gone from the UI

`PdfToolbar.nativeCanvasMode` and `PdfAiQuickBar.captureActionsDisabled` were deleted.
They existed only because the native viewer had no capture pipeline; leaving them would
be a flag that can only ever disable a capability that now works, and a second thing to
forget in Phase 8B. `pdf_capture_unavailable` therefore has no remaining reader.

### Verification

- Targeted: `activePdfDocumentRegistry` (21), `renderPageToImage` (33), `findPageCanvas`
  (13 legacy + 6 native), `nativePdfCaptureDocument` (11), `useNativePdfCaptureDocument`
  (11), `nativeCaptureActions` (16 end-to-end through the real viewer, toolbar, context
  menu and capture ladder).
- `src/__tests__/architecture/**` + `src/__tests__/features/pdf/**`: 72 files, 912 tests.
- Build: both workers (`pdf.worker.min-*.js` 1 062 kB, `pdf.worker.min-*.mjs` 1 235 kB),
  `vendor-pdf-legacy` 458.81 kB, `vendor-pdf-native` 436.85 kB, the 3.19 kB `viewer-*.css`
  and the full 200-file `dist/pdfjs/` tree. `VITE_NATIVE_PDF_VIEWER=true` produces the
  same artifact set.

### Interactive smoke — outstanding

Unchanged from Phase 7 and still the largest debt in the branch: **no interactive session
was available for Phase 8A either**, so nothing here has been looked at in a real
application. Phase 8A adds its own list, and its first two items are the ones jsdom
structurally cannot reach:

- "send page as image" on the native canvas: sharp text, correct page, no cropping, white
  background — and, critically, **a visible confirmation that no second load happened**
- a very large page (A0) at scale 4: the pixel clamp applies and nothing crashes
- the crop screenshot overlay dragging a region over the native page, at fit and at 150 %
- right-click on the native canvas → all four items → each one doing what it says
- Reload from the context menu, then immediately capturing: the new generation must be
  the one captured
- switching to a second PDF and capturing: the label must follow the new file
- both PDF paths side by side (flag off and on) for the same capture actions

The Phase 5, Phase 6 and Phase 7 lists above remain open and should be run in the same
session. **These are human-smoke debts carried into Phase 8B**, which deletes the code
they exercise; whoever runs Phase 8B should run them first.

---

# Part IV — Performance baseline (must survive)

| Mechanism                                       | Where                                                                                    | Notes                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page virtualization / lazy rasterization        | RPV internals                                                                            | only renders pages near the viewport; **must be rebuilt**                                                                                          |
| Worker reuse                                    | `PdfWorkerHost` mounted once in `LeftPanel`                                              | survives open/close and tab switches; pdfjs 6's `GlobalWorkerOptions.workerPort` can reproduce it                                                  |
| Document cache / reuse                          | `activePdfDocumentRegistry`                                                              | capture borrows a runtime-agnostic handle instead of re-fetching a large file; the adapter's `isAlive()` prevents dead-document use after a reload |
| Page-proxy cache                                | `PDFDocumentProxy` per-page cache                                                        | capture deliberately does **not** call `PDFPageProxy.cleanup()`, because that clears `objs` and forces a font/image re-decode                      |
| Canvas GPU release                              | `useCanvasGpuCleanup` MutationObserver                                                   | zeroes `width`/`height` on every canvas that leaves the DOM, synchronously                                                                         |
| Total pixel budget                              | 50 MP cap, off-screen largest-first demotion                                             | protects HiDPI and textbook-length documents                                                                                                       |
| rAF zoom coalescing                             | `useCoalescedZoom`                                                                       | one `zoomTo` per frame; primary defence against `RenderingCancelledException` / "canvas context is locked"                                         |
| Resize debounce + locks                         | `usePdfResizeRefit` (150 ms), `useContainerSize` (500 ms nav lock, 50 ms panel throttle) | prevents repaint storms                                                                                                                            |
| Fit-scale quantization                          | 1 % dead-zone                                                                            | ±1 px container noise must not repaint                                                                                                             |
| GPU containment                                 | `contain: layout paint` / `contain: strict` in `_pdf-viewer.css`                         | must be reproduced in our CSS                                                                                                                      |
| Text-extraction fast path                       | `textContent` first, `innerText` only for <5 chars or suspicious glyphs                  | one batched layout pass instead of per-span `getComputedStyle`                                                                                     |
| Idle-deferred page text                         | `requestIdleCallback(timeout: 2000)` with a 500 ms `setTimeout` fallback                 | keeps extraction off the render path                                                                                                               |
| Selection rAF coalescing + 150 ms scroll freeze | `usePdfTextActions`                                                                      | avoids work during scroll                                                                                                                          |
| Page/canvas lookup caching                      | `findPageCanvas` cache, `PAGE_LAYER_CACHE` keyed by page, both `isConnected`-revalidated |                                                                                                                                                    |
| Capture request stamping                        | `captureRequestIdRef` + `pdfUrl` check                                                   | drops and **revokes** stale renders                                                                                                                |
| Highlight fade-in delay                         | 400 ms `pdf-highlight-fadein`                                                            | dozens of highlight divs must not compete with page rasterization                                                                                  |
| Manual chunking                                 | `vendor-pdf` in both `rollupOptions` and `rolldownOptions`                               | keeps pdf.js out of the main chunk                                                                                                                 |

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

| Phase                                            | Scope                                                                                                                                                                                                                                                      | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — baseline (this document)**                 | discovery + verified deltas only                                                                                                                                                                                                                           | branch pushed, no source change ✔                                                                                                                                                                                                                                                                                                                                                             |
| **2 — close the test gaps**                      | add regression tests for `renderPageToImage` (high-DPI + fallback), `usePdfTextActions` selection wiring, `usePdfPanTool` drag, `usePdfCtrlWheelZoom`, search highlight execution, `PdfTabStrip`                                                           | the behaviours a rewrite would silently break are pinned **before** any renderer change ✔ (125 tests added; `PdfTabStrip` and the two viewer-state hooks still open)                                                                                                                                                                                                                          |
| **3 — native engine skeleton, viewer untouched** | `engine/` (worker, documentManager, pageRenderer), packaged assets (`wasm/`, `iccs/`, `cmaps/`, `standard_fonts/`) + `build.files`, security policy flip, rewrite `pdfjs-engine-worker-coupling.test.ts`                                                   | RPV still renders; the new engine passes its own tests; `pdfjs-dist@6.4.299` installed; `npm run analyze:*` clean                                                                                                                                                                                                                                                                             |
| **4 — canvas + page/scale state**                | `PdfViewerElement` renders pages itself; keep `viewMode` single-page, `defaultScale` PageWidth, dark theme, `onPageChange`/`onDocumentLoad`/`onZoom` equivalents                                                                                           | open/close, tab switch, page nav, zoom, fit, reload all behave identically; screenshot + selection still pass ✔ (feature-flagged: the legacy viewer stays the default, and the normal build now emits **both** workers)                                                                                                                                                                       |
| **5 — text layer + selection**                   | `PdfTextLayer`, `extractPageTextFromDom`, `extractSelectedText` retargeted at our markup                                                                                                                                                                   | the Phase-2 selection tests pass unchanged ✔ (PDF.js 6 `TextLayer` mounted by the native viewer; both AI text actions live; selection suite green **without edits**)                                                                                                                                                                                                                          |
| **6 — annotation layer + links**                 | `PdfAnnotationLayer`, `PdfTextLayer`, `LinkService`                                                                                                                                                                                                        | links and form widgets behave as they do under RPV ✔ (PDF.js 6 `AnnotationLayer` mounted by the native viewer; internal destinations drive the native `currentPage` through `jumpToPage`; external links go through the app's existing `openExternal` IPC under `https:`/`mailto:`; unsafe protocols leave no actionable `href`; AcroForm widgets stay display-only via `renderForms: false`) |
| **7 — search**                                   | a native search controller + highlight overlay, reusing `pdf-highlight-fadein` and the legacy highlight's visual semantics under native attributes                                                                                                         | the Phase-2 search-highlight suite passes **unchanged** ✔ (native `highlight` / `clearHighlights` over the PDF.js text layer's own runs, `Range`-measured page-relative rectangles in a fourth `data-native-pdf-search-layer`; `PDFFindController` declined with `pdfjs-6/web/**`; the Phase-2 suite and `usePdfPlugins.ts` are byte-identical)                                               |
| **8A — capture parity (done)**                   | the capture pipeline, `activePdfDocumentRegistry` and the context menu reach the native viewer: a runtime-agnostic capture handle, a temporary pdfjs-6 document load, native canvas fallback, the live page number, and no capture bounding left in the UI | native page capture, high-DPI direct render, context-menu parity and the AI image actions all work on the native path, reusing the mounted document; the legacy viewer is unchanged; `renderPageToImage.ts` resolves no PDF.js runtime and the viewer is the only 3.x `getDocument`                                                                                                           |
| **8 — drop RPV**                                 | delete the four packages, `usePdfPlugins`, the 4 CSS imports, all 26 `rpv-*` rule blocks, `lib/pdfViewerDom.ts`'s RPV selectors; rewrite the 4 tests that mock `@react-pdf-viewer/core`                                                                    | `rg "@react-pdf-viewer\|rpv-"` returns nothing; no `?url` worker import from the viewer                                                                                                                                                                                                                                                                                                       |
| **9 — cleanup**                                  | `.npmrc` (after the eslint peers), `vite.config.mts` `vendor-pdf`/`EVAL` filter, `security/audit-exceptions.json`, `knip`/`ts-prune` pass, delete `patches`-adjacent stubs                                                                                 | `npm run analyze:all` clean, `npm audit` clean without an exception                                                                                                                                                                                                                                                                                                                           |

---

# Part VIII — Risks

| Risk                                                                    | Severity | Mitigation                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text-selection regression (column ordering, pill placement, multi-page) | **High** | Phase-2 tests first; `collectTextItems`/`orderTextItems` are pure and already reused by both extractors                                                                                                                                                                                     |
| High-DPI page render regression (the AI image feature)                  | **High** | Phase-2 tests first; keep the 20 MP budget and the 4-stage fallback ladder                                                                                                                                                                                                                  |
| Lazy rasterization loss → slow / memory-heavy large PDFs                | **High** | rebuild visibility-driven page mounting deliberately; keep the 50 MP canvas budget                                                                                                                                                                                                          |
| Search highlight geometry loss                                          | **High** | **Resolved in Phase 7**: `nativePdfSearch` re-derives the legacy geometry contract under `data-native-pdf-search-*`, keeps `pdf-highlight-fadein` by reference, and the Phase-2 highlight suite is unchanged. jsdom still cannot prove alignment — the interactive smoke list is still open |
| `CVE-2024-4367` acceptance becomes stale/wrong on 6.x                   | **High** | re-audit the advisory in Phase 3; the knob is gone, so the exception entry cannot simply be re-dated                                                                                                                                                                                        |
| Packaged asset growth (wasm + iccs + cmaps + fonts + a 2× worker)       | Medium   | decide `wasmUrl`/`iccUrl`/`standardFontDataUrl` explicitly; consider `useWasm:false` if JBIG2/OpenJPEG are not needed; skip the sandbox if `enableScripting:false`                                                                                                                          |
| `RenderingCancelledException` noise changes shape                       | Medium   | re-derive the markers in `pdfRenderErrors.ts` against 6.x                                                                                                                                                                                                                                   |
| DOM/CSS rewrite churn                                                   | Medium   | every `rpv-*` rule is already namespaced under `.pdf-viewer-container`; migrate rule-by-rule against the parity matrix                                                                                                                                                                      |
| `.npmrc` removal fails on eslint peers and looks like a PDF regression  | Medium   | Phase 9 only, after the eslint peers are resolved                                                                                                                                                                                                                                           |
| Installed-version drift (6.4.299 is 3 days old)                         | Medium   | exact pin; re-verify before Phase 3                                                                                                                                                                                                                                                         |
| `knip`/`ts-prune` flag newly-unused exports during the rewrite          | Low      | run `analyze:deadcode` in every phase                                                                                                                                                                                                                                                       |

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
