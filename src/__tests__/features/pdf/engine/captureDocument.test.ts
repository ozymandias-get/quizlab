/**
 * The native capture-document adapter and its temporary document load.
 *
 * Two things are under test, and both are about ownership rather than rendering:
 *
 *  1. **Liveness.** PDF.js 6 removed `PDFDocumentProxy#destroyed` and `#destroy()`,
 *     so a capture handle cannot ask the proxy whether it is still usable. It asks
 *     the *manager* whether it still holds that document — which is false across a
 *     reload, a document switch and a teardown, without any version-specific flag.
 *  2. **The temporary load.** When nothing is mounted to borrow, capture loads one
 *     document for itself and must destroy it through its **loading task**. The
 *     real `createPdfDocumentManager` runs here, so `loadingTask.destroy()` — the
 *     PDF.js 6 teardown call — is what actually gets asserted, and `getDocument`
 *     is checked for the security and asset policy the engine owns.
 *
 * `pdfjs-dist` is the only thing faked: `getDocument` and the `GlobalWorkerOptions`
 * object the worker bootstrap writes to.
 */
import { createPdfDocumentManager } from '@features/pdf/engine/documentManager'
import {
  createNativeCaptureHandle,
  loadTemporaryCaptureDocument
} from '@features/pdf/engine/captureDocument'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', () => ({
  getDocument: mocks.getDocument,
  RenderingCancelledException: class RenderingCancelledException extends Error {
    constructor(message = 'Rendering cancelled') {
      super(message)
      this.name = 'RenderingCancelledException'
    }
  }
}))

vi.mock('@features/pdf/engine/pdfWorker', () => ({
  initializeNativePdfWorker: mocks.initializeNativePdfWorker,
  nativeWorkerUrl: 'pdf.worker.min.test.mjs',
  resetNativePdfWorkerForTests: vi.fn()
}))

/** A `PDFDocumentProxy` stand-in, with the page proxy shape capture touches. */
function makeDocument(numPages = 3) {
  const pages = new Map<number, unknown>()
  return {
    numPages,
    getPage: vi.fn(async (pageNumber: number) => {
      if (pageNumber > numPages) throw new Error(`no page ${pageNumber}`)
      const cached = pages.get(pageNumber)
      if (cached) return cached
      const page = {
        pageNumber,
        getViewport: ({ scale }: { scale: number }) => ({
          width: 400 * scale,
          height: 600 * scale
        }),
        render: vi.fn(({ canvasContext }: { canvasContext: { canvas: HTMLCanvasElement } }) => ({
          promise: Promise.resolve(),
          cancel: vi.fn(),
          canvas: canvasContext.canvas
        }))
      }
      pages.set(pageNumber, page)
      return page
    })
  }
}

/** A `PDFLoadingTask` stand-in that records its own teardown. */
function makeTask(document: unknown) {
  return {
    promise: Promise.resolve(document),
    destroy: vi.fn(() => Promise.resolve())
  }
}

let lastTask: ReturnType<typeof makeTask> | null = null

