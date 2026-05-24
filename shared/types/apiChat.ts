export interface ApiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  providerId?: string
  images?: string[]
}

export interface ApiProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  defaultModel: string
  enabled: boolean
  models: string[]
  providerType: 'openai' | 'anthropic' | 'google' | 'custom'
}

export interface ApiConfig {
  providers: ApiProviderConfig[]
  generalPrompt: string
  memoryPrompt: string
  characterPrompt: string
  selectedProviderId: string
  selectedModel: string
}
