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
  }
}
