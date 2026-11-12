import { useAiModelPreferences } from '@app/providers/ai/useAiModelPreferences'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import type { AiRegistryResponse } from '@shared-core/types'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useAppearance } from '@shared/stores/appearanceStore'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

const registryData: AiRegistryResponse = {
  aiRegistry: WEB_AI_REGISTRY,
  allAiIds: Object.keys(WEB_AI_REGISTRY),
  defaultAiId: 'chatgpt',
  chromeUserAgent: ''
}

describe('AI catalogue preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppearance.setState({ visibleModels: {} })
  })

  it('enables a favorited model, pins its shortcut and preserves favorites after restart', async () => {
    localStorage.setItem(STORAGE_KEYS.ENABLED_MODELS, JSON.stringify(['chatgpt']))
    const { result, unmount } = renderHook(() =>
      useAiModelPreferences({ registryData, isLoading: false, isError: false })
    )
    act(() => result.current.toggleFavoriteModel('poe'))
    expect(result.current.favoriteModels).toEqual(['poe'])
    expect(result.current.enabledModels).toEqual(['chatgpt', 'poe'])
    expect(result.current.defaultAiModel).toBe('chatgpt')
    expect(useAppearance.getState().visibleModels.poe).toBe(true)
    unmount()
    const restarted = renderHook(() =>
      useAiModelPreferences({ registryData, isLoading: false, isError: false })
    )
    await waitFor(() => expect(restarted.result.current.favoriteModels).toEqual(['poe']))
    act(() => restarted.result.current.toggleFavoriteModel('poe'))
    expect(restarted.result.current.favoriteModels).toEqual([])
    expect(restarted.result.current.enabledModels).toContain('poe')
    expect(useAppearance.getState().visibleModels.poe).toBe(false)
  })

  it('keeps favorites while loading and removes deleted, duplicate and site-only entries once loaded', async () => {
    localStorage.setItem(
      STORAGE_KEYS.FAVORITE_AI_MODELS,
      JSON.stringify(['poe', 'removed', 'poe', 'youtube'])
    )
    const { result, rerender } = renderHook(
      ({ data }: { data?: AiRegistryResponse }) =>
        useAiModelPreferences({ registryData: data, isLoading: !data, isError: false }),
      { initialProps: { data: undefined } as { data?: AiRegistryResponse } }
    )
    expect(result.current.favoriteModels).toEqual(['poe', 'removed', 'poe', 'youtube'])
    rerender({ data: registryData })
    await waitFor(() => expect(result.current.favoriteModels).toEqual(['poe']))
    act(() => result.current.toggleFavoriteModel('youtube'))
    act(() => result.current.toggleFavoriteModel('constructor'))
    expect(result.current.favoriteModels).toEqual(['poe'])
  })

  it('loads the async catalogue without enabling the additional services', async () => {
    const { result, rerender } = renderHook(
      ({ data }: { data?: AiRegistryResponse }) =>
        useAiModelPreferences({
          registryData: data,
          isLoading: !data,
          isError: false
        }),
      { initialProps: { data: undefined } as { data?: AiRegistryResponse } }
    )
    rerender({ data: registryData })
    await waitFor(() => expect(result.current.enabledModels).toContain('chatgpt'))
    expect(result.current.enabledModels).not.toContain('poe')
    expect(result.current.enabledModels).not.toContain('perplexity')
  })

  it('keeps a disabled built-in disabled across registry refresh and restart', async () => {
    localStorage.setItem(STORAGE_KEYS.ENABLED_MODELS, JSON.stringify(['chatgpt', 'claude']))
    const { result, rerender, unmount } = renderHook(
      ({ data }) => useAiModelPreferences({ registryData: data, isLoading: false, isError: false }),
      { initialProps: { data: registryData } }
    )
    act(() => result.current.setEnabledModels(['chatgpt']))
    rerender({ data: { ...registryData, aiRegistry: { ...WEB_AI_REGISTRY } } })
    expect(result.current.enabledModels).toEqual(['chatgpt'])
    unmount()
    const restarted = renderHook(() =>
      useAiModelPreferences({ registryData, isLoading: false, isError: false })
    )
    await waitFor(() => expect(restarted.result.current.enabledModels).toEqual(['chatgpt']))
  })

  it('preserves an opted-in service and removes obsolete saved ids', async () => {
    localStorage.setItem(STORAGE_KEYS.ENABLED_MODELS, JSON.stringify(['poe', 'removed-service']))
    const { result } = renderHook(() =>
      useAiModelPreferences({ registryData, isLoading: false, isError: false })
    )
    await waitFor(() => expect(result.current.enabledModels).toEqual(['poe']))
  })
})
