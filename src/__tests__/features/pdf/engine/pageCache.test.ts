/**
 * Unit tests for the page-proxy cache.
 *
 * The cache's whole purpose is a clearable ownership boundary, so the assertions
 * are about what it retains and when it drops it — not about avoiding work,
 * which PDF.js already does internally via `PDFDocumentProxy.getPage`.
 */
import { createPageCache } from '@features/pdf/engine/pageCache'

import type { PDFPageProxy } from 'pdfjs-dist'

import { beforeEach, describe, expect, it, vi } from 'vitest'

function makePage(pageNumber: number) {
  return { pageNumber, cleanup: vi.fn() } as unknown as PDFPageProxy
}

describe('createPageCache', () => {
  let getPage: ReturnType<typeof vi.fn>
  let cache: ReturnType<typeof createPageCache>

  beforeEach(() => {
    getPage = vi.fn(async (pageNumber: number) => makePage(pageNumber))
    cache = createPageCache({ getPage } as never)
  })

  it('calls through to the document once per page', async () => {
    const first = await cache.getPage(3)
    const second = await cache.getPage(3)

    expect(getPage).toHaveBeenCalledTimes(1)
    expect(getPage).toHaveBeenCalledWith(3)
    expect(second).toBe(first)
  })

  it('caches pages independently', async () => {
    const one = await cache.getPage(1)
    const two = await cache.getPage(2)

    expect(getPage).toHaveBeenCalledTimes(2)
    expect(one).not.toBe(two)
    expect(cache.size).toBe(2)
  })

  it('shares the in-flight promise rather than issuing a second lookup', async () => {
    let resolvePage: ((page: PDFPageProxy) => void) | undefined
    getPage.mockReturnValue(
      new Promise<PDFPageProxy>((resolve) => {
        resolvePage = resolve
      })
    )

    const a = cache.getPage(5)
    const b = cache.getPage(5)
    resolvePage?.(makePage(5))
    await Promise.all([a, b])

    expect(getPage).toHaveBeenCalledTimes(1)
  })

  it('does not cache a rejected lookup, so a retry is possible', async () => {
    getPage.mockRejectedValueOnce(new Error('objects not parsed'))

    await expect(cache.getPage(7)).rejects.toThrow('objects not parsed')
    expect(cache.size).toBe(0)

    // The retry must actually reach the document again.
    await expect(cache.getPage(7)).resolves.toMatchObject({ pageNumber: 7 })
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('drops everything on clear', async () => {
    await cache.getPage(1)
    await cache.getPage(2)
    expect(cache.size).toBe(2)

    cache.clear()

    expect(cache.size).toBe(0)
    await cache.getPage(1)
    expect(getPage).toHaveBeenCalledTimes(3)
  })

  it('is empty before anything is requested', () => {
    expect(cache.size).toBe(0)
  })
})
