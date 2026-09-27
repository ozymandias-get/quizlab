import type { ApiProviderConfig } from '@shared-core/types'

export const DEFAULT_PROVIDER_TEMPLATES: Record<
  string,
  { baseUrl: string; providerType: ApiProviderConfig['providerType'] }
> = {
  openai: { baseUrl: 'https://api.openai.com/v1', providerType: 'openai' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', providerType: 'anthropic' },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    providerType: 'google'
  },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', providerType: 'nvidia' }
}

/** Per-provider input hints. The generic fallbacks stay OpenAI-shaped. */
export const PROVIDER_PLACEHOLDERS: Record<string, { apiKey: string; model: string }> = {
  openai: { apiKey: 'sk-...', model: 'gpt-4o' },
  anthropic: { apiKey: 'sk-ant-...', model: 'claude-sonnet-4-5' },
  google: { apiKey: 'AIza...', model: 'gemini-2.5-pro' },
  // NIM model ids are vendor-namespaced, so a bare `gpt-4o`-style hint would be
  // misleading here.
  nvidia: { apiKey: 'nvapi-...', model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' }
}

export const DEFAULT_PLACEHOLDERS = { apiKey: 'sk-...', model: 'gpt-4o' }
