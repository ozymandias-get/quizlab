/**
 * The two numeric bounds the native viewer is built on.
 *
 * The page clamp is where the 1-based contract is enforced, including the window
 * where the page count is not yet known — the window in which the resume flow
 * legitimately restores a saved page and a naive `min(1, total)` would throw that
 * away.
 */
import {
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'
import { clampPdfPage, clampPdfScale } from '@features/pdf/native/nativePdfBounds'

import { describe, expect, it } from 'vitest'

describe('clampPdfPage', () => {
  it('keeps a page that is inside the document', () => {
    expect(clampPdfPage(1, 10)).toBe(1)
    expect(clampPdfPage(5, 10)).toBe(5)
    expect(clampPdfPage(10, 10)).toBe(10)
  })

  it('never returns a page below 1', () => {
    expect(clampPdfPage(0, 10)).toBe(1)
    expect(clampPdfPage(-4, 10)).toBe(1)
  })

  it('never returns a page beyond the document', () => {
    // A resume page saved against a longer revision of the same file.
    expect(clampPdfPage(42, 10)).toBe(10)
  })

  it('only lower-bounds while the page count is unknown', () => {
    // Forcing 1 here would fight the resume flow, which restores a page before
    // the new document's numPages is known.
    expect(clampPdfPage(8, 0)).toBe(8)
    expect(clampPdfPage(8, Number.NaN)).toBe(8)
  })

  it('is still 1-based when the count is unknown', () => {
    expect(clampPdfPage(0, 0)).toBe(1)
    expect(clampPdfPage(-1, 0)).toBe(1)
  })

  it('treats a non-numeric request as page 1 instead of NaN', () => {
    expect(clampPdfPage(Number.NaN, 10)).toBe(1)
    expect(clampPdfPage(Number.POSITIVE_INFINITY, 10)).toBe(1)
  })

  it('truncates a fractional page rather than rendering a half page index', () => {
    expect(clampPdfPage(3.9, 10)).toBe(3)
  })
})

describe('clampPdfScale', () => {
  it('keeps a scale inside the product range', () => {
    expect(clampPdfScale(1.25)).toBe(1.25)
    expect(clampPdfScale(PDF_ZOOM_MIN_SCALE)).toBe(PDF_ZOOM_MIN_SCALE)
    expect(clampPdfScale(PDF_ZOOM_MAX_SCALE)).toBe(PDF_ZOOM_MAX_SCALE)
  })

  it('clamps beyond the range at both ends', () => {
    expect(clampPdfScale(PDF_ZOOM_MAX_SCALE + 1)).toBe(PDF_ZOOM_MAX_SCALE)
    expect(clampPdfScale(99)).toBe(PDF_ZOOM_MAX_SCALE)
    expect(clampPdfScale(PDF_ZOOM_MIN_SCALE - 1)).toBe(PDF_ZOOM_MIN_SCALE)
    expect(clampPdfScale(0)).toBe(PDF_ZOOM_MIN_SCALE)
    expect(clampPdfScale(-3)).toBe(PDF_ZOOM_MIN_SCALE)
  })

  it('is idempotent, so a saturated zoom step is a no-op', () => {
    // Returning the current value is what lets React bail out of the re-render
    // when the user keeps pressing zoom-in at the maximum.
    const saturated = clampPdfScale(PDF_ZOOM_MAX_SCALE + PDF_ZOOM_STEP)
    expect(saturated).toBe(PDF_ZOOM_MAX_SCALE)
    expect(clampPdfScale(saturated)).toBe(saturated)
  })

  it('falls back to the minimum for a non-numeric scale', () => {
    expect(clampPdfScale(Number.NaN)).toBe(PDF_ZOOM_MIN_SCALE)
    expect(clampPdfScale(Number.POSITIVE_INFINITY)).toBe(PDF_ZOOM_MIN_SCALE)
  })
})
