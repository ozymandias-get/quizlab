/**
 * Unit tests for the page renderer.
 *
 * Two contracts are pinned:
 *
 *   - a render sizes the canvas from the viewport PDF.js computed, so the
 *     canvas and the render can never disagree
 *   - a superseded render is cancelled with the typed
 *     `RenderingCancelledException`, recognised by identity rather than by
 *     matching message strings
 *
 * The canvas is a real (jsdom) element because PDF.js 6's `RenderParameters`
 * takes `canvas: HTMLCanvasElement`, not the legacy `canvasContext`.
 */
import { createPageRenderer, isRenderCancelled } from '@features/pdf/engine/pageRenderer'

import { RenderingCancelledException } from 'pdfjs-dist'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

import { beforeEach, describe, expect, it, vi } from 'vitest'

function makeCanvas(width = 10, height = 10) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** A page whose render promise can be swapped out and settled by the test. */
function makePage(pointWidth = 200, pointHeight = 300) {
  const task = {
    promise: Promise.resolve(),
    cancel: vi.fn()
  } as unknown as RenderTask & { cancel: ReturnType<typeof vi.fn>; promise: Promise<void> }
  const render = vi.fn((_params: { canvas: HTMLCanvasElement; viewport: unknown }) => task)
  const getViewport = vi.fn(({ scale, rotation }: { scale: number; rotation?: number }) => {
    const swap = rotation !== undefined && Math.abs(rotation % 180) === 90
    return {
      width: pointWidth * scale,
      height: pointHeight * scale,
      swapped: swap
    }
  })
  return {
    getViewport,
    render,
    task,
    /** Replace the render promise and hand back its settlement handle. */
    deferRender(): () => void {
      let settle: (() => void) | undefined
      task.promise = new Promise<void>((resolve) => {
        settle = resolve
      })
      return () => settle?.()
    }
  }
}

type FakePage = ReturnType<typeof makePage>

function asPage(page: FakePage) {
  return page as unknown as PDFPageProxy
}

