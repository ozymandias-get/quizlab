/**
 * Shared test harness for the native canvas viewer.
 *
 * ## What is real and what is faked
 *
 * The **real** engine is under test: `createPdfDocumentManager`,
 * `createPageCache` and `createPageRenderer` run as production code, so the
 * generation guard, the page cache and — most importantly — the supersede-cancel
 * behaviour in `pageRenderer.ts` are the real thing. Only the `pdfjs-6`
 * boundary is faked: `getDocument`, the typed `RenderingCancelledException`,
 * `TextLayer`, `AnnotationLayer`, and the worker bootstrap that would otherwise pull a
 * real worker URL.
 *
 * That split is deliberate. A viewer test that mocked the engine would prove only
 * that the viewer calls its collaborators; faking PDF.js instead means the viewer
 * is tested against a faithful `PDFLoadingTask` / `PDFPageProxy` / `RenderTask` /
 * `TextLayer` / `AnnotationLayer` shape, including a `RenderTask.cancel()` that
 * actually rejects its promise with `RenderingCancelledException` and a
 * `TextLayer.cancel()` that actually rejects `render()` with an `AbortException`.
 *
 * The document double also carries what a link needs to be resolvable: `getAnnotations`,
 * plus the document-level `getDestination` / `getPageIndex` / `cachedPageNumber` the
 * link service reads. The link service itself is never faked — a test clicks the anchor
 * PDF.js's markup would have produced and the real adapter handles it.
 */
import { useNativePdfController } from '@features/pdf/native/useNativePdfController'
import { usePdfTextActions } from '@features/pdf/text/usePdfTextActions'
import type { SelectionPosition } from '@features/pdf/text/types'
import NativePdfViewer from '@features/pdf/ui/components/NativePdfViewer'

import { useRef } from 'react'
import { vi } from 'vitest'

import type { FakeAnnotation } from './nativeAnnotationLayerDouble'
import type { FakeTextContent } from './nativeTextLayerDouble'

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

export interface FakeGetTextContentCall {
  pageNumber: number
}

export interface FakeGetAnnotationsCall {
  pageNumber: number
  intent: string | undefined
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
  getTextContent: () => Promise<FakeTextContent>
  getAnnotations: (params?: { intent?: string }) => Promise<FakeAnnotation[]>
  renderCalls: FakeRenderCall[]
  tasks: FakeRenderTask[]
  getTextContentCalls: FakeGetTextContentCall[]
  getAnnotationsCalls: FakeGetAnnotationsCall[]
  /** Settle the most recent render's promise. */
  settleLastRender: () => void
  /** Fail the most recent render's promise with a real error. */
  failLastRender: (message: string) => void
  /** Settle the most recent `getTextContent()` call. */
  settleLastTextContent: () => void
  /** Fail the most recent `getTextContent()` call. */
  failLastTextContent: (message: string) => void
  /** Settle the most recent `getAnnotations()` call. */
  settleLastAnnotations: () => void
  /** Fail the most recent `getAnnotations()` call. */
  failLastAnnotations: (message: string) => void
  /**
   * Settle every outstanding `getAnnotations()` call on this page.
   *
   * The fit scale lands a frame after the first render, so one page usually has more
   * than one pending lookup and only the newest one belongs to a live effect; a race
   * test wants all of them to land late, not just the last.
   */
  settleAllAnnotations: () => void
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
  /** `PDFDocumentProxy.getDestination` — the named-destination lookup. */
  getDestination: (id: string) => Promise<unknown[] | null>
  /** `PDFDocumentProxy.getPageIndex` — resolves an indirect ref to a 0-based index. */
  getPageIndex: (ref: unknown) => Promise<number>
  /** `PDFDocumentProxy.cachedPageNumber` — the fast path, or `null`. */
  cachedPageNumber: (ref: unknown) => number | null
}

export interface CreateDocumentOptions {
  numPages: number
  width?: number
  height?: number
  /** Page rotation in degrees, so the viewport's rotation can be asserted. */
  rotation?: number
  /** Settle renders on a microtask (default) or leave them to the test. */
  settleRenders?: boolean
  /** Settle `getTextContent()` on a microtask (default) or leave it to the test. */
  settleTextContent?: boolean
  /** Settle `getAnnotations()` on a microtask (default) or leave it to the test. */
  settleAnnotations?: boolean
  /** Text items each page reports, as one text run per string. */
  textItems?: Record<number, string[]>
  /** Annotations each page reports, keyed by 1-based page number. */
  annotations?: Record<number, FakeAnnotation[]>
  /**
   * Named destinations, by name. `null` models a name the document does not have,
   * which is the "broken destination" case a link click has to survive.
   */
  destinations?: Record<string, unknown[] | null>
  /**
   * Indirect page references and the 0-based page index each resolves to — the
   * `[ref, { name: 'XYZ' }, …]` destination shape. `null` models a ref that cannot
   * be resolved at all. Keyed by identity, the way PDF.js keys a page ref.
   */
  pageRefs?: Map<unknown, number | null>
  /** Replace page lookup, e.g. to make one page slow or to fail it. */
  getPage?: (pageNumber: number) => Promise<FakePage>
}

