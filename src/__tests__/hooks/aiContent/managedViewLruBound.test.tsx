import { act, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * End-to-end check of the invariant that `maxAliveTabs` is a real bound on the
 * number of native views, not only on the number of mounted React hosts:
 *
 *   remote AI WebContentsView count <= alive remote AI tab count
 *
 * The renderer halves of the chain are the real hooks; only the main-process
 * manager is a stand-in that keeps a map of "views" and records every teardown,
 * because that map is exactly what used to grow without bound.
 */

const lifecycle = vi.hoisted(() => ({ maxAliveTabs: 2 }))
vi.mock('@features/ai/hooks/useAiLifecycleSettings', () => ({
  useAiLifecycleSettings: () => lifecycle
}))

/** Stands in for `AiWebContentsViewManager`: one `WebContents` per view id. */
const manager = vi.hoisted(() => {
  const views = new Map<string, { generation: number; closed: boolean }>()
  let generationCounter = 0
  return {
    views,
    reset: () => {
      views.clear()
      generationCounter = 0
    },
    size: () => views.size,
    liveCount: () => [...views.values()].filter((view) => !view.closed).length,
    close: (viewId: string) => {
      const view = views.get(viewId)
      if (!view) return false
      view.closed = true
      views.delete(viewId)
      return true
    },
    attach: (viewId: string) => {
      const existing = views.get(viewId)
      if (existing) return { generation: existing.generation, created: false }
      generationCounter += 1
      views.set(viewId, { generation: generationCounter, closed: false })
      return { generation: generationCounter, created: true }
    }
  }
})

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(),
  destroy: vi.fn()
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({ reportSuppressedError: vi.fn() }))

const { useAiViewSurfaceState } = await import('@features/ai/hooks/useAiViewSurfaceState')
const { useManagedViewRetirement } = await import('@shared/hooks/aiContent/managedViewLifecycle')

/**
 * The renderer half of a managed view: attach while the tab is alive, retire it
 * when the alive set drops it. `AiSession` + `useManagedContentView` do exactly
 * this, so the invariant under test does not depend on either.
 */
function useTabLifecycle({
  tabIds,
  activeTabId
}: {
  tabIds: string[]
  activeTabId: string | null
}) {
  const surface = useAiViewSurfaceState({ tabIds, activeTabId, aiViewRequestNonce: 0 })
  useManagedViewRetirement(surface.aliveTabIds)

  const aliveKey = surface.aliveTabIds.join(' ')
  useEffect(() => {
    for (const viewId of aliveKey === '' ? [] : aliveKey.split(' ')) {
      void aiViewClient.attach({ viewId })
    }
  }, [aliveKey])

  return surface
}

const viewIds = (): string[] => [...manager.views.keys()]

describe('managed view LRU bound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lifecycle.maxAliveTabs = 2
    manager.reset()
    aiViewClient.attach.mockImplementation(async (request: { viewId: string }) =>
      manager.attach(request.viewId)
    )
    aiViewClient.destroy.mockImplementation(async (request: { viewId: string }) =>
      manager.close(request.viewId)
    )
  })

  it('never keeps more native views than the alive tab limit while opening 10 tabs', async () => {
    const tabIds = Array.from({ length: 10 }, (_, index) => `tab-${index}`)
    const { result, rerender } = renderHook(
      (props: { tabIds: string[]; activeTabId: string | null }) => useTabLifecycle(props),
      { initialProps: { tabIds, activeTabId: 'tab-0' as string | null } }
    )

    let peak = 0
    for (let index = 1; index < tabIds.length; index += 1) {
      await act(async () => {
        rerender({ tabIds, activeTabId: tabIds[index] })
      })
      peak = Math.max(peak, manager.liveCount())
      expect(manager.liveCount()).toBeLessThanOrEqual(lifecycle.maxAliveTabs)
      expect(result.current.aliveTabIds.length).toBeLessThanOrEqual(lifecycle.maxAliveTabs)
    }

    expect(peak).toBeGreaterThan(0)
    expect(viewIds().sort()).toEqual([...result.current.aliveTabIds].sort())
  })

  it('closes the WebContents of every tab the LRU evicted', async () => {
    const tabIds = ['a', 'b', 'c']
    const { rerender } = renderHook(
      (props: { tabIds: string[]; activeTabId: string | null }) => useTabLifecycle(props),
      { initialProps: { tabIds, activeTabId: 'a' as string | null } }
    )

    await act(async () => {
      rerender({ tabIds, activeTabId: 'b' })
    })
    await act(async () => {
      rerender({ tabIds, activeTabId: 'c' })
    })

    expect(viewIds().sort()).toEqual(['b', 'c'])
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'a' })
  })

  it('destroys the view of a closed tab', async () => {
    const { rerender } = renderHook(
      (props: { tabIds: string[]; activeTabId: string | null }) => useTabLifecycle(props),
      { initialProps: { tabIds: ['a', 'b'] as string[], activeTabId: 'a' as string | null } }
    )

    await act(async () => {
      rerender({ tabIds: ['b'], activeTabId: 'b' })
    })

    expect(manager.views.has('a')).toBe(false)
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'a' })
  })

  it('re-creates the view with the cached url when an evicted tab comes back', async () => {
    const { result, rerender } = renderHook(
      (props: { tabIds: string[]; activeTabId: string | null }) => useTabLifecycle(props),
      {
        initialProps: {
          tabIds: ['a', 'b', 'c'] as string[],
          activeTabId: 'a' as string | null
        }
      }
    )

    act(() => {
      result.current.recordTabUrl('a', 'chatgpt', 'https://chatgpt.com/c/1')
    })

    await act(async () => {
      rerender({ tabIds: ['a', 'b', 'c'], activeTabId: 'b' })
    })
    await act(async () => {
      rerender({ tabIds: ['a', 'b', 'c'], activeTabId: 'c' })
    })
    expect(manager.views.has('a')).toBe(false)

    await act(async () => {
      rerender({ tabIds: ['a', 'b', 'c'], activeTabId: 'a' })
    })

    expect(manager.views.has('a')).toBe(true)
    expect(result.current.getRestoredUrl('a', 'chatgpt')).toBe('https://chatgpt.com/c/1')
  })

  it('does not accumulate views across repeated open and close cycles', async () => {
    const tabIds = ['a', 'b', 'c']
    const { rerender } = renderHook(
      (props: { tabIds: string[]; activeTabId: string | null }) => useTabLifecycle(props),
      { initialProps: { tabIds: ['a'] as string[], activeTabId: 'a' as string | null } }
    )

    for (let cycle = 0; cycle < 5; cycle += 1) {
      for (const id of tabIds) {
        await act(async () => {
          rerender({ tabIds, activeTabId: id })
        })
      }
      await act(async () => {
        rerender({ tabIds: [], activeTabId: null })
      })
      expect(manager.liveCount()).toBe(0)
      expect(manager.size()).toBe(0)
    }
  })
})
