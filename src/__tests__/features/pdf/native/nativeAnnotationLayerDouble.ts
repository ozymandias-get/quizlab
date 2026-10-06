/**
 * The `pdfjs-dist` `AnnotationLayer` test double.
 *
 * It lives in its own dependency-free module for the same reason as
 * `nativeTextLayerDouble`: a `vi.mock` factory is hoisted above the test file's
 * imports, so it cannot close over a binding the harness — which itself imports the
 * mocked module, transitively — provides.
 *
 * ## What it is faithful about
 *
 * The part that matters is the **link markup**, because the link service is only
 * reachable through the DOM PDF.js builds. `LinkAnnotationElement.render()` in
 * `build/pdf.mjs` is reproduced as written:
 *
 *  - a `section[data-annotation-id]` per annotation, classed `linkAnnotation`
 *  - one `<a data-element-id>` inside it
 *  - `data.url` → `linkService.addLinkAttributes(link, url, data.newWindow)`
 *  - `data.dest` → `link.href = linkService.getDestinationHash(dest)` plus an
 *    `onclick` that calls `linkService.goToDestination(dest)` and returns `false`,
 *    and `data-internal-link` set on the container
 *
 * So a test can click the anchor the real PDF.js would have produced and the real
 * link service handles it — the double supplies no navigation of its own.
 *
 * ## What it is deliberately not
 *
 * No geometry. jsdom has no layout, so a percentage-positioned `<section>` proves
 * nothing; what a test can honestly observe is the lifecycle, the DOM contract and the
 * arguments. `AnnotationType.LINK` is inlined as `2` because the module may not import
 * `pdfjs-dist` — that is the value in `build/pdf.mjs`.
 *
 * `render()` appends synchronously and resolves on a microtask, which is what
 * `build/pdf.mjs` does: the element loop and `#addElementsToDOM`'s fragment append
 * both run before the first `await` inside `render()`.
 */

/** `AnnotationType.LINK` from `build/pdf.mjs` — the double may not import pdfjs-dist. */
const LINK = 2

/** What `page.getAnnotations({ intent: 'display' })` reports, as the double reads it. */
export interface FakeAnnotation {
  id: string
  annotationType: number
  rect: number[]
  url?: string
  newWindow?: boolean
  dest?: string | unknown[]
  noHTML?: boolean
  hidden?: boolean
}

/**
 * The link-service members `LinkAnnotationElement.render()` calls. The double stores
 * the real object, so a click on the anchor it builds exercises the real adapter.
 */
export interface FakeLinkServiceSurface {
  externalLinkEnabled: boolean
  addLinkAttributes: (link: HTMLAnchorElement, url: string, newWindow?: boolean) => void
  getDestinationHash: (destination: string | unknown[]) => string
  goToDestination: (destination: string | unknown[]) => Promise<void>
  getAnchorUrl: (anchor: string) => string
  executeNamedAction: (action: string) => void
  executeSetOCGState: (action: unknown) => Promise<void>
  getAttachmentContent: (id: string) => Promise<null>
  dispose: () => void
}

/** One recorded `new AnnotationLayer(...)` plus its `render()` arguments. */
export interface FakeAnnotationLayerCall {
  div: HTMLElement
  page: unknown
  scale: number
  width: number
  height: number
  rotation: number
  annotations: FakeAnnotation[]
  renderForms: boolean
  enableScripting: boolean
  hasJSActions: boolean
  linkService: FakeLinkServiceSurface
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

export class FakeAnnotationLayer {
  /** Every construction, in order. */
  static calls: FakeAnnotationLayerCall[] = []
  /** Every construction, kept live so a test can inspect one. */
  static instances: FakeAnnotationLayer[] = []
  /** Whether `render()` resolves on a microtask; turn it off to hold a render open. */
  static autoResolve = true

  static reset(): void {
    FakeAnnotationLayer.calls = []
    FakeAnnotationLayer.instances = []
    FakeAnnotationLayer.autoResolve = true
  }

  private destroyed = false
  private readonly deferred = createDeferred<void>()
  private readonly call: FakeAnnotationLayerCall

  constructor(params: {
    div: HTMLElement
    page: unknown
    viewport: { scale: number; width: number; height: number; rotation: number }
    linkService: FakeLinkServiceSurface
  }) {
    this.call = {
      div: params.div,
      page: params.page,
      scale: params.viewport.scale,
      width: params.viewport.width,
      height: params.viewport.height,
      rotation: params.viewport.rotation,
      annotations: [],
      // Filled in by render(); the defaults only exist so the shape is complete.
      renderForms: true,
      enableScripting: true,
      hasJSActions: true,
      linkService: params.linkService
    }
    FakeAnnotationLayer.calls.push(this.call)
    FakeAnnotationLayer.instances.push(this)
  }

  async render(
    params: {
      annotations: FakeAnnotation[]
      renderForms?: boolean
      enableScripting?: boolean
      hasJSActions?: boolean
    } & Record<string, unknown>
  ): Promise<void> {
    this.call.annotations = params.annotations
    this.call.renderForms = params.renderForms !== false
    this.call.enableScripting = params.enableScripting === true
    this.call.hasJSActions = params.hasJSActions === true

    const fragment = document.createDocumentFragment()
    for (const data of params.annotations) {
      if (data.noHTML) continue
      if (data.rect[2] === data.rect[0] || data.rect[3] === data.rect[1]) continue
      if (data.annotationType !== LINK) {
        // A non-link annotation still gets its box, as PDF.js does.
        const box = document.createElement('section')
        box.setAttribute('data-annotation-id', data.id)
        fragment.append(box)
        continue
      }
      fragment.append(this.renderLink(data))
    }
    this.call.div.replaceChildren()
    this.call.div.append(fragment)

    if (FakeAnnotationLayer.autoResolve) {
      queueMicrotask(() => {
        if (!this.destroyed) this.deferred.resolve()
      })
    }
    await this.deferred.promise
  }

  /** `LinkAnnotationElement.render()`, for the `data.url` and `data.dest` branches. */
  private renderLink(data: FakeAnnotation): HTMLElement {
    const container = document.createElement('section')
    container.setAttribute('data-annotation-id', data.id)
    container.classList.add('linkAnnotation')

    const link = document.createElement('a')
    link.setAttribute('data-element-id', data.id)

    let isBound = false
    if (data.url) {
      this.call.linkService.addLinkAttributes(link, data.url, data.newWindow)
      isBound = true
    } else if (data.dest !== undefined) {
      link.href = this.call.linkService.getDestinationHash(data.dest) as string
      link.onclick = () => {
        if (data.dest) void this.call.linkService.goToDestination(data.dest)
        return false
      }
      container.setAttribute('data-internal-link', '')
      isBound = true
    }

    if (isBound) {
      container.append(link)
    }
    return container
  }

  /** Settle a held-open `render()`, for tests that turned `autoResolve` off. */
  settleRender(): void {
    this.deferred.resolve()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.call.div.replaceChildren()
  }

  isDestroyed(): boolean {
    return this.destroyed
  }
}
