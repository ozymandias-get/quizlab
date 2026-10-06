/**
 * Regression tests for the high-DPI page render path.
 *
 * `renderPageToImageFallback` is the primary rung of the capture ladder. Its two
 * load modes are load-bearing and were previously untested:
 *
 *  - borrowed mode — the viewer already owns a `PDFDocumentProxy`, registered in
 *    `activePdfDocumentRegistry`; the render reuses it and must NOT destroy it,
 *    because tearing down the viewer's loading task drops the shared decoded
 *    object cache and forces a full font/image re-decode on the next repaint.
 *  - self-loaded mode — no usable proxy in the registry, so this module calls
 *    `getDocument` itself and owns the result. That one MUST be destroyed, in a
 *    `finally`, on the success path and on every failure path.
 *
 * The pixel budget is the other pinned contract: capture asks for a very high
 * scale (4.0 = ~288 DPI), and without a downscale a single A0 page would exceed
 * the budget by more than an order of magnitude.
 */
import {
  clearActivePdfDocument,
  getActivePdfDocument,
  setActivePdfDocument
} from '@features/pdf/lib/activePdfDocumentRegistry'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  findPageCanvas: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  globalWorkerOptions: { workerSrc: '' as string },
  workerUrl: 'blob:mock-pdf-worker'
}))

/**
 * pdfjs-dist 3.x ships a UMD bundle, so Vite's interop exposes the API on
 * `default`; the production shim reads `default ?? module`. The mock mirrors
 * that shape so the borrowed/self-loaded paths run the same way they do in the
 * built app.
 */
vi.mock('pdfjs-dist', () => {
  const api = {
    getDocument: mocks.getDocument,
    GlobalWorkerOptions: mocks.globalWorkerOptions
  }
  return { ...api, default: api }
})

vi.mock('pdfjs-dist/build/pdf.worker.min.js?url', () => ({ default: mocks.workerUrl }))

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

