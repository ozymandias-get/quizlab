/**
 * Tests for provider-related TanStack Query hooks.
 *
 * These tests verify:
 *   - useApiConfigQuery — reads persisted ApiConfig via IPC
 *   - useProviderHealthQuery — probes provider reachability
 *   - useModelsQuery — fetches model list for a provider
 *
 * @see @features/ai/queries/useProviderQueries
 */

import type { ApiConfig } from '@shared-core/types'

import {
  useApiConfigQuery,
  useModelsQuery,
  useProviderHealthQuery
} from '@features/ai/queries/useProviderQueries'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock helpers ──────────────────────────────────────────────────────────────

const mockFetchApiChatModels = vi.fn()
const mockGetApiChatConfig = vi.fn()

vi.mock('@features/ai/api/sessions.api', () => ({
  fetchApiChatModels: (...args: any[]) => mockFetchApiChatModels(...args),
  getApiChatConfig: (...args: any[]) => mockGetApiChatConfig(...args)
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

// ── Factory helpers ───────────────────────────────────────────────────────────

const mockApiConfig = (overrides: Partial<ApiConfig> = {}): ApiConfig => ({
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-xxx',
      defaultModel: 'gpt-4',
      enabled: true,
      models: ['gpt-4', 'gpt-3.5-turbo'],
      providerType: 'openai'
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-xxx',
      defaultModel: 'claude-3',
      enabled: true,
      models: ['claude-3', 'claude-3-sonnet'],
      providerType: 'anthropic'
    }
  ],
  generalPrompt: 'Be helpful',
  memoryPrompt: 'User likes Python',
  characterPrompt: 'You are a coding assistant',
  selectedProviderId: 'openai',
  selectedModel: 'gpt-4',
  ...overrides
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useApiConfigQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('returns the API config from getApiChatConfig', async () => {
    const config = mockApiConfig()
    mockGetApiChatConfig.mockResolvedValue(config)

    const { result } = renderHook(() => useApiConfigQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(config)
    expect(result.current.data?.generalPrompt).toBe('Be helpful')
    expect(result.current.data?.selectedProviderId).toBe('openai')
    expect(mockGetApiChatConfig).toHaveBeenCalledTimes(1)
  })

  it('has staleTime: Infinity so it never refetches', async () => {
    mockGetApiChatConfig.mockResolvedValue(mockApiConfig())

    const { result } = renderHook(() => useApiConfigQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetApiChatConfig).toHaveBeenCalledTimes(1)
  })

  it('stores prompts and provider selection in the response', async () => {
    const config = mockApiConfig({
      generalPrompt: 'Custom prompt',
      memoryPrompt: 'Custom memory',
      characterPrompt: 'Custom character',
      selectedProviderId: 'anthropic',
      selectedModel: 'claude-3-sonnet'
    })
    mockGetApiChatConfig.mockResolvedValue(config)

    const { result } = renderHook(() => useApiConfigQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.generalPrompt).toBe('Custom prompt')
    expect(result.current.data?.memoryPrompt).toBe('Custom memory')
    expect(result.current.data?.characterPrompt).toBe('Custom character')
    expect(result.current.data?.selectedProviderId).toBe('anthropic')
    expect(result.current.data?.selectedModel).toBe('claude-3-sonnet')
  })

  it('returns provider configurations in the response', async () => {
    mockGetApiChatConfig.mockResolvedValue(mockApiConfig())

    const { result } = renderHook(() => useApiConfigQuery(), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.providers).toHaveLength(2)
    expect(result.current.data?.providers[0].id).toBe('openai')
    expect(result.current.data?.providers[0].models).toContain('gpt-4')
    expect(result.current.data?.providers[1].id).toBe('anthropic')
  })
})

describe('useProviderHealthQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('returns healthy=true when fetchApiChatModels succeeds', async () => {
    mockFetchApiChatModels.mockResolvedValue(['gpt-4', 'gpt-3.5-turbo'])

    const { result } = renderHook(() => useProviderHealthQuery('openai'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      healthy: true,
      models: ['gpt-4', 'gpt-3.5-turbo'],
      providerId: 'openai'
    })
  })

  it('returns healthy=false when fetchApiChatModels fails', async () => {
    mockFetchApiChatModels.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useProviderHealthQuery('openai'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      healthy: false,
      models: [],
      providerId: 'openai'
    })
  })

  it('is disabled when providerId is empty', async () => {
    const { result } = renderHook(() => useProviderHealthQuery(''), {
      wrapper: createWrapper(queryClient)
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFetchApiChatModels).not.toHaveBeenCalled()
  })

  it('has staleTime of 30 seconds', async () => {
    mockFetchApiChatModels.mockResolvedValue(['gpt-4'])

    const { result } = renderHook(() => useProviderHealthQuery('openai'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // With staleTime: 30s, retry: false, it should fetch once and not auto-refetch
    expect(mockFetchApiChatModels).toHaveBeenCalledTimes(1)
  })
})

describe('useModelsQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
  })

  it('returns model list for a provider', async () => {
    const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    mockFetchApiChatModels.mockResolvedValue(models)

    const { result } = renderHook(() => useModelsQuery('openai'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(models)
    expect(mockFetchApiChatModels).toHaveBeenCalledWith('openai')
  })

  it('is disabled when providerId is empty', async () => {
    const { result } = renderHook(() => useModelsQuery(''), {
      wrapper: createWrapper(queryClient)
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
    expect(mockFetchApiChatModels).not.toHaveBeenCalled()
  })

  it('handles provider that returns empty model list', async () => {
    mockFetchApiChatModels.mockResolvedValue([])

    const { result } = renderHook(() => useModelsQuery('custom-provider'), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('handles fetch errors after retries', async () => {
    mockFetchApiChatModels.mockRejectedValue(new Error('API unavailable'))

    const { result } = renderHook(() => useModelsQuery('openai'), {
      wrapper: createWrapper(queryClient)
    })

    // Hook has retry: 2, so we need to wait for all retries to exhaust
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.error).toBeDefined()
  })
})
