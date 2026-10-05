import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useAiViewSurfaceState } = await import('@features/ai/hooks/useAiViewSurfaceState')

const lifecycle = vi.hoisted(() => ({ maxAliveTabs: 3 }))
vi.mock('@features/ai/hooks/useAiLifecycleSettings', () => ({
  useAiLifecycleSettings: () => lifecycle
}))

const TAB_IDS = ['a', 'b', 'c', 'd']

function mount(initial: { activeTabId: string | null; nonce?: number } = { activeTabId: 'a' }) {
  return renderHook(
    (props: { tabIds: string[]; activeTabId: string | null; aiViewRequestNonce: number }) =>
      useAiViewSurfaceState(props),
    {
      initialProps: {
        tabIds: TAB_IDS,
        activeTabId: initial.activeTabId,
        aiViewRequestNonce: initial.nonce ?? 0
      }
    }
  )
}

describe('useAiViewSurfaceState - alive tab LRU', () => {
  beforeEach(() => {
    lifecycle.maxAliveTabs = 3
  })

  it('starts with only the active tab alive', () => {
    const { result } = mount({ activeTabId: 'b' })
    expect(result.current.aliveTabIds).toEqual(['b'])
  })

  it('moves a revisited tab to the front without duplicating it', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })

    act(() => rerender({ tabIds: TAB_IDS, activeTabId: 'b', aiViewRequestNonce: 0 }))
    act(() => rerender({ tabIds: TAB_IDS, activeTabId: 'a', aiViewRequestNonce: 0 }))

    expect(result.current.aliveTabIds).toEqual(['a', 'b'])
  })

  it('bounds the alive set to maxAliveTabs, evicting the least recent', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })

    for (const id of ['b', 'c', 'd']) {
      act(() => rerender({ tabIds: TAB_IDS, activeTabId: id, aiViewRequestNonce: 0 }))
    }

    expect(result.current.aliveTabIds).toEqual(['d', 'c', 'b'])
    expect(result.current.aliveTabIds).not.toContain('a')
    expect(result.current.coldTabIds.has('a')).toBe(true)
  })

  it('honours a lowered maxAliveTabs without resurrecting a tab', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })
    for (const id of ['b', 'c']) {
      act(() => rerender({ tabIds: TAB_IDS, activeTabId: id, aiViewRequestNonce: 0 }))
    }
    expect(result.current.aliveTabIds).toEqual(['c', 'b', 'a'])

    lifecycle.maxAliveTabs = 2
    act(() => rerender({ tabIds: TAB_IDS, activeTabId: 'c', aiViewRequestNonce: 0 }))
    expect(result.current.aliveTabIds).toEqual(['c', 'b'])
  })

  it('drops closed tabs from the alive set', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })
    act(() => rerender({ tabIds: TAB_IDS, activeTabId: 'b', aiViewRequestNonce: 0 }))
    expect(result.current.aliveTabIds).toEqual(['b', 'a'])

    act(() => rerender({ tabIds: ['b'], activeTabId: 'b', aiViewRequestNonce: 0 }))
    expect(result.current.aliveTabIds).toEqual(['b'])
  })
})

describe('useAiViewSurfaceState - url restoration cache', () => {
  it('restores the last url of a tab', () => {
    const { result } = mount({ activeTabId: 'a' })
    act(() => {
      result.current.recordTabUrl('a', 'chatgpt', 'https://chatgpt.com/c/9')
    })

    expect(result.current.getRestoredUrl('a', 'chatgpt')).toBe('https://chatgpt.com/c/9')
  })

  it('refuses a cached url from a different model', () => {
    const { result } = mount({ activeTabId: 'a' })
    act(() => {
      result.current.recordTabUrl('a', 'chatgpt', 'https://chatgpt.com/c/9')
    })

    expect(result.current.getRestoredUrl('a', 'claude')).toBeUndefined()
  })

  it('garbage-collects the cache of a closed tab', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })
    act(() => {
      result.current.recordTabUrl('a', 'chatgpt', 'https://chatgpt.com/c/9')
      result.current.recordTabUrl('b', 'chatgpt', 'https://chatgpt.com/c/10')
    })
    expect(result.current.getRestoredUrl('b', 'chatgpt')).toBeTruthy()

    act(() => rerender({ tabIds: ['a'], activeTabId: 'a', aiViewRequestNonce: 0 }))

    expect(result.current.getRestoredUrl('b', 'chatgpt')).toBeUndefined()
    expect(result.current.getRestoredUrl('a', 'chatgpt')).toBe('https://chatgpt.com/c/9')
  })

  it('is not disturbed by a re-render, so an in-page navigation cannot thrash attach', () => {
    // The URL cache lives in this hook's ref, not in the panel component. That
    // is what lets a focus-mode swap reuse the same entry instead of rebuilding
    // the managed view.
    const { result, rerender } = mount({ activeTabId: 'a' })
    act(() => {
      result.current.recordTabUrl('a', 'chatgpt', 'https://chatgpt.com/c/9')
    })

    for (const id of ['a', 'a', 'a']) {
      act(() => rerender({ tabIds: TAB_IDS, activeTabId: id, aiViewRequestNonce: 0 }))
    }

    expect(result.current.getRestoredUrl('a', 'chatgpt')).toBe('https://chatgpt.com/c/9')
    expect(result.current.aliveTabIds).toEqual(['a'])
  })
})

describe('useAiViewSurfaceState - home surface', () => {
  it('shows home when there are no tabs', () => {
    const { result } = renderHook(() =>
      useAiViewSurfaceState({ tabIds: [], activeTabId: null, aiViewRequestNonce: 0 })
    )
    expect(result.current.showHome).toBe(true)
  })

  it('shows home when no tab is active', () => {
    const { result } = mount({ activeTabId: null })
    expect(result.current.showHome).toBe(true)
  })

  it('hides home once a model has been requested', () => {
    const { result, rerender } = mount({ activeTabId: 'a' })
    act(() => {
      result.current.showHideHome.show()
    })
    expect(result.current.showHome).toBe(true)

    act(() => rerender({ tabIds: TAB_IDS, activeTabId: 'a', aiViewRequestNonce: 1 }))
    expect(result.current.showHome).toBe(false)
  })

  it('can be toggled from the tab strip', () => {
    const { result } = mount({ activeTabId: 'a' })

    act(() => {
      result.current.showHideHome.show()
    })
    expect(result.current.showHome).toBe(true)

    act(() => {
      result.current.showHideHome.hide()
    })
    expect(result.current.showHome).toBe(false)
  })
})
