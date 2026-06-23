import { useTextSelection } from '@app/hooks/useTextSelection'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQueueTextForAi = vi.fn()

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    queueTextForAi: mockQueueTextForAi
  })
}))

describe('useTextSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues selected text for AI', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('Selected Text', { top: 100, left: 100 })
    })

    expect(mockQueueTextForAi).toHaveBeenCalledWith('Selected Text')
  })

  it('does not queue empty text', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('   ', { top: 100, left: 100 })
    })

    expect(mockQueueTextForAi).not.toHaveBeenCalled()
  })

  it('deduplicates the same selection signature briefly', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('Repeated', { top: 100, left: 100 })
      result.current.handleTextSelection('Repeated', { top: 100, left: 100 })
    })

    expect(mockQueueTextForAi).toHaveBeenCalledTimes(1)
  })
})