beforeEach(() => {
  vi.clearAllMocks()
  lastTask = null
  mocks.getDocument.mockImplementation(() => {
    lastTask = makeTask(makeDocument())
    return lastTask
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('loadTemporaryCaptureDocument', () => {
  it("loads through the engine, so the document options are the engine's", async () => {
    await loadTemporaryCaptureDocument('local-pdf://book')

    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
    const options = mocks.getDocument.mock.calls[0][0] as Record<string, unknown>
    expect(options.url).toBe('local-pdf://book')
    // PDF JavaScript actions stay disabled, and the four asset directories are
    // the packaged pdfjs-dist ones. Both come from `createPdfDocumentOptions`, which
    // is why this module never builds a parameter object of its own.
    expect(options.enableScripting).toBe(false)
    expect(options.cMapUrl).toContain('pdfjs/cmaps/')
    expect(options.standardFontDataUrl).toContain('pdfjs/standard_fonts/')
    expect(options.wasmUrl).toContain('pdfjs/wasm/')
    expect(options.iccUrl).toContain('pdfjs/iccs/')
    // `isEvalSupported` was removed in pdf.js 4.x; it must not reappear here.
    expect('isEvalSupported' in options).toBe(false)
  })

  it('bootstraps the native worker, so the temporary document uses the one worker source', async () => {
    await loadTemporaryCaptureDocument('local-pdf://book')

    expect(mocks.initializeNativePdfWorker).toHaveBeenCalled()
  })

  it('destroys the loading task on release — the PDF.js 6 teardown path', async () => {
    const temporary = await loadTemporaryCaptureDocument('local-pdf://book')
    const task = lastTask!

    expect(task.destroy).not.toHaveBeenCalled()

    temporary.release()

    // Not the document: PDF.js 6 removed `PDFDocumentProxy#destroy()`. The task
    // owns the document and the worker, so this is the whole boundary.
    expect(task.destroy).toHaveBeenCalledTimes(1)
  })

  it('is safe to release twice', async () => {
    const temporary = await loadTemporaryCaptureDocument('local-pdf://book')

    temporary.release()
    temporary.release()

    expect(lastTask!.destroy).toHaveBeenCalledTimes(1)
  })

  it('leaves the handle dead after release, so a late reader cannot use it', async () => {
    const temporary = await loadTemporaryCaptureDocument('local-pdf://book')

    expect(temporary.handle.isAlive()).toBe(true)
    temporary.release()
    expect(temporary.handle.isAlive()).toBe(false)
  })

  it('propagates a failed load without leaking a task', async () => {
    mocks.getDocument.mockImplementation(() => {
      lastTask = makeTask(makeDocument())
      return {
        ...lastTask,
        promise: Promise.reject(new Error('bad file'))
      }
    })

    await expect(loadTemporaryCaptureDocument('local-pdf://book')).rejects.toThrow('bad file')
    expect(lastTask!.destroy).not.toHaveBeenCalled()
  })
})

describe('createNativeCaptureHandle', () => {
  it('reuses the manager page cache rather than a second decode', async () => {
    const manager = createPdfDocumentManager()
    const document = await manager.load('local-pdf://book')
    const handle = createNativeCaptureHandle(manager, document!)

    await handle.getPage(2)
    await handle.getPage(2)

    // `PDFDocumentProxy.getPage` is memoised by PDF.js and the engine caches it on
    // top; capture must ride that cache, not open its own.
    expect(document!.getPage).toHaveBeenCalledTimes(1)
    expect(document!.getPage).toHaveBeenCalledWith(2)
  })

  it('narrows a page to the two calls capture makes', async () => {
    const manager = createPdfDocumentManager()
    const document = await manager.load('local-pdf://book')
    const handle = createNativeCaptureHandle(manager, document!)

    const page = await handle.getPage(1)

    expect(Object.keys(page).sort()).toEqual(['getViewport', 'render'])
    expect(page.getViewport({ scale: 2 })).toMatchObject({ width: 800, height: 1200 })
  })

  it('is alive exactly while the manager still holds that document', async () => {
    const manager = createPdfDocumentManager()
    const document = await manager.load('local-pdf://book')
    const handle = createNativeCaptureHandle(manager, document!)

    expect(handle.isAlive()).toBe(true)

    manager.destroy()

    expect(handle.isAlive()).toBe(false)
  })

  it('goes dead as soon as the manager starts loading a new generation', async () => {
    // The reload race: `load()` disposes the previous task before starting the
    // next one, so the old document is already unreachable when the new load
    // begins. A capture holding the old handle must not use it.
    const manager = createPdfDocumentManager()
    const first = await manager.load('local-pdf://book')
    const handle = createNativeCaptureHandle(manager, first!)
    expect(handle.isAlive()).toBe(true)

    const secondLoad = manager.load('local-pdf://book')
    await secondLoad

    expect(handle.isAlive()).toBe(false)
  })

  it('goes dead when the manager has moved on to a different document', async () => {
    const manager = createPdfDocumentManager()
    const first = await manager.load('local-pdf://book')
    const handle = createNativeCaptureHandle(manager, first!)

    await manager.load('local-pdf://other')

    expect(handle.isAlive()).toBe(false)
  })

  it('reports dead when the manager never loaded the document it was given', async () => {
    // Defensive: a handle is only ever built after a successful load, so this
    // cannot happen in production. Asserted because the answer has to be
    // "cannot be used" rather than "ask the proxy" — the proxy here is not the
    // manager's, and answering true would send capture into a dead document.
    const manager = createPdfDocumentManager()
    const foreign = makeDocument()

    const handle = createNativeCaptureHandle(manager, foreign as never)

    expect(handle.isAlive()).toBe(false)
  })
})