export function createFakeDocument(options: CreateDocumentOptions): FakeDocument {
  const width = options.width ?? 400
  const height = options.height ?? 600
  const rotation = options.rotation ?? 0
  const settleRenders = options.settleRenders ?? true
  const settleTextContent = options.settleTextContent ?? true
  const settleAnnotations = options.settleAnnotations ?? true
  const destinations = options.destinations ?? {}
  const pageRefs = options.pageRefs ?? new Map()
  const pages = new Map<number, FakePage>()
  const getPageCalls: number[] = []

  function textContentFor(pageNumber: number): FakeTextContent {
    return {
      items: (options.textItems?.[pageNumber] ?? []).map((str) => ({ str })),
      styles: {},
      lang: null
    }
  }

  function annotationsFor(pageNumber: number): FakeAnnotation[] {
    return options.annotations?.[pageNumber] ?? []
  }

  function makePage(pageNumber: number): FakePage {
    const renderCalls: FakeRenderCall[] = []
    const tasks: FakeRenderTask[] = []
    const getTextContentCalls: FakeGetTextContentCall[] = []
    const textContentDeferreds: Deferred<FakeTextContent>[] = []
    const getAnnotationsCalls: FakeGetAnnotationsCall[] = []
    const annotationDeferreds: Deferred<FakeAnnotation[]>[] = []
    return {
      pageNumber,
      getViewport: ({ scale }) => {
        const swap = Math.abs(rotation % 180) === 90
        return {
          width: (swap ? height : width) * scale,
          height: (swap ? width : height) * scale,
          rotation,
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
      getTextContent: () => {
        getTextContentCalls.push({ pageNumber })
        const deferred = createDeferred<FakeTextContent>()
        textContentDeferreds.push(deferred)
        if (settleTextContent) queueMicrotask(() => deferred.resolve(textContentFor(pageNumber)))
        return deferred.promise
      },
      getAnnotations: (params) => {
        getAnnotationsCalls.push({ pageNumber, intent: params?.intent })
        const deferred = createDeferred<FakeAnnotation[]>()
        annotationDeferreds.push(deferred)
        if (settleAnnotations) {
          queueMicrotask(() => deferred.resolve(annotationsFor(pageNumber)))
        }
        return deferred.promise
      },
      renderCalls,
      tasks,
      getTextContentCalls,
      getAnnotationsCalls,
      settleLastRender: () => tasks[tasks.length - 1]?.resolve(),
      failLastRender: (message: string) => tasks[tasks.length - 1]?.reject(new Error(message)),
      settleLastTextContent: () =>
        textContentDeferreds[textContentDeferreds.length - 1]?.resolve(textContentFor(pageNumber)),
      failLastTextContent: (message: string) =>
        textContentDeferreds[textContentDeferreds.length - 1]?.reject(new Error(message)),
      settleLastAnnotations: () =>
        annotationDeferreds[annotationDeferreds.length - 1]?.resolve(annotationsFor(pageNumber)),
      failLastAnnotations: (message: string) =>
        annotationDeferreds[annotationDeferreds.length - 1]?.reject(new Error(message)),
      settleAllAnnotations: () => {
        for (const deferred of annotationDeferreds) {
          deferred.resolve(annotationsFor(pageNumber))
        }
      }
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
    },
    async getDestination(id: string) {
      return Object.hasOwn(destinations, id) ? destinations[id] : null
    },
    async getPageIndex(ref: unknown) {
      const index = pageRefs.get(ref)
      if (index === undefined || index === null) {
        throw new Error('fake document has no such page ref')
      }
      return index
    },
    cachedPageNumber: (ref: unknown) => {
      // Mirrors `PDFDocumentProxy.cachedPageNumber`: 1-based, or `null` when the ref
      // is not in the page cache.
      const index = pageRefs.get(ref)
      if (index === undefined || index === null) return null
      const pageNumber = index + 1
      return pages.has(pageNumber) ? pageNumber : null
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

/* ------------------------------------------------------------------ harness */

export interface HarnessProps {
  enabled?: boolean
  pdfUrl?: string
  reloadKey?: number
  initialPage?: number
  isPanMode?: boolean
  isPanelResizing?: boolean
  containerSize?: { w: number; h: number }
  onController?: (controller: ReturnType<typeof useNativePdfController>) => void
  /**
   * Mount the real, shared `usePdfTextActions` against the same container, the
   * way `PdfViewerDocument` does. Left out by default so the canvas tests are not
   * paying for document-level listeners they never touch.
   */
  textActions?: {
    onTextSelection?: (text: string, position: SelectionPosition | null) => void
    onTextExtracted?: (text: string) => void
    onNoTextFound?: () => void
    enabled?: boolean
  }
}

/**
 * Mounts the native viewer the way `PdfViewerDocument` does: a shared container
 * that owns the wheel, resize and selection listeners, plus the presentational
 * component that owns the canvas and the text layer.
 */
export function NativeViewerHarness({
  enabled = true,
  pdfUrl = 'local-pdf://a',
  reloadKey = 0,
  initialPage,
  isPanMode = false,
  isPanelResizing = false,
  containerSize = { w: 800, h: 1000 },
  onController,
  textActions
}: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const annotationLayerRef = useRef<HTMLDivElement>(null)

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
    canvasRef,
    textLayerRef,
    annotationLayerRef
  })

  // The real shared hook, on the real shared container. This is the whole point
  // of Phase 5: there is no second selection system, only one hook that resolves
  // whichever text layer is mounted.
  const { extractCurrentPageText } = usePdfTextActions({
    containerRef,
    currentPage: controller.currentPage,
    onTextSelection: textActions?.onTextSelection,
    onTextExtracted: textActions?.onTextExtracted,
    onNoTextFound: textActions?.onNoTextFound,
    textSelectionEnabled: textActions?.enabled ?? false
  })

  onController?.(controller)

  const t = (key: string) => key

  return (
    <div ref={containerRef} data-testid="native-container">
      <NativePdfViewer
        controller={controller}
        canvasRef={canvasRef}
        textLayerRef={textLayerRef}
        annotationLayerRef={annotationLayerRef}
        t={t}
        tt={t}
      />
      {textActions ? (
        <span data-testid="native-extract-trigger" onClick={() => extractCurrentPageText()} />
      ) : null}
    </div>
  )
}
