import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useManagedViewRetirement } = await import('@shared/hooks/aiContent/managedViewLifecycle')

const aiViewClient = vi.hoisted(() => ({
  destroy: vi.fn(async (_request: { viewId: string }) => true)
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({
  reportSuppressedError: vi.fn()
}))

const destroyedIds = (): string[] =>
  aiViewClient.destroy.mock.calls.map((call) => (call[0] as { viewId: string }).viewId)

function mount(liveViewIds: string[]) {
  return renderHook(
    (props: { liveViewIds: string[] }) => useManagedViewRetirement(props.liveViewIds),
    { initialProps: { liveViewIds } }
  )
}

describe('useManagedViewRetirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.destroy.mockResolvedValue(true)
  })

  it('retires nothing on the first pass, before any view exists', () => {
    mount(['a', 'b'])
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('retires a view whose identity left the live set', async () => {
    // The LRU case: a tab drops out of `maxAliveTabs`, so its `AiSession`
    // unmounts. Unmount alone only releases the host, so the native view has to
    // be retired by whoever owns the identity.
    const { rerender } = mount(['a', 'b', 'c'])
    rerender({ liveViewIds: ['c', 'b'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(destroyedIds()).toEqual(['a'])
  })

  it('retires every view of a mass eviction in one pass', async () => {
    // `maxAliveTabs` lowered from 5 to 1.
    const { rerender } = mount(['a', 'b', 'c', 'd', 'e'])
    rerender({ liveViewIds: ['e'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(destroyedIds().sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('retires a closed tab exactly once', async () => {
    const { rerender } = mount(['a', 'b'])
    rerender({ liveViewIds: ['b'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(destroyedIds()).toEqual(['a'])

    // A later render with the same membership must not re-destroy it: the id is
    // no longer retained, so there is nothing left to retire.
    rerender({ liveViewIds: ['b'] })
    rerender({ liveViewIds: ['b', 'c'] })
    rerender({ liveViewIds: ['b', 'c'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(destroyedIds()).toEqual(['a'])
  })

  it('never retires a view that stays live', async () => {
    const { rerender } = mount(['a'])
    for (let i = 0; i < 10; i += 1) rerender({ liveViewIds: ['a'] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('preserves identities across MRU reorder and retires only removed members', () => {
    const { rerender } = mount(['a', 'b'])
    rerender({ liveViewIds: ['b', 'a', 'b'] })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    rerender({ liveViewIds: ['b'] })
    expect(destroyedIds()).toEqual(['a'])
  })

  it('does not fire for an empty live set that never held a view', async () => {
    const { rerender } = mount([])
    rerender({ liveViewIds: [] })

    await act(async () => {
      await Promise.resolve()
    })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })
})
