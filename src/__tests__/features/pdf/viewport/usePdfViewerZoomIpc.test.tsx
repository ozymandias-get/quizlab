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

vi.mock('@react-pdf-viewer/core', () => ({
  SpecialZoomLevel: { PageWidth: 'PageWidth' }
}))

describe('usePdfViewerZoomIpc', () => {
  const zoomTo = vi.fn()

  const setup = (scaleFactor = 1, enabled = true) => {
    mocks.getElectronApi.mockReturnValue({ onPdfViewerZoom: mocks.onPdfViewerZoom })
    mocks.onPdfViewerZoom.mockReturnValue(mocks.removeListener)
    return renderHook(({ scale, on }) => usePdfViewerZoomIpc(zoomTo, scale, on), {
      initialProps: { scale: scaleFactor, on: enabled }
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

  it('resets to page width', () => {
    setup(2, true)

    lastActionHandler()('reset')

    expect(zoomTo).toHaveBeenCalledWith('PageWidth')
  })

  it('ignores actions while disabled and follows the latest scale', () => {
    const { rerender } = setup(1, false)

    lastActionHandler()('in')
    expect(zoomTo).not.toHaveBeenCalled()

    rerender({ scale: 2, on: true })
    lastActionHandler()('in')
    expect(zoomTo).toHaveBeenCalledWith(2 + PDF_ZOOM_STEP)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = setup(1, true)

    unmount()

    expect(mocks.removeListener).toHaveBeenCalledTimes(1)
  })

  it('does nothing without the Electron API', () => {
    mocks.hasElectronApi.mockReturnValue(false)

    const { unmount } = renderHook(() => usePdfViewerZoomIpc(zoomTo, 1, true))

    expect(mocks.onPdfViewerZoom).not.toHaveBeenCalled()
    unmount()
  })
})
