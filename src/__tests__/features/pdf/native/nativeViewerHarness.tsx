/**
 * Shared test harness for the native canvas viewer.
 *
 * ## What is real and what is faked
 *
 * The **real** engine is under test: `createPdfDocumentManager`,
 * `createPageCache` and `createPageRenderer` run as production code, so the
 * generation guard, the page cache and — most importantly — the supersede-cancel
 * behaviour in `pageRenderer.ts` are the real thing. Only the `pdfjs-6`
 * boundary is faked: `getDocument` and the typed `RenderingCancelledException`,
 * plus the worker bootstrap that would otherwise pull a real worker URL.
 *
 * That split is deliberate. A viewer test that mocked the engine would prove only
 * that the viewer calls its collaborators; faking PDF.js instead means the viewer
 * is tested against a faithful `PDFLoadingTask` / `PDFPageProxy` / `RenderTask`
 * shape, including a `RenderTask.cancel()` that actually rejects its promise with
 * `RenderingCancelledException`.
 */
import { useNativePdfController } from '@features/pdf/native/useNativePdfController'
import NativePdfViewer from '@features/pdf/ui/components/NativePdfViewer'

import { useRef } from 'react'
import { vi } from 'vitest'

export class CancelledRenderError extends Error {
  constructor(message = 'Rendering cancelled, page 1') {
    super(message)
    this.name = 'RenderingCancelledException'
  }
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/* ------------------------------------------------------------------ render */

export interface FakeRenderTask {
  promise: Promise<void>
  cancel: () => void
  resolve: () => void
  reject: (error: unknown) => void
  cancelled: () => boolean
}

/**
 * A `RenderTask` whose promise the test settles, and whose `cancel()` rejects it
 * with the typed cancellation error — the same thing PDF.js does.
 *
 * With `settleImmediately` the promise resolves on a microtask, which is what a
 * real render does; without it the test drives the settlement itself.
 */
function createRenderTask(settleImmediately: boolean): FakeRenderTask {
  const deferred = createDeferred<void>()
  let cancelled = false
  const task: FakeRenderTask = {
    promise: deferred.promise,
    cancel: () => {
      if (cancelled) return
      cancelled = true
      deferred.reject(new CancelledRenderError())
    },
    resolve: () => deferred.resolve(),
    reject: (error: unknown) => deferred.reject(error),
    cancelled: () => cancelled
  }
  if (settleImmediately) queueMicrotask(() => task.resolve())
  return task
}

export interface FakeRenderCall {
  pageNumber: number
  scale: number
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export interface FakePage {
  pageNumber: number
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number
    height: number
    rotation: number
    scale: number
  }
  render: (params: {
    canvas: HTMLCanvasElement
    viewport: { width: number; height: number; scale: number }
  }) => FakeRenderTask
  renderCalls: FakeRenderCall[]
  tasks: FakeRenderTask[]
  /** Settle the most recent render's promise. */
  settleLastRender: () => void
  /** Fail the most recent render's promise with a real error. */
  failLastRender: (message: string) => void
}

/* ---------------------------------------------------------------- document */

export interface FakeDocument {
  numPages: number
  getPageCalls: number[]
  getPage: (pageNumber: number) => Promise<FakePage>
  /** The (memoised) page object for `pageNumber`, as PDF.js caches it. */
  page: (pageNumber: number) => FakePage
  /** Every render call made against any page of this document. */
  renderCallsForAllPages: FakeRenderCall[]
}

export interface CreateDocumentOptions {
  numPages: number
  width?: number
  height?: number
  /** Settle renders on a microtask (default) or leave them to the test. */
  settleRenders?: boolean
  /** Replace page lookup, e.g. to make one page slow or to fail it. */
  getPage?: (pageNumber: number) => Promise<FakePage>
}

export function createFakeDocument(options: CreateDocumentOptions): FakeDocument {
  const width = options.width ?? 400
  const height = options.height ?? 600
  const settleRenders = options.settleRenders ?? true
  const pages = new Map<number, FakePage>()
  const getPageCalls: number[] = []

  function makePage(pageNumber: number): FakePage {
    const renderCalls: FakeRenderCall[] = []
    const tasks: FakeRenderTask[] = []
    return {
      pageNumber,
      getViewport: ({ scale, rotation }) => {
        const swap = rotation !== undefined && Math.abs(rotation % 180) === 90
        return {
          width: (swap ? height : width) * scale,
          height: (swap ? width : height) * scale,
          rotation: rotation ?? 0,
          scale
        }
      },
      render: (params) => {
        const task = createRenderTask(settleRenders)
        tasks.push(task)
        renderCalls.push({
          pageNumber,
          scale: params.viewport.scale,
          canvas: params.canvas,
          width: params.viewport.width,
          height: params.viewport.height
        })
        return task
      },
      renderCalls,
      tasks,
      settleLastRender: () => tasks[tasks.length - 1]?.resolve(),
      failLastRender: (message: string) => tasks[tasks.length - 1]?.reject(new Error(message))
    }
  }

  /** Memoised, exactly like `PDFDocumentProxy.getPage`. */
  function page(pageNumber: number): FakePage {
    const cached = pages.get(pageNumber)
    if (cached) return cached
    const created = makePage(pageNumber)
    pages.set(pageNumber, created)
    return created
  }

  return {
    numPages: options.numPages,
    getPageCalls,
    page,
    getPage: (pageNumber: number) => {
      getPageCalls.push(pageNumber)
      if (options.getPage) return options.getPage(pageNumber)
      return Promise.resolve(page(pageNumber))
    },
    get renderCallsForAllPages(): FakeRenderCall[] {
      return [...pages.values()].flatMap((p) => p.renderCalls)
    }
  }
}

/* ------------------------------------------------------------ loading task */

export interface FakeLoadingTask {
  promise: Promise<unknown>
  destroy: ReturnType<typeof vi.fn>
  resolve: (document: unknown) => void
  reject: (error: unknown) => void
}

/**
 * A `PDFLoadingTask` whose promise the test settles.
 *
 * `abortOnDestroy: false` models the real window that makes the document-switch
 * race meaningful: `destroy()` stops the network work, but a promise that has
 * already settled can still resolve afterwards. The engine's generation guard has
 * to be correct then too, not only when the promise is rejected.
 */
export function createLoadingTask(options: { abortOnDestroy?: boolean } = {}): FakeLoadingTask {
  const deferred = createDeferred<unknown>()
  const abortOnDestroy = options.abortOnDestroy ?? true
  return {
    promise: deferred.promise,
    resolve: deferred.resolve,
    reject: deferred.reject,
    destroy: vi.fn(() => {
      if (abortOnDestroy) deferred.reject(new Error('Worker was destroyed'))
      return Promise.resolve()
    })
  }
}

/* -------------------------------------------------------------- test double */

/** A PDF.js stand-in whose loading task settles only when the test says so. */
export class DeferredDocument {
  readonly task: FakeLoadingTask
  private document: FakeDocument

