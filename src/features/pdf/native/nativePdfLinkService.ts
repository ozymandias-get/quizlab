/**
 * The native link service: PDF.js's `PDFLinkService` contract, sized to this viewer.
 *
 * ## Why this is an adapter and not `pdfjs-dist/web/pdf_viewer.mjs`
 *
 * PDF.js 6 has a real `PDFLinkService`, and the first instinct is to use it. It does
 * not survive contact with a single-page controller, for three reasons that all show
 * up in the installed source:
 *
 *  1. **It is not exported from `pdfjs-dist`'s entry point.** `types/src/pdf.d.ts` exports
 *     `AnnotationLayer`, `AnnotationMode` and `AnnotationType` — `PDFLinkService`
 *     lives in `types/web/pdf_link_service.d.ts`, so the only way in is
 *     `pdfjs-dist/web/pdf_viewer.mjs`, which is the *entire* web viewer (page views,
 *     history, find controller, scripting manager, sidebar, thumbnails, l10n).
 *     Importing it would pull a large amount of infrastructure this viewer has no
 *     use for into the native chunk.
 *  2. **Its `goToDestination` needs a `PDFViewer`.** `web/pdf_viewer.mjs` resolves
 *     destinations and then calls `this.pdfViewer.scrollPageIntoView(...)`, and even
 *     its `pagesCount` getter is `this.pdfViewer.pagesCount`. There is no such object
 *     here: page navigation is `useNativePdfPageState`'s `currentPage`.
 *  3. **Its external-link handling is the browser's, not ours.** `addLinkAttributes`
 *     assigns a real `link.href` and a `target`, with no click interception, so the
 *     outcome depends entirely on Electron's navigation interception — which
 *     (`electron/app/window/security.ts`) allow-lists `https:` only, and therefore
 *     cannot open the `mailto:` links the app's own external-link policy supports.
 *
 * So this file implements the *surface* `AnnotationLayer` actually calls, and nothing
 * else. The surface was read off `build/pdf.mjs` (`LinkAnnotationElement` and
 * `AnnotationLayer`), not off documentation:
 *
 * | member                     | called from                                            |
 * | -------------------------- | ------------------------------------------------------ |
 * | `externalLinkEnabled`      | `addLinkAttributes`                                     |
 * | `addLinkAttributes`        | `LinkAnnotationElement#render`, the `data.url` branch    |
 * | `getDestinationHash`       | `_bindLink`, i.e. the `data.dest` branch                |
 * | `goToDestination`          | `_bindLink`'s `onclick`                                 |
 * | `getAnchorUrl`             | `_bindNamedAction` / attachment / OCG / JS bindings     |
 * | `executeNamedAction`       | `_bindNamedAction`                                      |
 * | `getAttachmentContent`     | `#bindAttachment`                                       |
 * | `executeSetOCGState`       | `#bindSetOCGState`                                      |
 * | `eventBus` (optional)      | JS-action and widget bindings — absent, and unreachable |
 *
 * `downloadManager` is never passed, so the attachment path ends in a no-op.
 *
 * ## Navigation is the controller's, not a second state machine
 *
 * An internal destination resolves to a **1-based** page number and is handed to
 * `jumpToPage` — the same callback the toolbar's page box calls. Reading progress,
 * clamping and the resume flow therefore keep flowing through
 * `useNativePdfPageState`, and there is no second page machine to disagree with it.
 *
 * Destination resolution is a faithful port of `PDFLinkService.goToDestination`'s
 * first half: a string destination goes through `getDestination`, the resulting
 * array's first element is either a page **ref** (object → `getPageIndex`, which is
 * 0-based) or a plain 0-based page index. Both are the one place where an off-by-one
 * would be silent, so the conversion is explicit and tested.
 *
 * ## Nothing here rejects
 *
 * A broken destination must not crash, produce an unhandled rejection, or send the
 * reader to page 1. `goToDestination` therefore *resolves* on every failure path and
 * leaves the current page alone, and `getAttachmentContent` resolves to `null`. That
 * is also what keeps `_bindAttachment`'s fire-and-forget `openAttachment()` from
 * rejecting in the background.
 *
 * ## External links go through the app's existing pathway
 *
 * External targets are validated against `resolveExternalLink`'s protocol allow-list
 * (`https:`, `mailto:`) using the shared `parseUrlWithAllowedProtocols` helper, then
 * handed to `electronAPI.openExternal` — the same IPC the app's own "release notes"
 * and "about" links already use, which re-checks the URL in the main process before
 * `shell.openExternal`. No `window.open`, no `location.href`, no new Electron handler.
 *
 * A URL that fails the check is left **without an href at all** and cannot be
 * activated, so a `javascript:` annotation has nothing for the browser to execute
 * even if some other activation path existed. The click is intercepted in every case,
 * so the renderer never navigates.
 */
