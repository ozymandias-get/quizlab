/**
 * `useScreenshotPipeline` — alan yakalama artık doğrudan kuyruğa yazmaz.
 * Yakalama `pendingAreaCapture` olarak bekletilir; ikili menü
 * (AI'ye Gönder / Taslağa Ekle) karar verene kadar kuyruğa yazılmaz.
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
  useScreenshot: vi.fn((onCapture: (dataUrl: string, rect?: unknown) => void | Promise<void>) => ({
    ...overlay,
    handleCapture: vi.fn(async (dataUrl: string, rect?: unknown) => {
      await onCapture(dataUrl, rect)
    })
  }))
}))

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

describe('useScreenshotPipeline', () => {
  const queueImageForAi = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stashes the capture as pending instead of queueing immediately', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    expect(overlay.startScreenshot).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz', {
        left: 10,
        top: 20,
        width: 100,
        height: 60
      })
    })

    // Doğrudan kuyruk yok — menü kararı bekler.
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingAreaCapture).toMatchObject({
      dataUrl: 'data:image/png;base64,xyz',
      meta: { page: 4, captureKind: 'selection' }
    })
    expect(result.current.pendingAreaCapture?.rect).toMatchObject({ left: 10, top: 20 })
  })

  it('queues only when the pending capture is confirmed as draft', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz', null)
    })
    expect(queueImageForAi).not.toHaveBeenCalled()

    let confirmed = false
    act(() => {
      confirmed = result.current.confirmPendingAreaAsDraft()
    })
    expect(confirmed).toBe(true)
    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,xyz', {
      page: 4,
      captureKind: 'selection'
    })
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('drops the pending capture on dismiss without queueing', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('first', null)
    })
    act(() => {
      result.current.dismissPendingArea()
    })
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('a new area selection supersedes the previous pending capture', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('first', null)
    })
    expect(result.current.pendingAreaCapture?.dataUrl).toBe('first')

    act(() => {
      result.current.startScreenshot()
    })
    // Yeni seçim eski bekleyeni geçersiz kılar.
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('tears the overlay down when the user cancels instead of capturing', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.closeScreenshot()
    })

    expect(overlay.closeScreenshot).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).not.toHaveBeenCalled()
  })

  it('clears the metadata without leaving screenshot mode', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.clearScreenshotMeta()
    })

    expect(overlay.closeScreenshot).not.toHaveBeenCalled()
    expect(queueImageForAi).not.toHaveBeenCalled()
  })
})
