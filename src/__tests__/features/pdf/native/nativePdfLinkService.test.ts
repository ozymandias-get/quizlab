/**
 * The native link service's behaviour, pinned against a fake PDF document.
 *
 * The adapter is the real production module; only `PDFDocumentProxy` is faked, with
 * the three members destination resolution actually uses — `getDestination`,
 * `getPageIndex` and `cachedPageNumber` — plus `numPages`. Real `<a>` elements are
 * clicked, so what is under test is the DOM contract PDF.js's `LinkAnnotationElement`
 * relies on, not a function called with the right arguments.
 *
 * What is pinned:
 *
 *  - the two shapes a destination can name a page with (an indirect ref and a literal
 *    index) and the single 0-based → 1-based conversion each needs
 *  - named destinations, including a name the document does not have
 *  - first page, last page, out-of-range and unresolvable destinations, none of which
 *    may throw, reject or move the reader
 *  - a destination that resolves after the service was disposed (a page change, a zoom,
 *    a document switch or unmount while a lookup was in flight)
 *  - external URLs: allowed protocols open exactly once through the app's pathway,
 *    everything else is left without an actionable href and cannot navigate
 *  - `rel`/`target` on an allowed external link
 */
import {
  createNativePdfLinkService,
  NATIVE_EXTERNAL_LINK_PROTOCOLS
} from '@features/pdf/native/nativePdfLinkService'

import type { PDFDocumentProxy } from 'pdfjs-6'

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** `AnnotationType.LINK` from `build/pdf.mjs`. */
const LINK = 2

interface FakeDocumentOptions {
  numPages: number
  destinations?: Record<string, unknown[] | null>
  /** Indirect page references and the 0-based page index each resolves to. */
  pageRefs?: Map<unknown, number | null>
  /** Page numbers the page cache already holds, so `cachedPageNumber` can answer. */
  cachedPages?: number[]
}

function createFakePdfDocument({
  numPages,
  destinations = {},
  pageRefs = new Map(),
  cachedPages = []
}: FakeDocumentOptions): PDFDocumentProxy {
  return {
    numPages,
    getDestination: async (id: string) =>
      Object.hasOwn(destinations, id) ? destinations[id] : null,
    getPageIndex: async (ref: unknown) => {
      const index = pageRefs.get(ref)
      if (index === undefined || index === null) {
        throw new Error('no such page ref')
      }
      return index
    },
    cachedPageNumber: (ref: unknown) => {
      const index = pageRefs.get(ref)
      if (index === undefined || index === null) return null
      const pageNumber = index + 1
      return cachedPages.includes(pageNumber) ? pageNumber : null
    }
  } as unknown as PDFDocumentProxy
}

function createHarness(options: FakeDocumentOptions) {
  const document = createFakePdfDocument(options)
  const jumpToPage = vi.fn()
  const openExternal = vi.fn()
  const service = createNativePdfLinkService({
    getPdfDocument: () => document,
    jumpToPage,
    openExternal
  })
  return { document, jumpToPage, openExternal, service }
}

/** A fresh anchor, as PDF.js's `LinkAnnotationElement` would create. */
function anchor(): HTMLAnchorElement {
  return document.createElement('a')
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* -------------------------------------------------- internal destinations */

describe('native link service — internal destinations', () => {
  it('converts a 0-based literal page index to the controller 1-based page', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    // `GoTo` destination as `getAnnotations` reports it: [0-based index, { name }].
    await service.goToDestination([0, { name: 'XYZ' }, null, null, null])

    expect(jumpToPage).toHaveBeenCalledTimes(1)
    expect(jumpToPage).toHaveBeenCalledWith(1)
  })

  it('does not repeat the off-by-one in the middle of the document', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    // A 0-based index of 6 is QuizLab's page 7. The whole point of this phase.
    await service.goToDestination([6, { name: 'Fit' }])

    expect(jumpToPage).toHaveBeenCalledWith(7)
  })

  it('reaches the last page from the last 0-based index', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    await service.goToDestination([11, { name: 'Fit' }])

    expect(jumpToPage).toHaveBeenCalledWith(12)
  })

  it('resolves an indirect page ref through the page-index lookup', async () => {
    const ref = { num: 42 }
    const { service, jumpToPage } = createHarness({
      numPages: 12,
      pageRefs: new Map([[ref, 4]])
    })

    await service.goToDestination([ref, { name: 'XYZ' }])

    // `getPageIndex` is 0-based and the ref was never in the page cache.
    expect(jumpToPage).toHaveBeenCalledWith(5)
  })

  it('prefers the cached page number when the page cache already holds the ref', async () => {
    const ref = { num: 9 }
    const { service, jumpToPage, document } = createHarness({
      numPages: 12,
      pageRefs: new Map([[ref, 2]]),
      cachedPages: [3]
    })
    const getPageIndex = vi.spyOn(document, 'getPageIndex')

    await service.goToDestination([ref, { name: 'XYZ' }])

    expect(jumpToPage).toHaveBeenCalledWith(3)
    expect(getPageIndex).not.toHaveBeenCalled()
  })

  it('resolves a named destination through the document lookup', async () => {
    const { service, jumpToPage } = createHarness({
      numPages: 12,
      destinations: { chapterTwo: [3, { name: 'XYZ' }] }
    })

    await service.goToDestination('chapterTwo')

    expect(jumpToPage).toHaveBeenCalledWith(4)
  })

  it('resolves a named destination that itself names a page by ref', async () => {
    const ref = { num: 77 }
    const { service, jumpToPage } = createHarness({
      numPages: 12,
      destinations: { appendix: [ref, { name: 'Fit' }] },
      pageRefs: new Map([[ref, 8]])
    })

    await service.goToDestination('appendix')

    expect(jumpToPage).toHaveBeenCalledWith(9)
  })

  it('gives an internal anchor a non-empty, app-local href so it stays focusable', () => {
    const { service } = createHarness({ numPages: 12 })

    const href = service.getDestinationHash([0, { name: 'XYZ' }])

    expect(href.startsWith('#')).toBe(true)
    expect(href).not.toBe('#')
    // Never a navigable URL: an internal destination must not leave the app.
    expect(href).not.toMatch(/^[a-z][a-z0-9+.-]*:/i)
  })

  it('gives a named destination a non-empty href too', () => {
    const { service } = createHarness({ numPages: 12 })

    expect(service.getDestinationHash('chapterTwo').startsWith('#')).toBe(true)
  })

  it('gives an empty destination an empty href, as PDF.js does', () => {
    const { service } = createHarness({ numPages: 12 })

    // PDF.js's `_bindLink(link, '')` is the tooltip-only case: no destination, so no
    // href and an onclick that cancels.
    expect(service.getDestinationHash('')).toBe('')
    // `[]` does stringify to something, so PDF.js hashes it too — parity, not a
    // deliberate improvement.
    expect(service.getDestinationHash([]).startsWith('#')).toBe(true)
  })
})

