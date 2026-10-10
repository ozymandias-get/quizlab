import { describe, expect, it } from 'vitest'

import {
  buildPdfDocId,
  buildPdfSourceMeta,
  buildImageSourceHeader,
  buildTextSourceHeader,
  decorateTextWithSource,
  formatSourcePageLabel,
  formatSourcePages
} from '../../../../app/providers/ai/pdfSource'

describe('pdfSource metadata', () => {
  it('formats Sayfa 13/59', () => {
    const source = buildPdfSourceMeta({
      file: { path: '/a.pdf', name: 'a.pdf' },
      page: 13,
      totalPages: 59,
      captureKind: 'text-selection'
    })
    expect(formatSourcePageLabel(source)).toBe('Sayfa 13/59')
    expect(formatSourcePages(source)).toBe('13/59')
  })

  it('builds text and image headers with source', () => {
    const source = buildPdfSourceMeta({
      file: { path: '/a.pdf', name: 'a.pdf' },
      page: 13,
      totalPages: 59,
      captureKind: 'text-selection'
    })
    expect(buildTextSourceHeader(source)).toBe('[PDF Kaynağı — Metin — Sayfa 13/59]')
    expect(buildImageSourceHeader(source)).toBe('[PDF Kaynağı — Görsel — Sayfa 13/59]')
  })

  it('decorates text with header, keeping user text separate', () => {
    const source = buildPdfSourceMeta({
      file: { path: '/a.pdf' },
      page: 11,
      totalPages: 59,
      captureKind: 'text-selection'
    })
    expect(decorateTextWithSource('seçili metin', source, 'text')).toBe(
      '[PDF Kaynağı — Metin — Sayfa 11/59]\nseçili metin'
    )
  })

  it('does not invent a total when unknown', () => {
    const source = buildPdfSourceMeta({
      file: { path: '/a.pdf' },
      page: 13,
      captureKind: 'text-selection'
    })
    expect(source.totalPages).toBeUndefined()
    expect(formatSourcePageLabel(source)).toBe('Sayfa 13')
    expect(buildTextSourceHeader(source)).toBe('[PDF Kaynağı — Metin — Sayfa 13]')
  })

  it('represents multi-page selections as a real range, not a single page', () => {
    const source = buildPdfSourceMeta({
      file: { path: '/a.pdf' },
      page: 11,
      pageEnd: 12,
      totalPages: 59,
      captureKind: 'text-selection'
    })
    expect(formatSourcePageLabel(source)).toBe('Sayfa 11–12/59')
    expect(buildTextSourceHeader(source)).toBe('[PDF Kaynağı — Metin — Sayfa 11–12/59]')
  })

  it('keeps different documents separate via docId', () => {
    const a = buildPdfSourceMeta({
      file: { path: '/a.pdf', name: 'a.pdf' },
      page: 1,
      totalPages: 10,
      captureKind: 'text-selection'
    })
    const b = buildPdfSourceMeta({
      file: { path: '/b.pdf', name: 'b.pdf' },
      page: 1,
      totalPages: 10,
      captureKind: 'text-selection'
    })
    expect(a.docId).not.toBe(b.docId)
    expect(buildPdfDocId({ path: '/a.pdf', name: 'a.pdf' })).toBe(a.docId)
  })

  it('returns null headers when source is missing', () => {
    expect(buildTextSourceHeader(null)).toBeNull()
    expect(buildImageSourceHeader(undefined)).toBeNull()
    expect(formatSourcePageLabel(null)).toBeNull()
    expect(decorateTextWithSource('x', null, 'text')).toBe('x')
  })
})
