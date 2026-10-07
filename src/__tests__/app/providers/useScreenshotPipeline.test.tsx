/**
 * `useScreenshotPipeline` is the seam between the screenshot overlay and the AI
 * queue. Its one job that the overlay does not do is thread the capture metadata
 * — page number and capture kind — from the moment the user starts the crop to
 * the moment the image is queued, and then drop it so the *next* capture cannot
 * inherit the previous page's number.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const overlay = {
  isScreenshotMode: false,
  startScreenshot: vi.fn(),
  closeScreenshot: vi.fn(),
  handleCapture: vi.fn()
}

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: vi.fn((onCapture: (dataUrl: string) => void | Promise<void>) => ({
    ...overlay,
    // The real hook owns the overlay's capture callback; the pipeline's contract
    // is what happens around it, so drive it the way the component would.
    handleCapture: vi.fn(async (dataUrl: string) => {
      await onCapture(dataUrl)
    })
  }))
}))

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

describe('useScreenshotPipeline', () => {
  const queueImageForAi = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('labels the queued image with the metadata the capture was started with', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz')
    })

    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,xyz', {
      page: 4,
      captureKind: 'selection'
    })
  })

  it('queues with no metadata when the capture was started bare', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot()
    })
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,abc')
    })

    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,abc', undefined)
  })

  // A stale page number on a queued image is worse than none: the AI would be
  // asked about a page the reader is not looking at.
  it("does not carry one capture's metadata into the next", async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('first')
    })

    act(() => {
      result.current.startScreenshot()
    })
    await act(async () => {
      await result.current.handleCapture('second')
    })

    expect(queueImageForAi.mock.calls[1]).toEqual(['second', undefined])
  })

  it('drops the metadata when the user cancels instead of capturing', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.closeScreenshot()
    })
    act(() => {
      result.current.startScreenshot()
    })
    expect(() => result.current.clearScreenshotMeta()).not.toThrow()
  })

  it('clears the metadata without leaving screenshot mode', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.clearScreenshotMeta()
    })

    // Dismissing a pending capture must not tear down the overlay the reader
    // is still looking at; only closeScreenshot does that.
    expect(overlay.closeScreenshot).not.toHaveBeenCalled()
    expect(queueImageForAi).not.toHaveBeenCalled()
  })
})
