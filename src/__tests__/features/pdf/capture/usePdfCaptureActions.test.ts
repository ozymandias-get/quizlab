import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePdfCaptureActions } from '@features/pdf/capture/usePdfCaptureActions'

const mocks = vi.hoisted(() => ({
  renderPageToImageFallback: vi.fn(),
  findPageCanvas: vi.fn(() => null),
  showError: vi.fn()
}))
const { renderPageToImageFallback } = mocks
const queueImageForAi = vi.fn()
const revokeObjectURL = vi.fn()

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showError: mocks.showError })
}))

vi.mock('@features/pdf/capture/findPageCanvas', () => ({
  findPageCanvas: mocks.findPageCanvas
}))

vi.mock('@features/pdf/lib/renderPageToImage', () => ({
  renderPageToImageFallback: mocks.renderPageToImageFallback
}))

describe('usePdfCaptureActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops and revokes a render that finishes after the PDF changes', async () => {
    let resolveRender:
      | ((value: { blob: Blob; blobUrl: string; width: number; height: number }) => void)
      | undefined
    renderPageToImageFallback.mockReturnValue(
      new Promise((resolve) => {
        resolveRender = resolve
      })
    )

    const { result, rerender } = renderHook(
      ({ pdfUrl }) =>
        usePdfCaptureActions({
          currentPage: 1,
          queueImageForAi,
          startScreenshot: vi.fn(),
          pdfUrl
        }),
      { initialProps: { pdfUrl: 'blob:old-pdf' } }
    )

    let capturePromise: Promise<void> | undefined
    act(() => {
      capturePromise = result.current.handleFullPageScreenshot()
    })
    rerender({ pdfUrl: 'blob:new-pdf' })

    await act(async () => {
      resolveRender?.({
        blob: new Blob(['stale']),
        blobUrl: 'blob:stale-render',
        width: 1,
        height: 1
      })
      await capturePromise
    })

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stale-render')
  })
})
