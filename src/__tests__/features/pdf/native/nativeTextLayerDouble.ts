/**
 * The `pdfjs-dist` `TextLayer` test double.
 *
 * It lives in its own module — importing nothing — because a `vi.mock` factory is
 * hoisted above the test file's imports, so it cannot close over a binding that
 * the harness (which itself imports the mocked module, transitively) provides.
 * A dependency-free module is the one shape that survives hoisting.
 *
 * It is faithful to the parts the viewer relies on:
 *
 *  - constructed with `{ textContentSource, container, viewport }`
 *  - `render()` appends one `<span role="presentation">` per text item to that
 *    container, the way PDF.js's stream pump does on the first chunk, and
 *    resolves on a microtask
 *  - `cancel()` rejects the in-flight `render()` with an `AbortException`, and a
 *    second call is a no-op
 *
 * The geometry it writes is deliberately *not* PDF.js's. jsdom has no layout, so
 * what a test can honestly observe is the lifecycle, the DOM contract and the
 * arguments — not glyph positions.
 */

/** PDF.js's own cancellation signal for a text layer. */
export class CancelledTextLayerError extends Error {
  constructor(message = 'TextLayer task cancelled.') {
    super(message)
    this.name = 'AbortException'
  }
}

/** The `page.getTextContent()` result the double understands. */
export interface FakeTextContent {
  items: { str: string }[]
  styles: Record<string, unknown>
  lang: string | null
}

/** One recorded `new TextLayer(...)`, with the arguments flattened for assertions. */
export interface FakeTextLayerCall {
  container: HTMLElement
  scale: number
  width: number
  height: number
  rotation: number
  items: { str: string }[]
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export class FakeTextLayer {
  /** Every construction, in order. */
  static calls: FakeTextLayerCall[] = []
  /** Every construction, kept live so a test can inspect one. */
  static instances: FakeTextLayer[] = []
  /**
   * Whether `render()` resolves on a microtask. Turn it off to hold a render open
   * so a test can supersede it — which is the only way to observe the real
   * `cancel() → render() rejects` path.
   */
  static autoResolve = true

  static reset(): void {
    FakeTextLayer.calls = []
    FakeTextLayer.instances = []
    FakeTextLayer.autoResolve = true
  }

  private cancelled = false
  private readonly deferred = createDeferred<void>()
  private readonly call: FakeTextLayerCall

  constructor(params: {
    textContentSource: FakeTextContent
    container: HTMLElement
    viewport: { scale: number; width: number; height: number; rotation: number }
  }) {
    this.call = {
      container: params.container,
      scale: params.viewport.scale,
      width: params.viewport.width,
      height: params.viewport.height,
      rotation: params.viewport.rotation,
      items: params.textContentSource.items
    }
    FakeTextLayer.calls.push(this.call)
    FakeTextLayer.instances.push(this)
  }

  render(): Promise<void> {
    for (const item of this.call.items) {
      // Guarded the way PDF.js's own pump is: a cancelled layer stops appending.
      if (this.cancelled) break
      const span = document.createElement('span')
      span.setAttribute('role', 'presentation')
      span.textContent = item.str
      this.call.container.append(span)
    }
    if (FakeTextLayer.autoResolve) {
      queueMicrotask(() => {
        if (!this.cancelled) this.deferred.resolve()
      })
    }
    return this.deferred.promise
  }

  cancel(): void {
    if (this.cancelled) return
    this.cancelled = true
    this.deferred.reject(new CancelledTextLayerError())
  }

  /** Present so the shape matches TextLayer; the viewer never calls update(). */
  update(): void {}

  isCancelled(): boolean {
    return this.cancelled
  }
}
