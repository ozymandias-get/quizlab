/**
 * Regression tests for the active PDFDocumentProxy registry.
 *
 * A viewer "Reload" bumps only `viewerReloadKey`, which remounts <Viewer> and
 * makes pdf.js destroy the previous loading task while the owning component
 * stays mounted. With a URL-only match the registry kept handing out that dead
 * proxy, so a high-DPI capture failed on getPage() and silently degraded to a
 * screen-resolution canvas clone.
 */
import {
  clearActivePdfDocument,
  getActivePdfDocument,
  setActivePdfDocument
} from '@features/pdf/lib/activePdfDocumentRegistry'

import { beforeEach, describe, expect, it, vi } from 'vitest'

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    fingerprint: 'fp',
    destroyed: false,
    getPage: vi.fn(),
    destroy: vi.fn(),
    ...overrides
  }
}

describe('activePdfDocumentRegistry', () => {
  beforeEach(() => {
    clearActivePdfDocument()
  })

  it('returns the registered document for a matching url', () => {
    const doc = makeDoc()
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(doc)
  })

  it('returns null for a different url', () => {
    setActivePdfDocument(makeDoc() as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_b')).toBeNull()
  })

  it('returns null and evicts a destroyed proxy', () => {
    const doc = makeDoc()
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')
    // pdf.js marks the proxy destroyed when the loading task is torn down.
    doc.destroyed = true

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
    // Second call must also report "no document", i.e. the stale entry is gone.
    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })

  it('keeps serving a live proxy', () => {
    const doc = makeDoc({ destroyed: false })
    setActivePdfDocument(doc as never, 'local-pdf://pdf_a', 'fp')

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(doc)
    expect(getActivePdfDocument('local-pdf://pdf_a')).toBe(doc)
  })

  it('returns null after clearing', () => {
    setActivePdfDocument(makeDoc() as never, 'local-pdf://pdf_a', 'fp')
    clearActivePdfDocument()

    expect(getActivePdfDocument('local-pdf://pdf_a')).toBeNull()
  })
})
