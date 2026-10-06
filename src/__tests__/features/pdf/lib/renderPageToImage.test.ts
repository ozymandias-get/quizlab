/**
 * Regression tests for the high-DPI page render path.
 *
 * `renderPageToImageFallback` is the primary rung of the capture ladder. Its two
 * document modes are load-bearing:
 *
 *  - **borrowed** — the viewer already owns a document, published through
 *    `activePdfDocumentRegistry`. The render reuses it and must NOT tear it down:
 *    destroying a mounted viewer's document drops its shared decoded-object cache
 *    (`objs.clear()`) and forces a full font/image re-decode on the next repaint.
 *  - **self-loaded** — nothing to borrow, so this call loads an isolated document
 *    through the native engine and owns it. That one MUST be released, in a
 *    `finally`, on the success path and on every failure path.
 *
 * Phase 8A moved the self-load onto pdfjs-6 and made the registry runtime-agnostic,
 * so the temporary load is mocked here and tested for real in
 * `nativePdfCaptureDocument.test.ts` — including that it carries
 * `enableScripting: false` and is destroyed through its loading task.
 *
 * The pixel budget is the other pinned contract: capture asks for a very high
 * scale (4.0 = ~288 DPI), and without a downscale a single A0 page would exceed
 * the budget by more than an order of magnitude.
 */
import {
  clearActivePdfDocument,
  setActivePdfDocument,
  type ActivePdfDocumentHandle
} from '@features/pdf/lib/activePdfDocumentRegistry'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findPageCanvas: vi.fn(),
  loadTemporaryCaptureDocument: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn()
}))

vi.mock('@features/pdf/native/nativePdfCaptureDocument', () => ({
  loadTemporaryCaptureDocument: mocks.loadTemporaryCaptureDocument
}))

vi.mock('@features/pdf/capture/findPageCanvas', () => ({
  findPageCanvas: mocks.findPageCanvas
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn }
}))

const { renderPageToImageFallback } = await import('@features/pdf/lib/renderPageToImage')

type Viewport = { width: number; height: number }
type FakePage = ReturnType<typeof makePage>

interface RenderParams {
  canvasContext: unknown
  viewport: Viewport
}

/** A PDFPageProxy stand-in whose viewport scales linearly from a point size. */
function makePage(pointWidth: number, pointHeight: number) {
  const renderTask = { promise: Promise.resolve(), cancel: vi.fn() }
  const render = vi.fn((_params: RenderParams) => renderTask)
  const getViewport = vi.fn(
    ({ scale }: { scale: number }): Viewport => ({
      width: Math.round(pointWidth * scale),
      height: Math.round(pointHeight * scale)
    })
  )
  return { getViewport, render, renderTask }
}

/** A borrowed handle over a document, i.e. what the registry hands back. */
function makeHandle(pages: Record<number, FakePage>) {
  const getPage = vi.fn(async (pageNumber: number) => {
    const page = pages[pageNumber]
    if (!page) throw new Error(`no page ${pageNumber}`)
    return page
  })
  const isAlive = vi.fn(() => true)
  return { getPage, isAlive } as ActivePdfDocumentHandle & {
    getPage: ReturnType<typeof vi.fn>
    isAlive: ReturnType<typeof vi.fn>
  }
}

/**
 * What `loadTemporaryCaptureDocument` hands back: a handle plus the one teardown
 * call capture owns. `release` is a spy so the ladder's ownership contract — never
 * release a borrowed handle, always release a temporary one — is directly
 * observable.
 */
function serveTemporaryDocument(pages: Record<number, FakePage>) {
  const handle = makeHandle(pages)
  const temporary = { handle, release: vi.fn() }
  mocks.loadTemporaryCaptureDocument.mockResolvedValue(temporary)
  return temporary
}

/** A canvas already painted by the viewer, used as the clone fallback source. */
function makeMountedCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'width', { configurable: true, value: width })
  Object.defineProperty(canvas, 'height', { configurable: true, value: height })
  return canvas
}

/**
 * jsdom ships no 2D backend: `getContext('2d')` reports null and `toBlob` never
 * invokes its callback, so without these stubs every render path bails (or hangs)
 * before doing any work. The stubs record the real drawing calls so the tests
 * assert observable behaviour rather than internals.
 */
