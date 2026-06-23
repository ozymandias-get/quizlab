import { useLocalStorage } from '@shared/hooks/useLocalStorage'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Integration: useLocalStorage cross-component sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('two hooks on same key stay in sync', async () => {
    const { result: hook1 } = renderHook(() => useLocalStorage('shared-key', 'initial'))
    const { result: hook2 } = renderHook(() => useLocalStorage('shared-key', 'initial'))

    expect(hook1.current[0]).toBe('initial')
    expect(hook2.current[0]).toBe('initial')

    act(() => {
      hook1.current[1]('updated-by-hook1')
    })

    await waitFor(() => {
      expect(hook2.current[0]).toBe('updated-by-hook1')
    })
  })

  it('hooks on different keys do not interfere', async () => {
    const { result: hook1 } = renderHook(() => useLocalStorage('key-a', 'a-initial'))
    const { result: hook2 } = renderHook(() => useLocalStorage('key-b', 'b-initial'))

    act(() => {
      hook1.current[1]('a-updated')
    })

    await waitFor(() => {
      expect(hook1.current[0]).toBe('a-updated')
      expect(hook2.current[0]).toBe('b-initial')
    })
  })
})
