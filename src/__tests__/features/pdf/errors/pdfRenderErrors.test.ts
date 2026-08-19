import {
  installPdfRenderErrorGuard,
  isIgnorablePdfRenderError
} from '@features/pdf/errors/pdfRenderErrors'

import { describe, expect, it, vi } from 'vitest'

describe('isIgnorablePdfRenderError', () => {
  it('ignores RenderingCancelledException', () => {
    expect(
      isIgnorablePdfRenderError(new Error('RenderingCancelledException: Rendering cancelled'))
    ).toBe(true)
  })

  it('ignores canvas context lock errors', () => {
    expect(
      isIgnorablePdfRenderError(
        new Error('Cannot use the same canvas during multiple render() operations')
      )
    ).toBe(true)
    expect(isIgnorablePdfRenderError(new Error('canvas context is locked'))).toBe(true)
  })

  it('ignores render cancellation messages', () => {
    expect(isIgnorablePdfRenderError(new Error('render() was canceled'))).toBe(true)
    expect(isIgnorablePdfRenderError(new Error('Rendering cancelled'))).toBe(true)
  })

  it('does not ignore unrelated errors', () => {
    expect(isIgnorablePdfRenderError(new Error('ENOENT: no such file'))).toBe(false)
    expect(isIgnorablePdfRenderError('plain string')).toBe(false)
    expect(isIgnorablePdfRenderError(undefined)).toBe(false)
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
    const preventDefault = dispatchRejection(
      new Error('RenderingCancelledException: Rendering cancelled')
    )
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
    const preventDefault = dispatchRejection(new Error('RenderingCancelledException'))
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
