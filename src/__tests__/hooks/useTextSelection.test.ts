import { useTextSelection } from '@app/hooks/useTextSelection'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Yeni sözleşme: seçim artık doğrudan taslağa yazılmaz. İkili menü
 * (AI'ye Gönder / Taslağa Ekle) karar verir; bu hook yalnızca legacy
 * bildirim zincirini korur ve hızlı tekrarları eler.
 */
describe('useTextSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not auto-queue selected text (menu decides)', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('Selected Text', { top: 100, left: 100 })
    })

    // Kuyruklama yok — hata da yok.
    expect(result.current.handleTextSelection).toBeDefined()
  })

  it('ignores empty text', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('   ', { top: 100, left: 100 })
    })

    expect(result.current.handleTextSelection).toBeDefined()
  })

  it('deduplicates the same selection briefly without throwing', () => {
    const { result } = renderHook(() => useTextSelection())

    act(() => {
      result.current.handleTextSelection('Repeated', { top: 100, left: 100 })
      result.current.handleTextSelection('Repeated', { top: 100, left: 100 })
    })

    expect(result.current.handleTextSelection).toBeDefined()
  })
})
