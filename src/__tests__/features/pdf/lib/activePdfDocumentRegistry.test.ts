/**
 * Regression tests for the capture-document registry.
 *
 * A viewer "Reload" bumps only `viewerReloadKey`, which remounts `<Viewer>` and
 * makes pdf.js destroy the previous loading task while the owning component stays
 * mounted. With a URL-only match the registry kept handing out that dead proxy, so
 * a high-DPI capture failed on `getPage()` and silently degraded to a
 * screen-resolution canvas clone.
 *
 * Phase 8A generalised the stored value from a `pdfjs-dist@3` proxy to a
 * runtime-agnostic handle, so the cases below cover both producers:
 *
 *  - the **legacy** proxy, adapted through `lib/legacyPdfCaptureDocument` because
 *    `PdfViewerElement.tsx` is frozen at zero diff this phase
 *  - a **native** handle, which brings its own liveness probe
 *
 * and the invariant that matters more than either: the registry never ends a
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

/** A `pdfjs-dist@3.11.174` proxy, as `PdfViewerElement` hands it over. */
function makeLegacyDoc(overrides: Record<string, unknown> = {}) {
  return {
    fingerprint: 'fp',
    destroyed: false,
    getPage: vi.fn(),
    destroy: vi.fn(),
    ...overrides
  }
}

