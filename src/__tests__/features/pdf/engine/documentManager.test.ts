/**
 * Unit tests for the document manager.
 *
 * The manager is the only owner of a native `PDFLoadingTask`, so these tests are
 * really about one question: after any sequence of operations, is exactly the
 * right task still alive and is nothing left pointing at a torn-down document?
 *
 * `getDocument` is mocked rather than used for real, because the manager's job is
 * ownership bookkeeping, not PDF parsing. The mock keeps the PDF.js shape that
 * matters — `getDocument(params) -> { promise, destroy() }` — so a change to the
 * engine's teardown strategy shows up here.
 */
import { createPdfDocumentManager } from '@features/pdf/engine/documentManager'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  initializeNativePdfWorker: vi.fn()
}))

vi.mock('pdfjs-dist', () => ({
  getDocument: mocks.getDocument
}))

vi.mock('@features/pdf/engine/pdfWorker', () => ({
  initializeNativePdfWorker: mocks.initializeNativePdfWorker
}))

/** A PDFDocumentProxy stand-in that records its own teardown. */
function makeDocument(numPages = 3) {
  return {
    numPages,
    destroyed: false,
    getPage: vi.fn(async (pageNumber: number) => ({ pageNumber })),
    cleanup: vi.fn(),
    destroy: vi.fn()
  }
}

interface TaskOptions {
  /** When false, destroying the task leaves its promise pending (see below). */
  abortOnDestroy?: boolean
}

/**
 * A PDFLoadingTask stand-in whose promise the test settles by hand.
 *
 * `abortOnDestroy: false` models the window where a teardown loses the race
 * against an already-settled promise. PDF.js normally rejects the in-flight
 * promise when the task is destroyed, but it can also resolve first — and the
 * manager has to be correct in both cases, so both are covered.
 */
function makeTask(documentPromise?: Promise<unknown>, options: TaskOptions = {}) {
  const abortOnDestroy = options.abortOnDestroy !== false
  let settle: ((doc: unknown) => void) | undefined
  let fail: ((err: unknown) => void) | undefined
  const promise =
    documentPromise ??
    new Promise<unknown>((resolve, reject) => {
      settle = resolve
      fail = reject
    })
  return {
    promise,
    destroy: vi.fn(() => {
      if (abortOnDestroy) fail?.(new Error('aborted by teardown'))
      return Promise.resolve()
    }),
    resolve: (doc: unknown) => settle?.(doc),
    reject: (err: unknown) => fail?.(err)
  }
}

function resolvedTask(doc: unknown) {
  return makeTask(Promise.resolve(doc))
}