import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'
import { parseUrlWithAllowedProtocols } from '@shared/lib/urlUtils'

import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * The protocols the native viewer will hand to the OS.
 *
 * Deliberately the same set as the main process's `resolveExternalLink`
 * (`electron/core/systemHandlers/externalLinkPolicy.ts`): `https:` and `mailto:`.
 * This is the app's existing external-link policy, applied a second time at the
 * renderer boundary so the decision is testable without Electron and so an unsafe
 * target never becomes an actionable `href` in the first place. `http:` is not on
 * the list — the shipped main process refuses it, and matching it keeps the renderer
 * from promising something the main process would then reject.
 */
export const NATIVE_EXTERNAL_LINK_PROTOCOLS: readonly string[] = ['https:', 'mailto:']

/** PDF.js's `DEFAULT_LINK_REL` in 6.x — `noopener` and `noreferrer` included. */
const DEFAULT_LINK_REL = 'noopener noreferrer nofollow'

/**
 * A PDF destination as `getAnnotations` reports it: a named destination, or the
 * explicit `[pageRefOrIndex, { name }, …]` array.
 */
export type NativePdfDestination = string | unknown[]

/**
 * The `href` an internal destination gets.
 *
 * PDF.js uses the deprecated global `escape()`. Nothing in QuizLab parses this hash
 * back — the app has no in-page hash router — so the exact escaping is inert; what
 * matters is that it is a non-empty, app-local fragment, which keeps the anchor
 * focusable and lets PDF.js's `onclick → return false` cancel the navigation before
 * the browser acts on it. An empty destination yields an empty href, exactly as
 * `PDFLinkService.getDestinationHash` does.
 */
function destinationHash(destination: NativePdfDestination): string {
  const key =
    typeof destination === 'string'
      ? destination
      : Array.isArray(destination)
        ? JSON.stringify(destination)
        : ''
  if (key.length === 0) return ''
  return `#${encodeURIComponent(key)}`
}

/**
 * The renderer half of that policy: protocol plus embedded credentials.
 *
 * Two checks, both about the same question — *may this URL become an actionable `href`
 * in the document?* — and both cheap to answer here. The rest of `resolveExternalLink`
 * (the loopback / IPv4-literal / TLD-less host rules) deliberately stays in the main
 * process: duplicating it would create a second policy that could drift from the first,
 * which is the failure mode the single-main-process design exists to prevent. A URL that
 * passes here and fails there is simply not opened — `openExternal` returns `false`.
 */
function parseAllowedExternalUrl(url: string): URL | null {
  const parsed = parseUrlWithAllowedProtocols(url, NATIVE_EXTERNAL_LINK_PROTOCOLS)
  if (!parsed) return null
  if (parsed.username || parsed.password) return null
  return parsed
}

export interface NativePdfLinkServiceOptions {
  /**
   * The live document, read at call time rather than captured. Returns `null` before
   * the first load and after teardown, which is how an inert service is recognised.
   */
  getPdfDocument: () => PDFDocumentProxy | null
  /** The native controller's own 1-based page navigation. */
  jumpToPage: (pageNumber: number) => void
  /** The app's approved external-link pathway. */
  openExternal: (url: string) => void
}

/**
 * The structural type PDF.js's `AnnotationLayer` expects. Declared rather than
 * imported because `pdfjs-dist` does not export the class, and `any` would hide the very
 * contract this file exists to implement.
 */
export interface NativePdfLinkService {
  /** Present because `addLinkAttributes` reads it; QuizLab always allows external links. */
  externalLinkEnabled: boolean
  addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow?: boolean): void
  getDestinationHash(destination: NativePdfDestination): string
  goToDestination(destination: NativePdfDestination): Promise<void>
  getAnchorUrl(anchor: string): string
  executeNamedAction(action: string): void
  executeSetOCGState(action: unknown): Promise<void>
  getAttachmentContent(id: string): Promise<null>
  /**
   * Stop acting. Called when the layer that owns this service is superseded, so a
   * destination lookup still in flight cannot move the page after the fact.
   */
  dispose(): void
}

/**
 * Make an anchor un-navigable and hand its activation to `onActivate`.
 *
 * `preventDefault` is what actually stops the navigation; PDF.js's own `_bindLink`
 * relies on `onclick` returning `false`, which is the same thing. `stopPropagation`
 * is belt-and-braces — no click listener in the app's PDF path depends on the event
 * — and it keeps a link activation from reaching any future container-level handler.
 */
function interceptAnchorActivation(link: HTMLAnchorElement, onActivate: () => void): void {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onActivate()
  })
}