/** A native-side handle, which answers its own liveness question. */
function makeNativeHandle(overrides: Partial<ActivePdfDocumentHandle> = {}) {
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
    setActivePdfDocument(makeLegacyDoc() as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).not.toBeNull()
  })

  it('returns null for a different url', () => {
    setActivePdfDocument(makeLegacyDoc() as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_b')).toBeNull()
  })

  it('returns a native handle unchanged, so its own liveness probe is the one used', () => {
    const handle = makeNativeHandle()
    setActivePdfDocument(handle, 'local-pdf://pdf_a', 'local-pdf://pdf_a::3')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(handle)
  })

  it('delegates getPage to the legacy proxy it adapted', async () => {
    const page = { getViewport: vi.fn(), render: vi.fn() }
    const doc = makeLegacyDoc({ getPage: vi.fn(async () => page) })
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

    const handle = getActivePdfDocument('local-pdf://pdf_a')
    // A narrow wrapper, not the proxy: capture gets `getViewport` / `render` and
    // nothing else, so the viewer's own surface stays unreachable from it.
    const captured = await handle!.getPage(4)
    expect(doc.getPage).toHaveBeenCalledWith(4)
    expect(Object.keys(captured).sort()).toEqual(['getViewport', 'render'])
    captured.getViewport({ scale: 2 })
    expect(page.getViewport).toHaveBeenCalledWith({ scale: 2 })
  })

  it('returns null and evicts a destroyed legacy proxy', () => {
    const doc = makeLegacyDoc()
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')
    // pdf.js marks the proxy destroyed when the loading task is torn down.
    doc.destroyed = true

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    // Second call must also report "no document", i.e. the stale entry is gone.
    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('evicts a native handle whose probe reports dead', () => {
    const isAlive = vi.fn(() => false)
    setActivePdfDocument(makeNativeHandle({ isAlive }), 'local-pdf://pdf_a', 'gen-1')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    expect(getActivePdfDocumentIdentity()).toBeNull()
  })

  it('treats a throwing liveness probe as dead rather than as alive', () => {
    // A probe that throws is indistinguishable from a document that cannot be
    // used, and "assume alive" would hand capture a proxy whose getPage() rejects.
    const isAlive = vi.fn(() => {
      throw new Error('teardown in progress')
    })
    setActivePdfDocument(makeNativeHandle({ isAlive }), 'local-pdf://pdf_a', 'gen-1')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('keeps serving a live proxy', () => {
    const doc = makeLegacyDoc({ destroyed: false })
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).not.toBeNull()
    expect(getActivePdfDocument('local-pdf://pdf_a')).not.toBeNull()
  })

  it('returns null after clearing', () => {
    setActivePdfDocument(makeLegacyDoc() as never, 'local-pdf://pdf_a', 'fp')
    clearActivePdfDocument()

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('records the identity the registrant supplied', () => {
    setActivePdfDocument(makeLegacyDoc() as never, 'local-pdf://pdf_a', 'fingerprint-abc')
    expect(getActivePdfDocumentIdentity()).toBe('fingerprint-abc')

    setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a')
    expect(getActivePdfDocumentIdentity()).toBeNull()
  })

  describe('reload: same url, new document generation', () => {
    it('serves the newest handle, never the superseded one', () => {
      const first = makeNativeHandle()
      const second = makeNativeHandle()
      setActivePdfDocument(first, 'local-pdf://pdf_a', 'local-pdf://pdf_a::1')

      setActivePdfDocument(second, 'local-pdf://pdf_a', 'local-pdf://pdf_a::2')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(second)
      expect(getActivePdfDocumentIdentity()).toBe('local-pdf://pdf_a::2')
    })

    it('does not hand out a handle the manager has already let go of', () => {
      // The native adapter's own probe is what makes this safe; here it is
      // exercised through the registry's contract — a dead handle is never
      // returned, whatever the URL says.
      const stale = makeNativeHandle({ isAlive: vi.fn(() => false) })
      setActivePdfDocument(stale, 'local-pdf://pdf_a', 'local-pdf://pdf_a::1')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('replacing an entry with null clears it', () => {
      setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a', 'gen-1')

      setActivePdfDocument(null, null)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })
  })

  describe('token-scoped deregistration', () => {
    it('withdraws only its own entry', () => {
      const token = setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a', 'gen-1')

      clearActivePdfDocument(token)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('leaves a sibling viewer registration alone', () => {
      // LeftPanel and the FocusOverlay can both be mounted on the same file. The
      // store is a single slot, so the *later* registrant owns it; when the
      // earlier viewer unmounts it must not empty the slot, or the next capture
      // would re-download a file that is already decoded.
      const leavingToken = setActivePdfDocument(
        makeNativeHandle(),
        'local-pdf://pdf_a',
        'gen-leaving'
      )
      const sibling = makeNativeHandle()
      const siblingToken = setActivePdfDocument(sibling, 'local-pdf://pdf_a', 'gen-sibling')

      clearActivePdfDocument(leavingToken)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(sibling)

      // And the surviving viewer can withdraw in turn.
      clearActivePdfDocument(siblingToken)
      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('a token from an older registration cannot clear a newer one', () => {
      const oldToken = setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a', 'gen-1')
      const current = makeNativeHandle()
      setActivePdfDocument(current, 'local-pdf://pdf_a', 'gen-2')

      clearActivePdfDocument(oldToken)

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(current)
    })

    it('clears unconditionally when no token is given', () => {
      // The legacy `<Viewer>` teardown contract: it holds no token and must keep
      // emptying the slot outright.
      setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a', 'gen-1')

      clearActivePdfDocument()

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })

    it('returns null for a token when nothing was registered', () => {
      expect(setActivePdfDocument(null, null)).toBeNull()
    })
  })

  describe('ownership', () => {
    it('never destroys the document it lends', async () => {
      const doc = makeLegacyDoc()
      setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

      const handle = getActivePdfDocument('local-pdf://pdf_a')
      await handle!.getPage(1)

      expect(doc.destroy).not.toHaveBeenCalled()
    })

    it('exposes no teardown on a handle at all', () => {
      // The structural guarantee: there is nothing for a capture path to reach
      // for. The engine destroys through its loading task; the viewer destroys its
      // own proxy; the store does neither.
      setActivePdfDocument(makeNativeHandle(), 'local-pdf://pdf_a', 'gen-1')

      const handle = getActivePdfDocument('local-pdf://pdf_a') as unknown as Record<string, unknown>
      expect(Object.keys(handle).sort()).toEqual(['getPage', 'isAlive'])
      expect(handle.destroy).toBeUndefined()
      expect(handle.cleanup).toBeUndefined()
    })

    it('ignores a null url rather than registering an unmatchable entry', () => {
      setActivePdfDocument(makeNativeHandle(), null, 'gen-1')

      expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    })
  })
})