  constructor(document: FakeDocument, options: { abortOnDestroy?: boolean } = {}) {
    this.document = document
    this.task = createLoadingTask(options)
  }

  /** Hand the document to the engine, as a completed `getDocument().promise`. */
  settle(): void {
    this.task.resolve(this.document)
  }

  fail(message: string): void {
    this.task.reject(new Error(message))
  }

  get pdfDocument(): FakeDocument {
    return this.document
  }
}

/* ---------------------------------------------------------------- harness */

export interface HarnessProps {
  enabled?: boolean
  pdfUrl?: string
  reloadKey?: number
  initialPage?: number
  isPanMode?: boolean
  isPanelResizing?: boolean
  containerSize?: { w: number; h: number }
  onController?: (controller: ReturnType<typeof useNativePdfController>) => void
}

/**
 * Mounts the native viewer the way `PdfViewerDocument` does: a shared container
 * that owns the wheel and resize listeners, plus the presentational component
 * that owns the canvas.
 */
export function NativeViewerHarness({
  enabled = true,
  pdfUrl = 'local-pdf://a',
  reloadKey = 0,
  initialPage,
  isPanMode = false,
  isPanelResizing = false,
  containerSize = { w: 800, h: 1000 },
  onController
}: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const controller = useNativePdfController({
    enabled,
    pdfUrl,
    reloadKey,
    initialPage,
    containerRef,
    adjustedContainerSize: containerSize,
    isPanMode,
    isPanelResizing,
    pdfPath: null,
    canvasRef
  })

  onController?.(controller)

  const t = (key: string) => key

  return (
    <div ref={containerRef} data-testid="native-container">
      <NativePdfViewer controller={controller} canvasRef={canvasRef} t={t} tt={t} />
    </div>
  )
}
