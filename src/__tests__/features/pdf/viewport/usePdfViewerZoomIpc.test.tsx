import { PDF_ZOOM_MIN_SCALE, PDF_ZOOM_STEP } from '@features/pdf/constants/pdfZoom'
import { usePdfViewerZoomIpc } from '@features/pdf/viewport/usePdfViewerZoomIpc'

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hasElectronApi: vi.fn(() => true),
  getElectronApi: vi.fn(),
  onPdfViewerZoom: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('@shared/lib/electronApi', () => ({
  hasElectronApi: mocks.hasElectronApi,
  getElectronApi: mocks.getElectronApi
}))

describe('usePdfViewerZoomIpc', () => {
  const zoomTo = vi.fn()

  const setup = (scaleFactor = 1, enabled = true, fitScale: number | null = 1) => {
    mocks.getElectronApi.mockReturnValue({ onPdfViewerZoom: mocks.onPdfViewerZoom })
    mocks.onPdfViewerZoom.mockReturnValue(mocks.removeListener)
    return renderHook(({ scale, fit, on }) => usePdfViewerZoomIpc(zoomTo, scale, fit, on), {
      initialProps: { scale: scaleFactor, fit: fitScale, on: enabled }
    })
  }

  const lastActionHandler = () => {
    const calls = mocks.onPdfViewerZoom.mock.calls
    return calls[calls.length - 1][0] as (action: string) => void
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasElectronApi.mockReturnValue(true)
  })

  it('zooms in relative to the current scale factor', () => {
    setup(1, true)

    lastActionHandler()('in')

    expect(zoomTo).toHaveBeenCalledWith(1 + PDF_ZOOM_STEP)
  })

  it('clamps zoom out at the minimum scale', () => {
    setup(PDF_ZOOM_MIN_SCALE, true)

    lastActionHandler()('out')

    expect(zoomTo).toHaveBeenCalledWith(PDF_ZOOM_MIN_SCALE)
  })

  // Phase 8B: reset is the viewer's numeric fit scale, not RPV's
  // `SpecialZoomLevel.PageWidth` keyword. The keyword could only be interpreted by
  // RPV's own `zoomTo`, so the native viewer needs the number it stands for.
  it('resets to the numeric fit scale', () => {
    setup(2, true, 1.37)

    lastActionHandler()('reset')

    expect(zoomTo).toHaveBeenCalledWith(1.37)
  })

  it('does nothing on reset while the fit scale is unknown', () => {
    setup(2, true, null)

    lastActionHandler()('reset')

    expect(zoomTo).not.toHaveBeenCalled()
  })

  it('ignores actions while disabled and follows the latest scale', () => {
    const { rerender } = setup(1, false)

    lastActionHandler()('in')
    expect(zoomTo).not.toHaveBeenCalled()

    rerender({ scale: 2, fit: 1, on: true })
    lastActionHandler()('in')
    expect(zoomTo).toHaveBeenCalledWith(2 + PDF_ZOOM_STEP)
  })

  // A single subscription must hold whatever the scale and fit scale do, so the
  // effect cannot depend on them. Phase 8B wires this hook on both the legacy and
  // the native path, and exactly one of the two may be active.
  it('subscribes once and follows the latest fit scale across re-renders', () => {
    const { rerender } = setup(1, true, 1)

    rerender({ scale: 1, fit: 2, on: true })
    rerender({ scale: 1, fit: 3, on: true })

    expect(mocks.onPdfViewerZoom).toHaveBeenCalledTimes(1)

    lastActionHandler()('reset')
    expect(zoomTo).toHaveBeenCalledWith(3)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = setup(1, true)

    unmount()

    expect(mocks.removeListener).toHaveBeenCalledTimes(1)
  })

  it('does nothing without the Electron API', () => {
    mocks.hasElectronApi.mockReturnValue(false)

    const { unmount } = renderHook(() => usePdfViewerZoomIpc(zoomTo, 1, 1, true))

    expect(mocks.onPdfViewerZoom).not.toHaveBeenCalled()
    unmount()
  })
})
