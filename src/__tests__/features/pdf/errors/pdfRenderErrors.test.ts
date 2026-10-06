import {
  installPdfRenderErrorGuard,
  isIgnorablePdfRenderError
} from '@features/pdf/errors/pdfRenderErrors'

import { describe, expect, it, vi } from 'vitest'

/**
 * The markers are asserted against strings the installed PDF.js engine actually
 * produces, so the guard cannot drift into matching unrelated errors after a
 * runtime upgrade.
 */
describe('isIgnorablePdfRenderError', () => {
  it('ignores a cancelled render task by its pdf.js error name', () => {
    // pdf.js constructs RenderingCancelledException with a page-specific
    // message, so the name is the stable signal.
    const cancelled = new Error('Rendering cancelled, page 3')
    cancelled.name = 'RenderingCancelledException'
    expect(isIgnorablePdfRenderError(cancelled)).toBe(true)
  })

  it('ignores the canvas-reuse error pdf.js throws for a double render', () => {
    expect(
      isIgnorablePdfRenderError(
        new Error(
          'Cannot use the same canvas during multiple render() operations. Use different canvas or ensure previous operations were cancelled.'
        )
      )
    ).toBe(true)
  })

  it('ignores the render cancellation message', () => {
    expect(isIgnorablePdfRenderError(new Error('Rendering cancelled, page 1'))).toBe(true)
  })

  it('does not match the same-canvas message without pdf.js wording', () => {
    // "canvas context is locked" is not a message any installed PDF.js build
    // produces, so it must not suppress real errors.
    expect(isIgnorablePdfRenderError(new Error('canvas context is locked'))).toBe(false)
    expect(isIgnorablePdfRenderError(new Error('render() was canceled'))).toBe(false)
  })

  it('does not ignore unrelated errors', () => {
    expect(isIgnorablePdfRenderError(new Error('ENOENT: no such file'))).toBe(false)
    expect(isIgnorablePdfRenderError('plain string')).toBe(false)
    expect(isIgnorablePdfRenderError(undefined)).toBe(false)
    expect(isIgnorablePdfRenderError(null)).toBe(false)
  })
})

describe('installPdfRenderErrorGuard', () => {
  function dispatchRejection(reason: unknown) {
    const event = new PromiseRejectionEvent('unhandledrejection', {
      reason,
      promise: Promise.resolve()
    })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)
    return preventDefault
  }

  it('swallows matching unhandled rejections', () => {
    const uninstall = installPdfRenderErrorGuard()
    const preventDefault = dispatchRejection(new Error('Rendering cancelled, page 2'))
    expect(preventDefault).toHaveBeenCalled()
    uninstall()
  })

  it('lets unrelated rejections pass through', () => {
    const uninstall = installPdfRenderErrorGuard()
    const preventDefault = dispatchRejection(new Error('Something else broke'))
    expect(preventDefault).not.toHaveBeenCalled()
    uninstall()
  })

  it('stops filtering after uninstall', () => {
    const uninstall = installPdfRenderErrorGuard()
    uninstall()
    const preventDefault = dispatchRejection(new Error('Rendering cancelled, page 2'))
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
