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
  /** Request timeout in milliseconds (default: 60000 for chat, 15000 for model list). */
  requestTimeout?: number
}

export interface ApiConfig {
  providers: ApiProviderConfig[]
  generalPrompt: string
  memoryPrompt: string
  characterPrompt: string
  selectedProviderId: string
  selectedModel: string
}
