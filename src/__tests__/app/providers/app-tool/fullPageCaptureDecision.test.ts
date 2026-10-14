import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: (onSendToAI?: (data: string, rect: unknown) => Promise<unknown>) => ({
    isScreenshotMode: false,
    startScreenshot: vi.fn(),
    closeScreenshot: vi.fn(),
    handleCapture: async (data: string, rect: unknown) => onSendToAI?.(data, rect)
  })
}))

const revokeObjectURL = vi.fn()

describe('useScreenshotPipeline — full-page capture decision', () => {
  const queueImageForAi = vi.fn(() => true)

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    })
  })

  function setup() {
    return renderHook(() => useScreenshotPipeline({ queueImageForAi }))
  }

  it('parks a full-page capture for the choice menu instead of queueing it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', {
        page: 13,
        captureKind: 'full-page',
        source: {
          docId: 'doc',
          page: 13,
          totalPages: 59,
          captureKind: 'full-page-image',
          createdAt: 1
        }
      })
    })

    // Kendiliğinden taslağa EKLENMEZ.
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingFullPageCapture).not.toBeNull()
    expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:page-13')
    expect(result.current.pendingFullPageCapture?.meta?.page).toBe(13)
  })

  it('queues the capture only after the user picks "Taslağa Ekle"', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })
    act(() => {
      result.current.confirmPendingFullPageAsDraft()
    })

    expect(queueImageForAi).toHaveBeenCalledWith(
      'blob:page-13',
      expect.objectContaining({ page: 13, captureKind: 'full-page' })
    )
    expect(result.current.pendingFullPageCapture).toBeNull()
  })

  it('revokes a dismissed capture and never queues it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })
    act(() => {
      result.current.dismissPendingFullPage()
    })

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingFullPageCapture).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:page-13')
  })

  it('revokes the previous pending capture when a newer one supersedes it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-11', { page: 11, captureKind: 'full-page' })
    })
    act(() => {
      result.current.offerFullPageCapture('blob:page-12', { page: 12, captureKind: 'full-page' })
    })

    expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:page-12')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:page-11')
    expect(queueImageForAi).not.toHaveBeenCalled()
  })
})
