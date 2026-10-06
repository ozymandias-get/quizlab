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
  providerType: 'openai' | 'anthropic' | 'google' | 'nvidia' | 'custom'
  /** Request timeout in milliseconds (default: 60000 for chat, 15000 for model list). */
  requestTimeout?: number
  /** When true, allows loopback/private (Ollama, LM Studio, vLLM, LocalAI) endpoints. */
  allowLocalNetwork?: boolean
  /**
   * @deprecated Read only for backward compatibility with persisted config
   * files. Resolved to `allowLocalNetwork` at the normalization boundary in
   * `electron/features/ai/apiChatHandlers/apiChatHandlers.ts`; never write it.
   */
  allowLocalEndpoints?: boolean
  /**
   * @deprecated Read only for backward compatibility with persisted config
   * files. Resolved to `allowLocalNetwork` at the normalization boundary in
   * `electron/features/ai/apiChatHandlers/apiChatHandlers.ts`; never write it.
   */
  isCustomProvider?: boolean
}

export interface ApiConfig {
  providers: ApiProviderConfig[]
  generalPrompt: string
  memoryPrompt: string
  characterPrompt: string
  selectedProviderId: string
  selectedModel: string
}
