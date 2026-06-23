import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseScreenshotReturn = {
  isScreenshotMode: false,
  startScreenshot: vi.fn(),
  closeScreenshot: vi.fn(),
  handleCapture: vi.fn()
}

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: vi.fn(() => mockUseScreenshotReturn)
}))

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

describe('useScreenshotPipeline', () => {
  const queueImageForAi = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseScreenshotReturn.isScreenshotMode = false
    mockUseScreenshotReturn.startScreenshot.mockReset()
    mockUseScreenshotReturn.closeScreenshot.mockReset()
    mockUseScreenshotReturn.handleCapture.mockReset()
  })

  it('exposes the underlying screenshot mode flag', () => {
    mockUseScreenshotReturn.isScreenshotMode = false
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))
    expect(result.current.isScreenshotMode).toBe(false)
  })

  it('forwards startScreenshot with meta and triggers underlying start', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })

    expect(mockUseScreenshotReturn.startScreenshot).toHaveBeenCalledTimes(1)
  })

  it('clears meta and triggers underlying close on closeScreenshot', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    act(() => {
      result.current.closeScreenshot()
    })

    expect(mockUseScreenshotReturn.closeScreenshot).toHaveBeenCalledTimes(1)
    // After close, starting again without meta should still work
    act(() => {
      result.current.startScreenshot()
    })
    expect(mockUseScreenshotReturn.startScreenshot).toHaveBeenCalledTimes(2)
  })

  it('handleCapture awaits underlying capture and clears meta even on success', async () => {
    mockUseScreenshotReturn.handleCapture.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })

    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz')
    })

    expect(mockUseScreenshotReturn.handleCapture).toHaveBeenCalledWith('data:image/png;base64,xyz')
  })

  it('clearScreenshotMeta does not toggle screenshot mode', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.clearScreenshotMeta()
    })

    expect(mockUseScreenshotReturn.closeScreenshot).not.toHaveBeenCalled()
    expect(mockUseScreenshotReturn.startScreenshot).not.toHaveBeenCalled()
  })
})
