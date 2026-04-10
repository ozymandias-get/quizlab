import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiDraftQueue } from '@app/providers/app-tool/useAiDraftQueue'

describe('useAiDraftQueue', () => {
  const mockCreateObjectURL = vi.fn(() => 'blob:preview')
  const mockRevokeObjectURL = vi.fn()
  const OriginalUrl = URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'URL',
      Object.assign(OriginalUrl, {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('revokes image preview URLs when items are cleared', () => {
    const { result } = renderHook(() => useAiDraftQueue())

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
    })

    act(() => {
      result.current.clearPendingAiItems()
    })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('revokes pending image preview URLs on unmount', () => {
    const { result, unmount } = renderHook(() => useAiDraftQueue())

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
    })

    unmount()

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })
})