export function createNativePdfLinkService({
  getPdfDocument,
  jumpToPage,
  openExternal
}: NativePdfLinkServiceOptions): NativePdfLinkService {
  let disposed = false

  /**
   * Resolve a destination array to a 1-based page number, or `null`.
   *
   * A port of `PDFLinkService.goToDestination`'s resolution, including the two ways
   * a destination can name a page: an indirect **ref** (resolved through the
   * document's page-index lookup, itself 0-based) or a literal **index** (also 0-based).
   * Both are `+ 1` once, here, and nowhere else.
   */
  async function resolveDestinationPage(
    pdfDocument: PDFDocumentProxy,
    destination: NativePdfDestination
  ): Promise<number | null> {
    const explicitDestination =
      typeof destination === 'string'
        ? await pdfDocument.getDestination(destination)
        : await destination

    if (!Array.isArray(explicitDestination)) return null

    const destinationRef = explicitDestination[0]
    let pageNumber: number | null = null

    if (destinationRef && typeof destinationRef === 'object') {
      // `cachedPageNumber` is the fast path; `getPageIndex` is the slow one, and it
      // is the only one that survives a destination the page cache has never seen.
      const cached = pdfDocument.cachedPageNumber(destinationRef as never)
      if (cached) {
        pageNumber = cached
      } else {
        try {
          pageNumber = (await pdfDocument.getPageIndex(destinationRef as never)) + 1
        } catch {
          return null
        }
      }
    } else if (Number.isInteger(destinationRef)) {
      pageNumber = (destinationRef as number) + 1
    }

    if (pageNumber === null || !Number.isInteger(pageNumber)) return null
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) return null
    return pageNumber
  }

  return {
    externalLinkEnabled: true,

    addLinkAttributes(link, url, newWindow = false) {
      if (disposed) {
        interceptAnchorActivation(link, () => {})
        return
      }

      const allowedUrl = parseAllowedExternalUrl(url)
      if (!allowedUrl) {
        // No `href` is assigned at all: an unsafe target has nothing actionable left
        // in the DOM for the browser to follow.
        link.setAttribute('aria-disabled', 'true')
        interceptAnchorActivation(link, () => {})
        return
      }

      const href = allowedUrl.toString()
      link.href = href
      link.title = href
      // PDF.js's own target choice: no target unless the document asked for a new one.
      link.target = newWindow ? '_blank' : ''
      link.rel = DEFAULT_LINK_REL
      interceptAnchorActivation(link, () => {
        openExternal(href)
      })
    },

    getDestinationHash: destinationHash,

    async goToDestination(destination) {
      if (disposed) return
      const pdfDocument = getPdfDocument()
      if (!pdfDocument) return

      const pageNumber = await resolveDestinationPage(pdfDocument, destination)
      // Every await is followed by this check: a page change, a zoom or a document
      // switch while a named destination was being looked up must not move the
      // viewer afterwards.
      if (disposed || !pageNumber) return

      jumpToPage(pageNumber)
    },

    // PDF.js resolves these against `baseUrl`, which is the viewer's own URL. This
    // viewer is not served from the document's location, so an empty base is the
    // honest answer: an app-local fragment for named actions, `""` otherwise.
    getAnchorUrl: (anchor) => anchor,

    executeNamedAction() {
      // `NextPage`/`PrevPage`/`FirstPage`/`LastPage` and the history actions. They
      // are inert here rather than half-implemented: the legacy viewer drives its own
      // navigation plugins, and a named action is not a destination. Recorded as
      // deferred work rather than guessed at.
    },

    async executeSetOCGState() {
      // Optional-content visibility needs the optional-content configuration, which
      // this viewer does not carry. Resolving keeps the annotation inert, not broken.
    },

    async getAttachmentContent() {
      // File attachments are deliberately unsupported: Phase 6 is not a launcher for
      // embedded local files. Returning `null` leaves the anchor clickable and inert.
      return null
    },

    dispose() {
      disposed = true
    }
  }
}

/**
 * The default external-link pathway: the app's own `openExternal` IPC.
 *
 * Reused rather than re-invented — it is what `UpdateBanner`, `useSettings` and the
 * Gemini session cards already call, and the main process re-validates the URL
 * (`resolveExternalLink`) before it reaches `shell.openExternal`. Failures are
 * reported, never surfaced as a PDF error: a link that will not open is not a broken
 * page.
 */
export function openNativeExternalPdfLink(url: string): void {
  const api = getElectronApi()
  if (!api) return
  try {
    void Promise.resolve(api.openExternal(url)).catch((cause: unknown) => {
      reportSuppressedError('pdf.link.openExternal', { cause })
    })
  } catch (cause) {
    reportSuppressedError('pdf.link.openExternal', { cause })
  }
}
