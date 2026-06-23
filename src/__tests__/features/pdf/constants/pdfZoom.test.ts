import {
  PDF_RESIZE_REFIT_DEBOUNCE_MS,
  PDF_ZOOM_MIN_SCALE,
  PDF_ZOOM_STEP
} from '@features/pdf/constants/pdfZoom'

import { describe, expect, it } from 'vitest'

describe('PDF_ZOOM_STEP', () => {
  it('should be a positive number', () => {
    expect(typeof PDF_ZOOM_STEP).toBe('number')
    expect(PDF_ZOOM_STEP).toBeGreaterThan(0)
  })

  it('should be 0.1 (10% zoom step)', () => {
    expect(PDF_ZOOM_STEP).toBe(0.1)
  })
})

describe('PDF_ZOOM_MIN_SCALE', () => {
  it('should be a positive number', () => {
    expect(typeof PDF_ZOOM_MIN_SCALE).toBe('number')
    expect(PDF_ZOOM_MIN_SCALE).toBeGreaterThan(0)
  })

  it('should be 0.1', () => {
    expect(PDF_ZOOM_MIN_SCALE).toBe(0.1)
  })

  it('should equal PDF_ZOOM_STEP', () => {
    expect(PDF_ZOOM_MIN_SCALE).toBe(PDF_ZOOM_STEP)
  })
})

describe('PDF_RESIZE_REFIT_DEBOUNCE_MS', () => {
  it('should be a positive number', () => {
    expect(typeof PDF_RESIZE_REFIT_DEBOUNCE_MS).toBe('number')
    expect(PDF_RESIZE_REFIT_DEBOUNCE_MS).toBeGreaterThan(0)
  })

  it('should be 150ms', () => {
    expect(PDF_RESIZE_REFIT_DEBOUNCE_MS).toBe(150)
  })
})
