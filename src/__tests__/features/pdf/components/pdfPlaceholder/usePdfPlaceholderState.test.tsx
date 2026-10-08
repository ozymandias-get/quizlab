import { usePdfPlaceholderState } from '@features/pdf/ui/components/pdfPlaceholder/usePdfPlaceholderState'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@app/providers', () => ({ useToastActions: () => ({ addToast: vi.fn() }) }))

describe('usePdfPlaceholderState', () => {
  it('does not restore the missing old path after a successful relink', async () => {
    const restore = vi.fn()
    const item = {
      path: '/missing.pdf',
      name: 'notes.pdf',
      page: 8,
      totalPages: 20,
      lastOpenedAt: 1,
      originalIndex: 0
    }
    const options = {
      onRelinkPdf: vi.fn().mockResolvedValue(true),
      onRestoreResumePdf: restore,
      lastReadingInfo: [item]
    }
    const { result } = renderHook(() => usePdfPlaceholderState(options))
    await act(async () => result.current.handleRelink(item))
    expect(restore).not.toHaveBeenCalled()
  })
})
