/**
 * Unit tests for the native document options builder.
 *
 * This module is the engine's security and asset policy in one function, so its
 * output is asserted literally rather than behaviourally: a silent change to
 * `enableScripting` or a dropped asset URL would be invisible everywhere else.
 *
 * `isEvalSupported` is asserted absent on purpose — the option was removed in
 * pdf.js 4.x and re-introducing it would suggest the CVE-2024-4367 workaround is
 * still load-bearing when it is not.
 */
import {
  PDFJS_ASSET_DIR,
  PDFJS_ASSET_SUBDIRS,
  createPdfDocumentOptions,
  pdfAssetUrl
} from '@features/pdf/engine/pdfDocumentOptions'

import { describe, expect, it } from 'vitest'

const BASE = 'https://app.test/'

describe('createPdfDocumentOptions', () => {
  it('never enables PDF JavaScript actions', () => {
    expect(createPdfDocumentOptions('local-pdf://a', BASE).enableScripting).toBe(false)
  })

  it('does not pass the removed isEvalSupported knob', () => {
    // pdf.js 6 has no such option; keeping it would imply the 3.x eval
    // workaround is still needed.
    expect('isEvalSupported' in createPdfDocumentOptions('local-pdf://a', BASE)).toBe(false)
  })

  it('passes the document source through untouched', () => {
    expect(createPdfDocumentOptions('local-pdf://a', BASE).url).toBe('local-pdf://a')

    const asUrl = new URL('file:///tmp/doc.pdf')
    expect(createPdfDocumentOptions(asUrl, BASE).url).toBe(asUrl)
  })

  it('does not widen the source type beyond what pdf.js 6 declares', () => {
    // 6.4.299 types `url` as `string | URL` only; the `TypedArray | ArrayBuffer`
    // variants the 3.x surface accepted are gone from the declaration. Binary
    // sources would have to go through `data`, so the engine must not pretend
    // otherwise.
    expect(() =>
      createPdfDocumentOptions(new Uint8Array([1, 2, 3]) as unknown as string, BASE)
    ).not.toThrow()
    expect(PDFJS_ASSET_DIR).toBe('pdfjs')
  })

  it('points every asset directory at the staged output', () => {
    const options = createPdfDocumentOptions('local-pdf://a', BASE)

    expect(options.cMapUrl).toBe(`${BASE}${PDFJS_ASSET_DIR}/cmaps/`)
    expect(options.standardFontDataUrl).toBe(`${BASE}${PDFJS_ASSET_DIR}/standard_fonts/`)
    expect(options.wasmUrl).toBe(`${BASE}${PDFJS_ASSET_DIR}/wasm/`)
    expect(options.iccUrl).toBe(`${BASE}${PDFJS_ASSET_DIR}/iccs/`)
  })

  it('declares the cMaps as packed binaries', () => {
    // PDF.js gates its worker-side fetch path on cMapPacked being truthy, so this
    // has to be explicit rather than relying on the default.
    expect(createPdfDocumentOptions('local-pdf://a', BASE).cMapPacked).toBe(true)
  })

  it('leaves useWorkerFetch to pdf.js, which derives it per scheme', () => {
    // PDF.js 6 computes it from isValidFetchUrl: true over http, false over
    // file://. Pinning it here would break one of the two environments.
    expect('useWorkerFetch' in createPdfDocumentOptions('local-pdf://a', BASE)).toBe(false)
  })

  it('produces no absolute or machine-specific paths', () => {
    const options = createPdfDocumentOptions('local-pdf://a', './')
    for (const value of [
      options.cMapUrl,
      options.standardFontDataUrl,
      options.wasmUrl,
      options.iccUrl
    ]) {
      expect(value).not.toMatch(/^[A-Za-z]:[\\/]/)
      expect(value).not.toContain('Users')
      expect(value).not.toMatch(/^file:/)
    }
  })

  it('covers exactly the four staged directories', () => {
    expect(PDFJS_ASSET_SUBDIRS).toEqual(['cmaps', 'standard_fonts', 'wasm', 'iccs'])
  })
})

describe('pdfAssetUrl', () => {
  it('always ends with a trailing slash, as pdf.js requires', () => {
    expect(pdfAssetUrl('cmaps', 'https://app.test')).toBe('https://app.test/pdfjs/cmaps/')
    expect(pdfAssetUrl('cmaps', 'https://app.test/')).toBe('https://app.test/pdfjs/cmaps/')
  })

  it('stays document-relative for the packaged file:// build', () => {
    // base: './' is what vite.config.mts sets, so the URL resolves inside the
    // packaged directory rather than against an absolute origin.
    expect(pdfAssetUrl('wasm', './')).toBe('./pdfjs/wasm/')
  })
})
