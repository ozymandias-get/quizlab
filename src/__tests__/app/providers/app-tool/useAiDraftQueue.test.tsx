import { useAiDraftQueue } from '@app/providers/app-tool/useAiDraftQueue'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('resolves large data URL previews with local decode (no fetch)', async () => {
    const { result } = renderHook(() => useAiDraftQueue())

    // >= 2MB base64 takes the large-capture branch, which must not rely on
    // fetch(data:) — blocked by connect-src under Electron's CSP.
    const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`
    await act(async () => {
      result.current.queueImageForAi(largeDataUrl)
      // flush the preview-resolution microtasks
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(mockCreateObjectURL).toHaveBeenCalled()
  })
})
