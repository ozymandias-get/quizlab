/**
 * Regression tests for the capture-document registry.
 *
 * A viewer "Reload" bumps only `viewerReloadKey`, which remounts the document and
 * makes PDF.js destroy the previous loading task while the owning component stays
 * mounted. With a URL-only match the registry kept handing out that dead document,
 * so a high-DPI capture failed on `getPage()` and silently degraded to a
 * screen-resolution canvas clone.
 *
 * The registry used to store one of two shapes: a real handle, or a
 * `pdfjs-dist@3` proxy normalized through `legacyPdfCaptureDocument` because the
 * legacy viewer handed over `DocumentLoadEvent#doc` verbatim. There is one
 * producer now, so one shape — and the structural assertion that it is one shape
 * lives in `architecture/pdfjs-single-runtime.test.ts`.
 *
 * The invariant that matters more than any of that: the registry never ends a
 * document's life. It borrows.
 */
import {
  type ActivePdfDocumentHandle,
  clearActivePdfDocument,
  getActivePdfDocument,
  getActivePdfDocumentIdentity,
  setActivePdfDocument
} from '@features/pdf/lib/activePdfDocumentRegistry'

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** A capture handle, which answers its own liveness question. */
function makeHandle(overrides: Partial<ActivePdfDocumentHandle> = {}) {
  return {
    getPage: vi.fn(),
    isAlive: vi.fn(() => true),
    ...overrides
  }
}

describe('activePdfDocumentRegistry', () => {
  beforeEach(() => {
    clearActivePdfDocument()
  })

  it('returns a handle for a matching url', () => {
    setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).not.toBeNull()
  })

  it('returns null for a different url', () => {
    setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_b')).toBeNull()
  })

  it('delegates getPage to the handle', async () => {
    const page = { getViewport: vi.fn(), render: vi.fn() }
    const getPage = vi.fn(async () => page)
    setActivePdfDocument(makeHandle({ getPage }), 'local-pdf://pdf_a', 'fp')

    const handle = getActivePdfDocument('local-pdf://pdf_a')

    expect(await handle?.getPage(3)).toBe(page)
    expect(getPage).toHaveBeenCalledWith(3)
  })

  it('returns null and evicts a handle that reports itself dead', () => {
    // The reload case: the URL is unchanged but the document behind it is not the
    // one the viewer is rendering any more.
    const handle = makeHandle({ isAlive: vi.fn(() => false) })
    setActivePdfDocument(handle, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    // Evicted on sight, so no later capture retries a dead document.
    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('treats a throwing liveness probe as dead', () => {
    // Indistinguishable from a dead document, and treating it as alive would hand
    // capture a proxy it cannot use.
    setActivePdfDocument(
      makeHandle({
        isAlive: vi.fn(() => {
          throw new Error('worker gone')
        })
      }),
      'local-pdf://pdf_a',
      'fp'
    )

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('keeps serving a live handle across repeated lookups', () => {
    setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(
      getActivePdfDocument('local-pdf://pdf_a')
    )
  })

  it('reports the identity the registrant supplied', () => {
    expect(getActivePdfDocumentIdentity()).toBeNull()

    setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'local-pdf://pdf_a::0')

    expect(getActivePdfDocumentIdentity()).toBe('local-pdf://pdf_a::0')
  })

  it('records no identity when the registrant supplies none', () => {
    setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a')

    expect(getActivePdfDocumentIdentity()).toBeNull()
  })

  describe('ownership', () => {
    it('never destroys the document it lends', async () => {
      const handle = makeHandle({
        getPage: vi.fn(async () => ({ getViewport: vi.fn(), render: vi.fn() }))
      })
      // The handle has no teardown at all — that is the structural guarantee, so
      // this asserts the surface as well as the behaviour.
      setActivePdfDocument(handle, 'local-pdf://pdf_a', 'fp')

      const borrowed = getActivePdfDocument('local-pdf://pdf_a')
      await borrowed?.getPage(1)

      expect(Object.keys(borrowed ?? {}).sort()).toEqual(['getPage', 'isAlive'])
      expect(handle).not.toHaveProperty('destroy')
      expect(handle).not.toHaveProperty('release')
    })
  })

  describe('registration', () => {
    it('clears the slot when the document is null', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'fp')

      setActivePdfDocument(null, 'local-pdf://pdf_a', 'fp')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('clears the slot when the url is null', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'fp')

      setActivePdfDocument(makeHandle(), null, 'fp')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('most recent registration wins', () => {
      const first = makeHandle()
      const second = makeHandle()
      setActivePdfDocument(first, 'local-pdf://pdf_a', 'first')
      setActivePdfDocument(second, 'local-pdf://pdf_a', 'second')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(second)
    })
  })

  describe('deregistration', () => {
    it('a token only withdraws the entry that produced it', () => {
      // Two viewers can be mounted on the same file (`LeftPanel` and the
      // `FocusOverlay`). An unmounting one must not evict the other's document.
      const first = makeHandle()
      setActivePdfDocument(first, 'local-pdf://pdf_a', 'first')
      const firstToken = setActivePdfDocument(first, 'local-pdf://pdf_a', 'first')

      const second = makeHandle()
      setActivePdfDocument(second, 'local-pdf://pdf_a', 'second')

      clearActivePdfDocument(firstToken)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(second)
    })

    it('the matching token does withdraw its own entry', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')
      const token = setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')

      clearActivePdfDocument(token)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('no token empties the slot', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')

      clearActivePdfDocument()

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('tokens are never equal across re-registration', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')
      const a = setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')
      const b = setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')

      expect(a).not.toBe(b)
      expect(typeof a).toBe('symbol')
    })

    it('a stale token cannot withdraw a re-registered entry', () => {
      setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')
      const stale = setActivePdfDocument(makeHandle(), 'local-pdf://pdf_a', 'first')

      const live = makeHandle()
      setActivePdfDocument(live, 'local-pdf://pdf_a', 'second')

      clearActivePdfDocument(stale)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(live)
    })
  })
})