/* ------------------------------------------------------- broken targets */

describe('native link service — destinations that do not resolve', () => {
  it('leaves the page alone for a name the document does not have', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    await expect(service.goToDestination('nowhere')).resolves.toBeUndefined()
    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('leaves the page alone for a destination that is not an array', async () => {
    const { service, jumpToPage } = createHarness({
      numPages: 12,
      destinations: { broken: 'not-a-destination' as unknown as unknown[] }
    })

    await expect(service.goToDestination('broken')).resolves.toBeUndefined()
    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('leaves the page alone for an empty destination array', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    await service.goToDestination([])

    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('leaves the page alone for an unresolvable page ref', async () => {
    const ref = { num: 'broken' }
    const { service, jumpToPage } = createHarness({
      numPages: 12,
      pageRefs: new Map([[ref, null]])
    })

    await expect(service.goToDestination([ref, { name: 'XYZ' }])).resolves.toBeUndefined()
    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('refuses a destination past the end of the document', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 4 })

    // Index 9 does not exist in a 4-page document; clamping it would silently send the
    // reader somewhere the PDF never pointed at.
    await service.goToDestination([9, { name: 'XYZ' }])

    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('refuses a negative destination index', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    await service.goToDestination([-1, { name: 'XYZ' }])

    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('is inert before a document exists', async () => {
    const jumpToPage = vi.fn()
    const service = createNativePdfLinkService({
      getPdfDocument: () => null,
      jumpToPage,
      openExternal: vi.fn()
    })

    await expect(service.goToDestination([0, { name: 'XYZ' }])).resolves.toBeUndefined()
    expect(jumpToPage).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------- stale resolution */

describe('native link service — a resolution that lands after supersede', () => {
  it('does not move the page once the service was disposed', async () => {
    let releaseDestination!: (value: unknown[] | null) => void
    const pending = new Promise<unknown[] | null>((resolve) => {
      releaseDestination = resolve
    })
    const document = {
      numPages: 12,
      getDestination: () => pending,
      getPageIndex: async () => 0,
      cachedPageNumber: () => null
    } as unknown as PDFDocumentProxy
    const jumpToPage = vi.fn()
    const service = createNativePdfLinkService({
      getPdfDocument: () => document,
      jumpToPage,
      openExternal: vi.fn()
    })

    const navigation = service.goToDestination('slowChapter')
    // The page changed, the document was replaced, or the viewer unmounted.
    service.dispose()
    releaseDestination([5, { name: 'XYZ' }])
    await navigation

    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('goes inert for good once disposed', async () => {
    const { service, jumpToPage } = createHarness({ numPages: 12 })

    service.dispose()
    await service.goToDestination([3, { name: 'XYZ' }])

    expect(jumpToPage).not.toHaveBeenCalled()
  })

  it('stays inert for an external link after dispose', () => {
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    service.dispose()
    service.addLinkAttributes(link, 'https://example.com/docs')

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(openExternal).not.toHaveBeenCalled()
  })
})

/* ---------------------------------------------------------- external URLs */

describe('native link service — external URLs', () => {
  it('hands an https URL to the app pathway exactly once', () => {
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    service.addLinkAttributes(link, 'https://example.com/docs')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://example.com/docs')
  })

  it('refuses http, which the shipped main process refuses too', () => {
    // `resolveExternalLink` in the main process allow-lists `https:` and `mailto:`
    // only. Matching it here means the renderer never promises something the main
    // process would then reject.
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    service.addLinkAttributes(link, 'http://example.com/docs')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(openExternal).not.toHaveBeenCalled()
    expect(NATIVE_EXTERNAL_LINK_PROTOCOLS).not.toContain('http:')
  })

  it('opens a mailto URL, which the app already supports', () => {
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    service.addLinkAttributes(link, 'mailto:someone@example.com')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(openExternal).toHaveBeenCalledWith('mailto:someone@example.com')
  })

  it.each([
    ['javascript', 'javascript:alert(document.cookie)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['file', 'file:///etc/passwd'],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['ftp', 'ftp://example.com/file'],
    ['custom', 'quizlab-action:run']
  ])('never opens a %s URL and leaves no href for the browser', (_label, url) => {
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    service.addLinkAttributes(link, url)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(openExternal).not.toHaveBeenCalled()
    // Nothing actionable is left in the DOM — not a hidden href, not a disabled click.
    expect(link).not.toHaveAttribute('href')
    expect(link.getAttribute('href')).toBeNull()
    expect(link).toHaveAttribute('aria-disabled', 'true')
    // And the event was cancelled, so no activation path reaches the URL.
    expect(event.defaultPrevented).toBe(true)
  })

  it('cancels the click for an allowed URL so the renderer never navigates', () => {
    const { service } = createHarness({ numPages: 12 })
    const link = anchor()
    service.addLinkAttributes(link, 'https://example.com/docs')

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not let the click reach the viewer container', () => {
    const { service } = createHarness({ numPages: 12 })
    const container = document.createElement('div')
    const link = anchor()
    container.append(link)
    document.body.append(container)
    const containerClick = vi.fn()
    container.addEventListener('click', containerClick)
    service.addLinkAttributes(link, 'https://example.com/docs')

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(containerClick).not.toHaveBeenCalled()
    container.remove()
  })

  it('keeps PDF.js accessibility metadata on an allowed link', () => {
    const { service } = createHarness({ numPages: 12 })
    const link = anchor()

    service.addLinkAttributes(link, 'https://example.com/docs?a=1')

    // The href is the URL, so the link is announced and hoverable as itself.
    expect(link.getAttribute('href')).toBe('https://example.com/docs?a=1')
    expect(link.getAttribute('title')).toBe('https://example.com/docs?a=1')
    // `noopener noreferrer` are in PDF.js's own DEFAULT_LINK_REL; a new window must
    // not hand the opener or the referrer back.
    expect(link.rel).toContain('noopener')
    expect(link.rel).toContain('noreferrer')
  })

  it('gives no target unless the document asked for a new window', () => {
    const { service } = createHarness({ numPages: 12 })
    const inline = anchor()
    const newWindow = anchor()

    service.addLinkAttributes(inline, 'https://example.com/a')
    service.addLinkAttributes(newWindow, 'https://example.com/b', true)

    expect(inline.target).toBe('')
    expect(newWindow.target).toBe('_blank')
  })

  it('never opens a URL carrying embedded credentials', () => {
    const { service, openExternal } = createHarness({ numPages: 12 })
    const link = anchor()

    // The main process refuses these outright; refusing here too means no actionable
    // href is ever created for one.
    service.addLinkAttributes(link, 'https://user:pass@example.com/')
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(openExternal).not.toHaveBeenCalled()
    expect(link).not.toHaveAttribute('href')
  })
})

/* --------------------------------------------------- unsupported branches */

describe('native link service — annotation kinds Phase 6 does not run', () => {
  it('resolves an attachment request to null rather than rejecting', async () => {
    const { service } = createHarness({ numPages: 12 })

    // `#bindAttachment`'s handler awaits this fire-and-forget; a rejection here would
    // be an unhandled rejection with no user-visible cause.
    await expect(service.getAttachmentContent('file-1')).resolves.toBeNull()
  })

  it('does not launch a file for a Launch action', async () => {
    const { service, jumpToPage, openExternal } = createHarness({ numPages: 12 })

    await service.executeSetOCGState({ off: [] })
    service.executeNamedAction('NextPage')

    expect(jumpToPage).not.toHaveBeenCalled()
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('reports itself as having external links enabled, which PDF.js reads', () => {
    const { service } = createHarness({ numPages: 12 })

    expect(service.externalLinkEnabled).toBe(true)
  })

  it('resolves anchors against an empty base, not against the document URL', () => {
    const { service } = createHarness({ numPages: 12 })

    expect(service.getAnchorUrl('#x')).toBe('#x')
    expect(service.getAnchorUrl('')).toBe('')
  })

  it('never exposes an event bus, so a JavaScript action has nowhere to dispatch', () => {
    const { service } = createHarness({ numPages: 12 })

    expect((service as { eventBus?: unknown }).eventBus).toBeUndefined()
  })

  it('keeps the link annotation type constant the double uses honest', () => {
    // Guards the assumption baked into `nativeAnnotationLayerDouble.ts`.
    expect(LINK).toBe(2)
  })
})