function stubCanvasBackend() {
  const drawImage = vi.fn()
  const fillRect = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillStyle: '',
    drawImage,
    fillRect
  } as unknown as CanvasRenderingContext2D)
  return { drawImage, fillRect }
}

/** Record the (type, quality) pair `toBlob` was called with, and yield a blob. */
function stubToBlob(result: 'blob' | 'null' = 'blob') {
  const calls: { type: string | undefined; quality: unknown }[] = []
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: unknown
  ) {
    calls.push({ type, quality })
    callback(result === 'blob' ? new Blob(['page'], { type: type ?? 'image/png' }) : null)
  })
  return calls
}

/** Object URLs are not implemented in jsdom; capture allocates one per result. */
function stubObjectUrls() {
  let counter = 0
  const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:captured-${++counter}`)
  })
  return () => {
    if (original) Object.defineProperty(URL, 'createObjectURL', original)
    else delete (URL as unknown as Record<string, unknown>).createObjectURL
  }
}

describe('renderPageToImageFallback', () => {
  let restoreObjectUrls: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    clearActivePdfDocument()
    mocks.findPageCanvas.mockReturnValue(null)
    mocks.loadTemporaryCaptureDocument.mockReset()
    stubCanvasBackend()
    stubToBlob('blob')
    restoreObjectUrls = stubObjectUrls()
  })

  afterEach(() => {
    restoreObjectUrls()
    clearActivePdfDocument()
  })

  describe('borrowed document from the active registry', () => {
    it('reuses the registered document without loading a second one', async () => {
      const page = makePage(595, 842)
      const handle = makeHandle({ 3: page })
      setActivePdfDocument(handle, 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 3, { scale: 2 })

      expect(mocks.loadTemporaryCaptureDocument).not.toHaveBeenCalled()
      expect(handle.getPage).toHaveBeenCalledWith(3)
      expect(result).toMatchObject({ width: 1190, height: 1684 })
    })

    it('never releases the borrowed document, because the viewer owns it', async () => {
      const handle = makeHandle({ 1: makePage(595, 842) })
      setActivePdfDocument(handle, 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      // Nothing was loaded, so nothing could be released — and a borrowed handle
      // exposes no teardown for capture to reach for in the first place.
      expect(mocks.loadTemporaryCaptureDocument).not.toHaveBeenCalled()
    })

    it('never releases the borrowed document when the render itself fails', async () => {
      // Page 99 is absent, so getPage() rejects. The failure path still must not
      // tear down a document this call did not create.
      const handle = makeHandle({ 1: makePage(595, 842) })
      setActivePdfDocument(handle, 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')

      await expect(renderPageToImageFallback('local-pdf://pdf_a', 99, { scale: 2 })).resolves.toBe(
        null
      )

      expect(mocks.loadTemporaryCaptureDocument).not.toHaveBeenCalled()
    })

    it('serves the superseded generation of a reload only while it is still alive', async () => {
      // A reload replaces the registry entry. The stale handle must not be handed
      // to capture, or `getPage()` would reject and the screenshot would silently
      // degrade to a screen-resolution clone.
      const stale = makeHandle({ 1: makePage(595, 842) })
      stale.isAlive.mockReturnValue(false)
      setActivePdfDocument(stale, 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')
      const temporary = serveTemporaryDocument({ 1: makePage(595, 842) })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(stale.getPage).not.toHaveBeenCalled()
      expect(mocks.loadTemporaryCaptureDocument).toHaveBeenCalledTimes(1)
      expect(result).not.toBeNull()
      expect(temporary.release).toHaveBeenCalledTimes(1)
    })
  })

  describe('stale / unusable registry entry', () => {
    it('self-loads instead of reusing a document registered for a different url', async () => {
      const other = makeHandle({ 1: makePage(595, 842) })
      setActivePdfDocument(other, 'local-pdf://pdf_b', 'local-pdf://pdf_b::0')
      serveTemporaryDocument({ 1: makePage(595, 842) })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(other.getPage).not.toHaveBeenCalled()
      expect(mocks.loadTemporaryCaptureDocument).toHaveBeenCalledWith('local-pdf://pdf_a')
    })

    it('evicts the dead entry so a later capture does not retry it', async () => {
      const stale = makeHandle({ 1: makePage(595, 842) })
      stale.isAlive.mockReturnValue(false)
      setActivePdfDocument(stale, 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')
      serveTemporaryDocument({ 1: makePage(595, 842) })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      // The registry did the eviction; a second capture must now see an empty slot
      // rather than probing a dead handle again.
      mocks.loadTemporaryCaptureDocument.mockClear()
      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      expect(stale.isAlive).toHaveBeenCalledTimes(1)
      expect(mocks.loadTemporaryCaptureDocument).toHaveBeenCalledTimes(1)
    })
  })

  describe('temporary self-loaded document', () => {
    it('loads an isolated document when nothing is registered', async () => {
      const temporary = serveTemporaryDocument({ 1: makePage(595, 842) })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(mocks.loadTemporaryCaptureDocument).toHaveBeenCalledTimes(1)
      expect(temporary.handle.getPage).toHaveBeenCalledWith(1)
    })

    it('renders the page and returns the blob, its object url and the pixel size', async () => {
      const page = makePage(595, 842)
      serveTemporaryDocument({ 1: page })
      const toBlobCalls = stubToBlob('blob')

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(page.render).toHaveBeenCalledTimes(1)
      expect(page.getViewport).toHaveBeenCalledWith({ scale: 2 })
      expect(toBlobCalls).toEqual([{ type: 'image/png', quality: undefined }])
      expect(result?.blob).toBeInstanceOf(Blob)
      expect(result?.blobUrl).toMatch(/^blob:/)
      expect(result?.width).toBe(1190)
      expect(result?.height).toBe(1684)
    })

    it('releases the document it loaded itself on the success path', async () => {
      const temporary = serveTemporaryDocument({ 1: makePage(595, 842) })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(temporary.release).toHaveBeenCalledTimes(1)
    })

    it('releases the document it loaded itself when getPage rejects', async () => {
      const temporary = serveTemporaryDocument({}) // page 1 absent, so getPage rejects

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(temporary.release).toHaveBeenCalledTimes(1)
    })

    it('releases the document it loaded itself when toBlob yields no blob', async () => {
      const temporary = serveTemporaryDocument({ 1: makePage(595, 842) })
      stubToBlob('null')

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(temporary.release).toHaveBeenCalledTimes(1)
    })

    it('releases the document it loaded itself when the temporary load itself fails', async () => {
      // The load failed, so there is nothing to release — and the caller must not
      // see an exception escape from the direct rung.
      mocks.loadTemporaryCaptureDocument.mockRejectedValue(new Error('network down'))
      mocks.findPageCanvas.mockReturnValue(null)

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(mocks.findPageCanvas).toHaveBeenCalledTimes(1)
    })
  })

  describe('pixel budget', () => {
    /**
     * Production computes the downscale from the rounded viewport dimensions and
     * then rounds the rescaled dimensions again *without* re-checking them, so
     * the cap holds to within a rounding epsilon rather than exactly. Both
     * dimensions are rounded independently, which allows at most ~2*sqrt(area)
     * pixels of overshoot — under 0.01% for every budget the app uses.
     */
    const BUDGET_TOLERANCE = 1.001

    /** The scale production is expected to apply, derived from its own first measurement. */
    function expectedDownscales(page: FakePage, requested: number, maxPixels: number): number {
      const first = page.getViewport.mock.results[0].value as Viewport
      return requested * Math.sqrt(maxPixels / (first.width * first.height))
    }

    it('keeps the requested scale when the rendered page is inside the budget', async () => {
      // 200x200pt at scale 2 = 400x400 = 160k px, far below any budget.
      const page = makePage(200, 200)
      serveTemporaryDocument({ 1: page })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 16_000_000
      })

      // A single getViewport call means the budget never triggered a rescale.
      expect(page.getViewport).toHaveBeenCalledTimes(1)
      expect(page.getViewport).toHaveBeenCalledWith({ scale: 2 })
      expect(result).toMatchObject({ width: 400, height: 400 })
    })

    it('downscales until the rendered area fits the budget', async () => {
      // A0 at scale 2 overshoots the 16 MP budget, so the second measurement
      // must be asked for at the reduced scale.
      const page = makePage(1684, 2384)
      serveTemporaryDocument({ 1: page })

      const maxPixels = 16_000_000
      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels
      })

      expect(page.getViewport).toHaveBeenCalledTimes(2)
      const requested = page.getViewport.mock.calls[0][0].scale
      const applied = page.getViewport.mock.calls[1][0].scale
      expect(applied).toBeCloseTo(expectedDownscales(page, requested, maxPixels), 10)
      expect(applied).toBeLessThan(requested)
      expect(result!.width * result!.height).toBeLessThanOrEqual(maxPixels * BUDGET_TOLERANCE)
    })

    it('scales the canvas and the render viewport by the same reduced factor', async () => {
      const page = makePage(1684, 2384)
      serveTemporaryDocument({ 1: page })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 1_000_000
      })

      // The viewport handed to render() must be the downscalled one and must
      // match the canvas, otherwise the page is stretched or cropped.
      const renderArg = page.render.mock.calls[0]?.[0]
      expect(renderArg?.viewport.width).toBe(result?.width)
      expect(renderArg?.viewport.height).toBe(result?.height)
      expect(result!.width * result!.height).toBeLessThanOrEqual(1_000_000 * BUDGET_TOLERANCE)
    })

    it('honours the full-page screenshot call site: scale 4 with a 20 MP budget', async () => {
      // Exactly the arguments usePdfCaptureActions passes, so the budget logic
      // is pinned against its real caller rather than an invented one. An A0 page
      // at scale 4 would be ~64 MP without the downscale.
      const page = makePage(1684, 2384) // A0
      serveTemporaryDocument({ 7: page })

      const maxPixels = 20_000_000
      const result = await renderPageToImageFallback('local-pdf://pdf_a', 7, {
        scale: 4.0,
        maxPixels
      })

      expect(result).not.toBeNull()
      expect(result!.width * result!.height).toBeLessThanOrEqual(maxPixels * BUDGET_TOLERANCE)
      // Far below the unbudgeted 64 MP the caller asked for.
      expect(result!.width * result!.height).toBeLessThan(25_000_000)
    })

    it('never produces a zero-sized canvas', async () => {
      serveTemporaryDocument({ 1: makePage(1684, 2384) })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 1
      })

      expect(result).toMatchObject({ width: 1, height: 1 })
    })
  })

  describe('fallback from the pdfjs render to the live viewer canvas', () => {
    it('clones the viewer canvas when the page render cannot run', async () => {
      serveTemporaryDocument({})
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(300, 150))

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      // The clone is exactly 2x the on-screen canvas.
      expect(result).toMatchObject({ width: 600, height: 300 })
      expect(mocks.findPageCanvas).toHaveBeenCalledWith(1)
    })

    it('warns that the direct render failed before falling back', async () => {
      serveTemporaryDocument({})
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(100, 100))

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('pdfjs direct render failed'),
        expect.anything()
      )
    })

    it('paints the clone white before drawing so transparent pages stay legible', async () => {
      serveTemporaryDocument({})
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(100, 100))
      const { fillRect } = stubCanvasBackend()

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
    })

    it('applies the pixel budget to the clone as well', async () => {
      serveTemporaryDocument({})
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(4000, 4000))

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 1_000_000
      })

      expect(result!.width * result!.height).toBeLessThanOrEqual(1_000_000)
    })

    it('refuses to clone a zero-sized canvas', async () => {
      serveTemporaryDocument({})
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(0, 0))

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
    })

    it('falls through to the clone when the pdfjs canvas yields no blob', async () => {
      const temporary = serveTemporaryDocument({ 1: makePage(100, 100) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(80, 40))

      // First canvas (the pdf.js render) yields no blob; the clone's does.
      let call = 0
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string
      ) {
        call += 1
        callback(call === 1 ? null : new Blob(['clone'], { type: type ?? 'image/png' }))
      })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(result).toMatchObject({ width: 80, height: 40 })
      // The self-loaded document was still released after the toBlob failure.
      expect(temporary.release).toHaveBeenCalledTimes(1)
    })

    it('returns null rather than throwing when every rung fails', async () => {
      mocks.loadTemporaryCaptureDocument.mockRejectedValue(new Error('network down'))
      mocks.findPageCanvas.mockReturnValue(null)

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(mocks.loadTemporaryCaptureDocument).toHaveBeenCalledTimes(1)
      expect(mocks.findPageCanvas).toHaveBeenCalledTimes(1)
    })
  })
})