describe('createPdfDocumentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads a document and exposes it as active', async () => {
    const doc = makeDocument()
    mocks.getDocument.mockReturnValue(resolvedTask(doc))
    const manager = createPdfDocumentManager()

    const loaded = await manager.load('local-pdf://a')

    expect(loaded).toBe(doc)
    expect(manager.getDocument()).toBe(doc)
    expect(manager.destroyed).toBe(false)
  })

  it('routes every load through the shared document options', async () => {
    mocks.getDocument.mockReturnValue(resolvedTask(makeDocument()))
    const manager = createPdfDocumentManager()

    await manager.load('local-pdf://a')

    expect(mocks.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'local-pdf://a', enableScripting: false })
    )
  })

  it('ensures the native worker is configured before the first load', async () => {
    mocks.getDocument.mockReturnValue(resolvedTask(makeDocument()))
    const manager = createPdfDocumentManager()

    await manager.load('local-pdf://a')

    expect(mocks.initializeNativePdfWorker).toHaveBeenCalled()
  })

  it('propagates a load failure and leaves no active document', async () => {
    const task = makeTask()
    mocks.getDocument.mockReturnValue(task)
    const manager = createPdfDocumentManager()

    const pending = manager.load('local-pdf://broken')
    task.reject(new Error('InvalidPDFException'))

    await expect(pending).rejects.toThrow('InvalidPDFException')
    expect(manager.getDocument()).toBeNull()
  })

  it('clears the slot on failure so a later load can retry', async () => {
    const failing = makeTask()
    mocks.getDocument.mockReturnValueOnce(failing)
    const manager = createPdfDocumentManager()

    const first = manager.load('local-pdf://broken')
    failing.reject(new Error('boom'))
    await expect(first).rejects.toThrow('boom')

    const doc = makeDocument()
    mocks.getDocument.mockReturnValueOnce(resolvedTask(doc))
    await expect(manager.load('local-pdf://a')).resolves.toBe(doc)
  })

  describe('replacing a document', () => {
    it('destroys the previous task when a new load starts', async () => {
      const first = resolvedTask(makeDocument())
      mocks.getDocument.mockReturnValueOnce(first).mockReturnValueOnce(resolvedTask(makeDocument()))
      const manager = createPdfDocumentManager()

      await manager.load('local-pdf://a')
      await manager.load('local-pdf://b')

      expect(first.destroy).toHaveBeenCalledTimes(1)
    })

    it('makes only the newest document active', async () => {
      const docA = makeDocument(1)
      const docB = makeDocument(2)
      mocks.getDocument
        .mockReturnValueOnce(resolvedTask(docA))
        .mockReturnValueOnce(resolvedTask(docB))
      const manager = createPdfDocumentManager()

      await manager.load('local-pdf://a')
      await manager.load('local-pdf://b')

      expect(manager.getDocument()).toBe(docB)
    })
  })

  describe('stale completion', () => {
    it('never lets a late-resolving load overwrite the active document', async () => {
      const slowA = makeTask(undefined, { abortOnDestroy: false })
      const docB = makeDocument(2)
      mocks.getDocument.mockReturnValueOnce(slowA).mockReturnValueOnce(resolvedTask(docB))
      const manager = createPdfDocumentManager()

      const pendingA = manager.load('local-pdf://a')
      await manager.load('local-pdf://b')
      expect(manager.getDocument()).toBe(docB)

      // A settles only now, after B is already live.
      slowA.resolve(makeDocument(1))
      await expect(pendingA).resolves.toBeNull()

      expect(manager.getDocument()).toBe(docB)
      // The stale task is torn down rather than left running.
      expect(slowA.destroy).toHaveBeenCalledTimes(1)
    })

    it('aborts an in-flight superseded load instead of letting it decode', async () => {
      const slowA = makeTask()
      const docB = makeDocument(2)
      mocks.getDocument.mockReturnValueOnce(slowA).mockReturnValueOnce(resolvedTask(docB))
      const manager = createPdfDocumentManager()

      const pendingA = manager.load('local-pdf://a')
      await manager.load('local-pdf://b')

      await expect(pendingA).rejects.toThrow('aborted by teardown')
      expect(slowA.destroy).toHaveBeenCalledTimes(1)
      expect(manager.getDocument()).toBe(docB)
    })
  })

  describe('reload', () => {
    it('re-loads the last requested source', async () => {
      const docA = makeDocument(1)
      const docB = makeDocument(2)
      mocks.getDocument.mockReturnValueOnce(resolvedTask(docA))
      const manager = createPdfDocumentManager()

      await manager.load('local-pdf://a')
      mocks.getDocument.mockReturnValueOnce(resolvedTask(docB))
      await manager.reload()

      expect(mocks.getDocument).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: 'local-pdf://a' })
      )
      expect(manager.getDocument()).toBe(docB)
    })

    it('destroys the task it replaced', async () => {
      const first = resolvedTask(makeDocument())
      mocks.getDocument.mockReturnValueOnce(first)
      const manager = createPdfDocumentManager()

      await manager.load('local-pdf://a')
      mocks.getDocument.mockReturnValueOnce(resolvedTask(makeDocument()))
      await manager.reload()

      expect(first.destroy).toHaveBeenCalledTimes(1)
    })

    it('refuses to reload before anything has been loaded', async () => {
      const manager = createPdfDocumentManager()

      await expect(manager.reload()).rejects.toThrow('before any load')
    })
  })

  describe('pages', () => {
    it('serves a page from the active document', async () => {
      const doc = makeDocument()
      mocks.getDocument.mockReturnValue(resolvedTask(doc))
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      await manager.getPage(2)

      expect(doc.getPage).toHaveBeenCalledWith(2)
    })

    it('caches pages within one document', async () => {
      const doc = makeDocument()
      mocks.getDocument.mockReturnValue(resolvedTask(doc))
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      await manager.getPage(2)
      await manager.getPage(2)

      expect(doc.getPage).toHaveBeenCalledTimes(1)
    })

    it('does not serve pages from a document that has been replaced', async () => {
      const docA = makeDocument(1)
      mocks.getDocument.mockReturnValueOnce(resolvedTask(docA))
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      const docB = makeDocument(2)
      mocks.getDocument.mockReturnValueOnce(resolvedTask(docB))
      await manager.load('local-pdf://b')

      await manager.getPage(1)
      expect(docA.getPage).not.toHaveBeenCalled()
      expect(docB.getPage).toHaveBeenCalledWith(1)
    })

    it('refuses to serve pages with no active document', async () => {
      const manager = createPdfDocumentManager()

      await expect(manager.getPage(1)).rejects.toThrow('no active document')
    })
  })

  describe('destroy', () => {
    it('destroys the active task and drops the document', async () => {
      const task = resolvedTask(makeDocument())
      mocks.getDocument.mockReturnValue(task)
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      manager.destroy()

      expect(task.destroy).toHaveBeenCalledTimes(1)
      expect(manager.getDocument()).toBeNull()
      expect(manager.destroyed).toBe(true)
    })

    it('is idempotent and does not double-destroy', async () => {
      const task = resolvedTask(makeDocument())
      mocks.getDocument.mockReturnValue(task)
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      expect(() => {
        manager.destroy()
        manager.destroy()
        manager.destroy()
      }).not.toThrow()

      expect(task.destroy).toHaveBeenCalledTimes(1)
    })

    it('invalidates a load that is still in flight', async () => {
      const slow = makeTask()
      mocks.getDocument.mockReturnValue(slow)
      const manager = createPdfDocumentManager()

      const pending = manager.load('local-pdf://slow')
      manager.destroy()

      // The abort reaches the pending promise, so the caller is told the load did
      // not complete rather than being handed a dead document.
      await expect(pending).rejects.toThrow('aborted by teardown')
      expect(manager.getDocument()).toBeNull()
    })

    it('discards a load that resolves after teardown when the abort is lost', async () => {
      const slow = makeTask(undefined, { abortOnDestroy: false })
      mocks.getDocument.mockReturnValue(slow)
      const manager = createPdfDocumentManager()

      const pending = manager.load('local-pdf://slow')
      manager.destroy()
      slow.resolve(makeDocument())

      await expect(pending).resolves.toBeNull()
      expect(manager.getDocument()).toBeNull()
      expect(slow.destroy).toHaveBeenCalledTimes(1)
    })

    it('refuses further loads after teardown', async () => {
      mocks.getDocument.mockReturnValue(resolvedTask(makeDocument()))
      const manager = createPdfDocumentManager()
      manager.destroy()

      await expect(manager.load('local-pdf://a')).rejects.toThrow('after destroy')
      expect(mocks.getDocument).not.toHaveBeenCalled()
    })

    it('survives a task whose destroy rejects', async () => {
      const task = resolvedTask(makeDocument())
      task.destroy.mockRejectedValueOnce(new Error('worker already gone'))
      mocks.getDocument.mockReturnValue(task)
      const manager = createPdfDocumentManager()
      await manager.load('local-pdf://a')

      expect(() => manager.destroy()).not.toThrow()
      expect(manager.getDocument()).toBeNull()
    })
  })
})
