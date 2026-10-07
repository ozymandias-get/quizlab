import {
  PDF_RESIZE_REFIT_DEBOUNCE_MS,
  PDF_ZOOM_MAX_SCALE,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'

import { describe, expect, it } from 'vitest'

// The scale domain is numeric and closed. Every consumer clamps against these
// three numbers, so their values are the contract rather than an implementation
// detail, and they are pinned once here instead of in each clamp's own suite.
describe('PDF zoom constants', () => {
  it('steps by 10% and clamps to [0.1, 5]', () => {
    expect(PDF_ZOOM_STEP).toBe(0.1)
    expect(PDF_ZOOM_MIN_SCALE).toBe(0.1)
    expect(PDF_ZOOM_MAX_SCALE).toBe(5)
  })

  it('refits after a resize settles, at 150ms', () => {
    expect(PDF_RESIZE_REFIT_DEBOUNCE_MS).toBe(150)
  })
})