describe('createPageRenderer', () => {
  let page: FakePage
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    page = makePage()
    canvas = makeCanvas()
  })

  it('sizes the canvas from the viewport at the requested scale', async () => {
    const renderer = createPageRenderer()

    const result = await renderer.renderPage(asPage(page), canvas, { scale: 2 })

    expect(page.getViewport).toHaveBeenCalledWith({ scale: 2, rotation: undefined })
    expect(result).toEqual({ width: 400, height: 600 })
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(600)
  })

  describe('the backing store is not reset for nothing', () => {
    /**
     * Count the resets, not the sizes.
     *
     * `canvas.width` is a value property whose *assignment* resets the backing store, so
     * asserting `canvas.width === 400` passes whether or not the canvas was emptied — which
     * is the exact property under test. jsdom implements the setter, so a counter installed
     * over it observes the reset directly.
     */
    function countCanvasResets(target: HTMLCanvasElement): () => number {
      const proto = HTMLCanvasElement.prototype
      let resets = 0
      for (const dimension of ['width', 'height'] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, dimension)!
        Object.defineProperty(target, dimension, {
          configurable: true,
          get: () => descriptor.get!.call(target),
          set: (value: number) => {
            resets += 1
            descriptor.set!.call(target, value)
          }
        })
      }
      return () => resets
    }

    it('does not clear the canvas when the new page is the same size', async () => {
      // The shape of an ordinary page turn: one document at one scale, page N followed by
      // page N+1. An unguarded `canvas.width = width` blanks the canvas here — at
      // navigation time, before PDF.js has painted a single operator of the new page. And
      // because PDF.js's `beginDrawing` fills the page background white before it draws,
      // that blank frame is white rather than merely empty. This is the flash.
      canvas.width = 400
      canvas.height = 600
      const resets = countCanvasResets(canvas)
      const renderer = createPageRenderer()

      await renderer.renderPage(asPage(page), canvas, { scale: 2 })

      // The canvas still ends up the right size...
      expect(canvas.width).toBe(400)
      expect(canvas.height).toBe(600)
      // ...without having been emptied to get there.
      expect(resets()).toBe(0)
    })

    it('resizes the canvas when a zoom genuinely changes the page size', async () => {
      const renderer = createPageRenderer()
      await renderer.renderPage(asPage(page), canvas, { scale: 2 })
      expect(canvas.width).toBe(400)

      const resets = countCanvasResets(canvas)
      await renderer.renderPage(asPage(page), canvas, { scale: 3 })

      // A zoom really does need a different box, and the reset is required there: the new
      // pixels are laid out for it, and PDF.js fills the whole canvas before painting.
      expect(canvas.width).toBe(600)
      expect(resets()).toBeGreaterThan(0)
    })

    it('leaves a re-render that lands on the same size alone', async () => {
      // A second fit render, or a refit that resolves to the same scale, re-renders the
      // page already on screen at an identical size. That is a commit, but it is not a page
      // change, and it must not blank the canvas either.
      const renderer = createPageRenderer()
      await renderer.renderPage(asPage(page), canvas, { scale: 2 })

      const resets = countCanvasResets(canvas)
      await renderer.renderPage(asPage(page), canvas, { scale: 2 })

      expect(resets()).toBe(0)
    })
  })

  it('passes the rotation through when given', async () => {
    const renderer = createPageRenderer()

    await renderer.renderPage(asPage(page), canvas, { scale: 1, rotation: 90 })

    expect(page.getViewport).toHaveBeenCalledWith({ scale: 1, rotation: 90 })
  })

  it('hands pdf.js the canvas it just sized', async () => {
    const renderer = createPageRenderer()

    await renderer.renderPage(asPage(page), canvas, { scale: 3 })

    const params = page.render.mock.calls[0]?.[0]
    expect(params?.canvas).toBe(canvas)
    expect(params?.viewport).toBe(page.getViewport.mock.results[0].value)
  })

  it('never produces a zero-sized canvas', async () => {
    const renderer = createPageRenderer()

    const result = await renderer.renderPage(asPage(makePage(0, 0)), canvas, { scale: 1 })

    expect(result).toEqual({ width: 1, height: 1 })
    expect(canvas.width).toBeGreaterThanOrEqual(1)
    expect(canvas.height).toBeGreaterThanOrEqual(1)
  })

  it('reports no render in flight when idle', () => {
    const renderer = createPageRenderer()

    expect(renderer.isRendering).toBe(false)
  })

  describe('cancellation', () => {
    it('cancels the previous render before starting the next one', async () => {
      const first = makePage()
      const settleFirst = first.deferRender()
      const renderer = createPageRenderer()

      const inFlight = renderer.renderPage(asPage(first), canvas, { scale: 1 })
      expect(renderer.isRendering).toBe(true)

      const second = makePage()
      await renderer.renderPage(asPage(second), canvas, { scale: 2 })

      expect(first.task.cancel).toHaveBeenCalledTimes(1)
      settleFirst?.()
      await inFlight.catch(() => {})
    })

    it('cancels an in-flight render on demand', async () => {
      const settle = page.deferRender()
      const renderer = createPageRenderer()

      const inFlight = renderer.renderPage(asPage(page), canvas, { scale: 1 })
      renderer.cancel()

      expect(page.task.cancel).toHaveBeenCalledTimes(1)
      expect(renderer.isRendering).toBe(false)
      settle?.()
      await inFlight
    })

    it('is safe to cancel while idle', () => {
      const renderer = createPageRenderer()

      expect(() => renderer.cancel()).not.toThrow()
    })

    it('recognises the typed cancellation exception', () => {
      const cancelled = new RenderingCancelledException('Rendering cancelled, page 1')

      expect(isRenderCancelled(cancelled)).toBe(true)
    })

    it('does not mistake any other rejection for a cancellation', () => {
      expect(isRenderCancelled(new Error('Rendering cancelled, page 1'))).toBe(false)
      expect(isRenderCancelled(new Error('multiple render() operations'))).toBe(false)
      expect(isRenderCancelled(undefined)).toBe(false)
      expect(isRenderCancelled('Rendering cancelled')).toBe(false)
    })

    it('lets a cancellation rejection reach the caller so it can be handled', async () => {
      page.task.promise = Promise.reject(new RenderingCancelledException('cancelled'))
      const renderer = createPageRenderer()

      await expect(renderer.renderPage(asPage(page), canvas, { scale: 1 })).rejects.toBeInstanceOf(
        RenderingCancelledException
      )
      // The slot must not stay occupied by a finished task.
      expect(renderer.isRendering).toBe(false)
    })
  })

  describe('error propagation', () => {
    it('propagates a render failure without swallowing it', async () => {
      page.task.promise = Promise.reject(new Error('cannot parse content stream'))
      const renderer = createPageRenderer()

      await expect(renderer.renderPage(asPage(page), canvas, { scale: 1 })).rejects.toThrow(
        'cannot parse content stream'
      )
      expect(renderer.isRendering).toBe(false)
    })

    it('propagates a synchronous render() failure', async () => {
      const broken = makePage()
      broken.render.mockImplementation(() => {
        throw new Error('no canvas')
      })
      const renderer = createPageRenderer()

      await expect(renderer.renderPage(asPage(broken), canvas, { scale: 1 })).rejects.toThrow(
        'no canvas'
      )
    })
  })
})