function makeDoc(pages: Record<number, FakePage>) {
  return {
    destroyed: false,
    getPage: vi.fn(async (pageNumber: number) => {
      const page = pages[pageNumber]
      if (!page) throw new Error(`no page ${pageNumber}`)
      return page
    }),
    destroy: vi.fn()
  }
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
    mocks.globalWorkerOptions.workerSrc = ''
    mocks.findPageCanvas.mockReturnValue(null)
    stubCanvasBackend()
    stubToBlob('blob')
    restoreObjectUrls = stubObjectUrls()
  })

  afterEach(() => {
    restoreObjectUrls()
    clearActivePdfDocument()
  })

  describe('borrowed document from the active registry', () => {
    it('reuses the registered proxy without loading a second document', async () => {
      const page = makePage(595, 842)
      const doc = makeDoc({ 3: page })
      setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 3, { scale: 2 })

      expect(mocks.getDocument).not.toHaveBeenCalled()
      expect(doc.getPage).toHaveBeenCalledWith(3)
      expect(result).toMatchObject({ width: 1190, height: 1684 })
    })

    it('never destroys the borrowed proxy, because the viewer owns it', async () => {
      const doc = makeDoc({ 1: makePage(595, 842) })
      setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(doc.destroy).not.toHaveBeenCalled()
    })

    it('never destroys the borrowed proxy when the render itself fails', async () => {
      // Page 99 is absent, so getPage() rejects. The failure path still must not
      // tear down a document this call did not create.
      const doc = makeDoc({ 1: makePage(595, 842) })
      setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

      await expect(renderPageToImageFallback('local-pdf://pdf_a', 99, { scale: 2 })).resolves.toBe(
        null
      )

      expect(doc.destroy).not.toHaveBeenCalled()
    })

    it('leaves the viewer worker configuration untouched on the borrowed path', async () => {
      mocks.globalWorkerOptions.workerSrc = 'blob:already-configured'
      setActivePdfDocument(makeDoc({ 1: makePage(595, 842) }) as never, 'local-pdf://pdf_a', 'fp')

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(mocks.globalWorkerOptions.workerSrc).toBe('blob:already-configured')
    })
  })

  describe('stale / unusable registry entry', () => {
    it('does not reuse a proxy pdf.js already destroyed, and self-loads instead', async () => {
      const stale = makeDoc({ 1: makePage(595, 842) })
      setActivePdfDocument(stale as never, 'local-pdf://pdf_a', 'fp')
      // pdf.js sets `destroyed` on the proxy when the viewer's loading task is
      // torn down while the owning component stays mounted.
      stale.destroyed = true

      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(595, 842) }))
      })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(stale.getPage).not.toHaveBeenCalled()
      expect(mocks.getDocument).toHaveBeenCalledTimes(1)
      expect(result).not.toBeNull()
    })

    it('evicts the destroyed entry so a later capture does not retry it', async () => {
      const stale = makeDoc({ 1: makePage(595, 842) })
      setActivePdfDocument(stale as never, 'local-pdf://pdf_a', 'fp')
      stale.destroyed = true
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(595, 842) }))
      })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('does not reuse a registry entry registered for a different url', async () => {
      const other = makeDoc({ 1: makePage(595, 842) })
      setActivePdfDocument(other as never, 'local-pdf://pdf_b', 'fp')
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(595, 842) }))
      })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(other.getPage).not.toHaveBeenCalled()
      expect(mocks.getDocument).toHaveBeenCalledTimes(1)
    })
  })

  describe('self-loaded document', () => {
    it('loads through getDocument with the eval-based scripting flag disabled', async () => {
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(595, 842) }))
      })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(mocks.getDocument).toHaveBeenCalledWith({
        url: 'local-pdf://pdf_a',
        isEvalSupported: false
      })
    })

    it('renders the page and returns the blob, its object url and the pixel size', async () => {
      const page = makePage(595, 842)
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({ 1: page })) })
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

    it('destroys the document it loaded itself on the success path', async () => {
      const doc = makeDoc({ 1: makePage(595, 842) })
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc) })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      expect(doc.destroy).toHaveBeenCalledTimes(1)
    })

    it('destroys the document it loaded itself when getPage rejects', async () => {
      const doc = makeDoc({}) // page 1 absent, so getPage rejects
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc) })

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(doc.destroy).toHaveBeenCalledTimes(1)
    })

    it('destroys the document it loaded itself when toBlob yields no blob', async () => {
      const doc = makeDoc({ 1: makePage(595, 842) })
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc) })
      stubToBlob('null')

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(doc.destroy).toHaveBeenCalledTimes(1)
    })

    it('publishes the worker url on the self-load path only when it is unset', async () => {
      mocks.globalWorkerOptions.workerSrc = ''
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(10, 10) }))
      })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(mocks.globalWorkerOptions.workerSrc).toBe(mocks.workerUrl)
    })

    it('keeps an already-configured worker url instead of overwriting it', async () => {
      mocks.globalWorkerOptions.workerSrc = 'blob:already-configured'
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(10, 10) }))
      })

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(mocks.globalWorkerOptions.workerSrc).toBe('blob:already-configured')
    })

    it('also resolves the engine when the module exposes only named exports', async () => {
      // The other half of the production `default ?? module` shim: if the engine
      // ever ships real ESM (as pdfjs 6 does), the named exports must be used.
      // Toggling `default` on the already-mocked module keeps the module
      // registry untouched, so the remaining tests are unaffected.
      const engine = (await import('pdfjs-dist')) as unknown as Record<string, unknown>
      const original = Object.getOwnPropertyDescriptor(engine, 'default')
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(100, 100) }))
      })
      Object.defineProperty(engine, 'default', { value: undefined, configurable: true })
      try {
        const result = await renderPageToImageFallback('local-pdf://named', 1, { scale: 1 })

        expect(mocks.getDocument).toHaveBeenCalledWith({
          url: 'local-pdf://named',
          isEvalSupported: false
        })
        expect(result).toMatchObject({ width: 100, height: 100 })
      } finally {
        if (original) Object.defineProperty(engine, 'default', original)
      }
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
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({ 1: page })) })

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
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({ 1: page })) })

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
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({ 1: page })) })

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
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({ 7: page })) })

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
      mocks.getDocument.mockReturnValue({
        promise: Promise.resolve(makeDoc({ 1: makePage(1684, 2384) }))
      })

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 1
      })

      expect(result).toMatchObject({ width: 1, height: 1 })
    })
  })

  describe('fallback from the pdfjs render to the live viewer canvas', () => {
    it('clones the viewer canvas when the page render cannot run', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({})) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(300, 150))

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })

      // The clone is exactly 2x the on-screen canvas.
      expect(result).toMatchObject({ width: 600, height: 300 })
      expect(mocks.findPageCanvas).toHaveBeenCalledWith(1)
    })

    it('warns that the direct render failed before falling back', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({})) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(100, 100))

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('pdfjs direct render failed'),
        expect.anything()
      )
    })

    it('paints the clone white before drawing so transparent pages stay legible', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({})) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(100, 100))
      const { fillRect } = stubCanvasBackend()

      await renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 1 })

      expect(fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
    })

    it('applies the pixel budget to the clone as well', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({})) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(4000, 4000))

      const result = await renderPageToImageFallback('local-pdf://pdf_a', 1, {
        scale: 2,
        maxPixels: 1_000_000
      })

      expect(result!.width * result!.height).toBeLessThanOrEqual(1_000_000)
    })

    it('refuses to clone a zero-sized canvas', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(makeDoc({})) })
      mocks.findPageCanvas.mockReturnValue(makeMountedCanvas(0, 0))

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
    })

    it('falls through to the clone when the pdfjs canvas yields no blob', async () => {
      const doc = makeDoc({ 1: makePage(100, 100) })
      mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc) })
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
      // The self-loaded document was still torn down after the toBlob failure.
      expect(doc.destroy).toHaveBeenCalledTimes(1)
    })

    it('returns null rather than throwing when every rung fails', async () => {
      mocks.getDocument.mockReturnValue({ promise: Promise.reject(new Error('network down')) })
      mocks.findPageCanvas.mockReturnValue(null)

      await expect(
        renderPageToImageFallback('local-pdf://pdf_a', 1, { scale: 2 })
      ).resolves.toBeNull()
      expect(mocks.getDocument).toHaveBeenCalledTimes(1)
      expect(mocks.findPageCanvas).toHaveBeenCalledTimes(1)
    })
  })
})
